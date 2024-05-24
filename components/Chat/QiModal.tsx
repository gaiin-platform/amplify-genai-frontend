// anonymous submission of your chat, -> haiku for summary, then give option to edit it before submitting"

import {useContext, useEffect, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {styled, keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import {Conversation} from "@/types/chat";
import { QiSummary, QiSummaryType } from "@/types/qi";
import {useTranslation} from 'next-i18next';
import { uploadToQiS3 } from '@/services/qiService';
import cloneDeep from 'lodash/cloneDeep';


const animate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(720deg);
  }
`;

const LoadingIcon = styled(FiCommand)`
  color: lightgray;
  font-size: 1rem;
  animation: ${animate} 2s infinite;
`;



interface QiModalProps {
    qiSummary: QiSummary | null
    onSubmit: () => void;
    onCancel: () => void;
    type: QiSummaryType;
}


const QiModal: React.FC<QiModalProps> = ({qiSummary, onSubmit, onCancel, type}) => {
    const {state:{selectedConversation}} = useContext(HomeContext);
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [dataSourceCount, setDataSourceCount] =  useState<Number>(0);

    useEffect(() => {
        const stripDataSources = () => {
            if (type === QiSummaryType.CONVERSATION) {
                if (selectedConversation) {
                    let dsCount = 0;
                    const copy = cloneDeep(selectedConversation);

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
                    setConversation(copy);
                }
            }
        };
        
        if (!conversation) stripDataSources();
    }, [type]); 

    const [summary, setSummary] = useState<string>(qiSummary ? qiSummary.summary : "");
    const [purpose, setPurpose] = useState<string>(qiSummary ? qiSummary.purpose :"");
    const [additionalComments, setAdditionalComments] = useState<string>("");
    
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    

   

    const {t} = useTranslation('qiSummary');
    
    const handleSubmit = async () => {
        setIsSubmitting(true);
        
        const updatedSummary = { type : type,
                                 summary: summary,
                                 purpose: purpose,
                                 additionalComments: additionalComments || undefined,
                                 numberOfDataSources: dataSourceCount
                            } as QiSummary
        const response = await uploadToQiS3(uploadData(updatedSummary), type);
        setIsSubmitting(false);
        if (response.success) {
            alert("Successfully submitted quality improvement summary.");
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
            data.conversation = {...conversation, folderId: null}
        }
        return data;

    }


    const label = () => {
        const message = "Quality Improvement Summary";
        switch (type) {
            case QiSummaryType.CONVERSATION:
              return `${message} for Conversation:  ${selectedConversation?.name}`;
            default:
              return message
          }
    }
             
    return ( <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
              <div className="fixed inset-0 z-10 overflow-hidden">
                <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                    <div className="dark:border-netural-400 inline-block overflow-hidden rounded-lg border border-gray-300 bg-white px-4 pt-5 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:w-full sm:max-w-[770px] sm:align-middle">
                        
                        {isSubmitting && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-25">
                                <div className="p-3 flex flex-row items-center  border border-gray-500 dark:bg-[#202123]">
                                    <LoadingIcon style={{ width: "30px", height: "30px" }}/>
                                    <span className="text-lg font-bold ml-2 text-white">Submitting...</span>
                                </div>
                            </div>
                        )}
    
                        
                        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto">

                        <div className="mt-2 text-lg font-bold text-black dark:text-neutral-200">
                                {label()}
                            </div>


                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                {t('Conversation Summary')}
                            </div>
                            <textarea
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={t('A summary of the overall conversation.') || ''}
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
                                placeholder={t('Write the purpose or use case of your conversation.') || ''}
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
                                placeholder={t('Provide any additional feedback or comments regarding this conversation for quality improvement.') || ''}
                                value={additionalComments}
                                onChange={(e) => setAdditionalComments(e.target.value)}
                                rows={2}
                            />

                            <div className="ml-1 mt-4 flex flex-row gap-3">
                                <label className="text-sm font-bold text-black dark:text-neutral-200"
                                    title='Data sources attached to this conversation will not be included in the submission.'>{`Number of Data Sources: ${dataSourceCount}`}</label>
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


