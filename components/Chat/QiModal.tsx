// anonymous submission of your chat, -> haiku for summary, then give option to edit it before submitting"

import {useContext, useEffect, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {styled, keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import {Conversation} from "@/types/chat";
import { QiSummary, QiSummaryType } from "@/types/qi";
import {useTranslation} from 'next-i18next';
import { uploadToQiS3 } from '@/services/qiService';
import { AttachedDocument } from "@/types/attacheddocument";
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
    const [summary, setSummary] = useState<string>(qiSummary ? qiSummary.summary : "");
    const [description, setDescription] = useState<string>(qiSummary ? qiSummary.description : "");
    const [feedbackImprovements, setFeedbackImprovements] = useState<string>(qiSummary ? qiSummary.feedbackImprovements :"");
    const [additionalComments, setAdditionalComments] = useState("");
    const [includeDataSources, setIncludeDataSources] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const [conversation, setconversation] = useState<Conversation | null>(null);
    

    const {t} = useTranslation('qiSummary');

    const getDataSources = () => {
        if (type === QiSummaryType.CONVERSATION ) {
             if (selectedConversation) {
                    setconversation({...selectedConversation});
                    return selectedConversation.messages.filter( m => {
                        return m.data && m.data.dataSources as AttachedDocument
                    }).flatMap(m => m.data.dataSources);
                }
        }

        return [];
    }

    const stripDataSources = () => {
        if (type === QiSummaryType.CONVERSATION ) {
            if (selectedConversation) {
                const copy = cloneDeep(selectedConversation);
                copy.messages.forEach(m => {
                    if (m.data && m.data.dataSources) {
                        m.data.dataSources = []; 
                    }
                });
                setconversation(copy);
            }
        }
        return [];
    }


    const handleSubmit = async () => {
        const updatedSummary = 
            {
                type : type,
                summary: summary,
                description: description,
                feedbackImprovements: feedbackImprovements,
                additionalComments: additionalComments || undefined,
                dataSources: includeDataSources ? getDataSources() : stripDataSources()
            }
        setIsSubmitting(true);
        const response = await uploadToQiS3({ qiData : updatedSummary,
                                        conversation : {...conversation, folderId: null}
                                      }, type);
        setIsSubmitting(false);
        if (response.success) {
            alert("Successfully submitted quality improvement summary.");
            onSubmit();
        } else {
            alert("Failed to submit quality improvement summary. Please try again...")
        }
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
                                {t('Description')}
                            </div>
                            <textarea
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={t('A short description of the concern.') || ''}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />

                        <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                {t('Summary')}
                            </div>
                            <textarea
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={t('A summary of the overall conversation and concerns.') || ''}
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                rows={5}
                            />


                            <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                {t('Feedback for Improvements')}
                            </div>
                                <textarea
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={t('Provide any specific feedback.') || ''}
                                value={feedbackImprovements}
                                onChange={(e) => setFeedbackImprovements(e.target.value)}
                                rows={5}
                            />

                            <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                {t('Additional Comments')}
                            </div>
                            <textarea
                                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                style={{resize: 'none'}}
                                placeholder={t('Enter any additional thoughts or concerns.') || ''}
                                value={additionalComments}
                                onChange={(e) => setAdditionalComments(e.target.value)}
                                rows={2}
                            />

                            <div className="ml-1 mt-4 flex flex-row gap-3">
                                <input type="checkbox" checked={includeDataSources} onChange={(e) => setIncludeDataSources(e.target.checked)} />
                                <label className="text-sm font-bold text-black dark:text-neutral-200">Include Data Sources</label>
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


