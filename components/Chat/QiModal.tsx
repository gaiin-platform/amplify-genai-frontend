import { useEffect, useState} from "react";
import {Conversation} from "@/types/chat";
import { QiSummary, QiSummaryType } from "@/types/qi";
import {useTranslation} from 'next-i18next';
import { uploadToQiS3 } from '@/services/qiService';
import cloneDeep from 'lodash/cloneDeep';
import { AttachedDocument } from "@/types/attacheddocument";
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import toast from "react-hot-toast";

interface QiModalProps {
    qiSummary: QiSummary | null;
    onSubmit: () => void;
    onCancel: () => void;
    type: QiSummaryType;
    conversation?: Conversation | null;
}


const QiModal: React.FC<QiModalProps> = ({qiSummary, onSubmit, onCancel, type, conversation}) => {

    const [strippedConversation, setStrippedConversation] = useState<Conversation | null>(null);
    const [dataSourceCount, setDataSourceCount] =  useState<number>(0);

    useEffect(() => {
        const stripDataSources = () => {
            if (type === QiSummaryType.CONVERSATION && conversation) {
                let dsCount = 0;
                const copy = cloneDeep(conversation);

                copy.messages.forEach(m => {
                    if (m.data) {
                        if (m.data.dataSources) {
                            m.data.dataSources = null;
                            dsCount += 1;
                        }
                        if (m.data.state && m.data.state.sources) {
                            m.data.state.sources = null;
                        }
                    }
                });
                if (copy.promptTemplate) {
                    copy.promptTemplate.data = {};
                }
                setDataSourceCount(dsCount);
                setStrippedConversation(copy);
            }
        };
        
        if (!strippedConversation) stripDataSources();
    }, [type]); 

    const [summary, setSummary] = useState<string>(qiSummary ? qiSummary.summary : "");
    const [purpose, setPurpose] = useState<string>(qiSummary ? qiSummary.purpose :"");
    const [additionalComments, setAdditionalComments] = useState<string>("");
    const [includeUser, setIncludeUser] = useState<boolean>(false);
    const [includeDataSources, setIncludeDataSources] = useState<boolean>(false);
    
    
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

   const nameType = type.toLowerCase()

    const {t} = useTranslation('qiSummary');

    const getDataSources = () => {
        if (type === QiSummaryType.CONVERSATION && conversation) {
            return conversation.messages.filter( m => {
                return m.data && m.data.dataSources as AttachedDocument
            }).flatMap(m => m.data.dataSources);
                
        }
        return [];
    }
    
    const handleSubmit = async () => {
        setIsSubmitting(true);
        
        const updatedSummary = { type : type,
                                 summary: summary,
                                 purpose: purpose,
                                 additionalComments: additionalComments || undefined,
                                 numberOfDataSources: dataSourceCount,
                                 includeUser: includeUser
                            } as QiSummary

        if (includeDataSources) {
            updatedSummary.dataSources = getDataSources();
        }
        const response = await uploadToQiS3(uploadData(updatedSummary), type);
        setIsSubmitting(false);
        if (response.success) {
            toast("Successfully submitted quality improvement summary.");
            onSubmit();
        } else {
            alert("Failed to submit quality improvement summary. Please try again...")
        }
    }

    interface QiData {
        qiData: QiSummary;
        conversation?: any;
    }

    const uploadData = (summary: QiSummary) => {
        let data:QiData = { qiData : summary }
        if (type === QiSummaryType.CONVERSATION) {
            data.conversation = {...(includeDataSources ? strippedConversation : conversation), folderId: null}
        }
        return data;

    }


    const label = () => {
        const message = `Quality Improvement Summary for ${type}`;
        switch (type) {
            case QiSummaryType.CONVERSATION:
              return `${message}:  ${conversation?.name}`;
            default:
              return message
          }
    }
             
    return ( <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
              <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="dark:border-neutral-600 inline-block overflow-hidden rounded-lg border border-gray-300 bg-white px-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:w-full sm:max-w-[770px] sm:align-middle">

                        {isSubmitting && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-25">
                                <div className="p-3 flex flex-row items-center  border border-gray-500 bg-[#202123]">
                                    <LoadingIcon style={{ width: "30px", height: "30px" }}/>
                                    <span className="text-lg font-bold ml-2 text-white">Submitting...</span>
                                </div>
                            </div>
                        )}
    
                        
                        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto">

                        <div className="mt-2 mb-4 text-lg font-bold text-black dark:text-neutral-200">
                                {label()}
                            </div>

                        Please review the AI-generated responses and refine or correct them as needed. 

                        <div className="mt-4 text-sm font-bold text-black dark:text-neutral-200">
                                {t(`${type} Summary`)}
                            </div>
                            <textarea
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={`A summary of the overall ${nameType}.`}
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                rows={5}
                            />

                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                {t('Amplify Use Case ')}
                            </div>
                            <textarea
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={`Write the purpose or use case of your ${nameType}.`}
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                rows={5}
                            />


                            <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                {t('Additional Comments')}
                            </div>
                            <textarea
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={`Provide any additional feedback or comments regarding this ${nameType} for quality improvement.`}
                                value={additionalComments}
                                onChange={(e) => setAdditionalComments(e.target.value)}
                                rows={2}
                            />

                            <div className="ml-1 mt-4 flex flex-row gap-3">
                                <label className="text-sm font-bold text-black dark:text-neutral-200"
                                    title={`Data sources attached to this ${nameType} will not be included in the submission.`}>{`Number of Data Sources: ${dataSourceCount}`}</label>
                            </div>

                            {dataSourceCount > 0 && <div className="ml-1 mt-4 flex flex-row gap-3">
                                <input type="checkbox" checked={includeDataSources} onChange={(e) => setIncludeDataSources(e.target.checked)} />
                                <label className="text-sm font-bold text-black dark:text-neutral-200">Include Data Sources</label>
                            </div>}

                            <div className="ml-1 mt-4 flex flex-row gap-3">
                                <input type="checkbox" checked={includeUser} onChange={(e) => setIncludeUser(e.target.checked)} />
                                <label className="text-sm font-bold text-black dark:text-neutral-200">Include my User ID for potential follow-up</label>
                            </div>


                        </div>


                        <div className="flex flex-row items-center justify-end p-4 bg-white dark:bg-[#202123]">
                            <button className="mr-2 w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300" 
                                onClick={onCancel}
                                >Cancel
                            </button>
                            <button className="w-full px-4 py-2 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300" 
                                onClick={handleSubmit}
                                >Submit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        )
        
};

export default QiModal;


