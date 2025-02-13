import {
    FC,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import { DEFAULT_ASSISTANT } from "@/types/assistant";
import { useChatService } from "@/hooks/useChatService";
import { getSettings } from '@/utils/app/settings';
import { useSession } from 'next-auth/react';
import { doSaveMemoryBatchOp } from '@/services/memoryService';
import { Settings } from '@/types/settings';
import { Toggle } from '@/components/ReusableComponents/Toggle';
import {
    MemoryType
} from '@/types/memory';

interface Props {
    isFactsVisible: boolean;
    setIsFactsVisible: (isVisible: boolean) => void;
}

export const MemoryPresenter: FC<Props> = ({
    isFactsVisible, setIsFactsVisible }) => {

    const {
        state: { selectedConversation, selectedAssistant, featureFlags, extractedFacts, memoryExtractionEnabled },
        dispatch: homeDispatch
    } = useContext(HomeContext);

    let settingRef = useRef<Settings | null>(null);
    // prevent recalling the getSettings function
    if (settingRef.current === null) settingRef.current = getSettings(featureFlags);

    useEffect(() => {
        const handleEvent = (event: any) => settingRef.current = getSettings(featureFlags)
        window.addEventListener('updateFeatureSettings', handleEvent);
        return () => window.removeEventListener('updateFeatureSettings', handleEvent)
    }, []);

    const [factTypes, setFactTypes] = useState<{ [key: string]: MemoryType }>({});
    // const [selectedProjects, setSelectedProjects] = useState<{ [key: string]: string }>({});
    const [loadingStates, setLoadingStates] = useState<{ [key: number]: string }>({});

    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const handleTypeChange = (index: number, value: MemoryType) => {
        setFactTypes(prev => ({ ...prev, [index]: value }));
    };

    const handleToggleMemoryExtraction = (enabled: boolean) => {
        homeDispatch({
            field: 'memoryExtractionEnabled',
            value: enabled
        });
    };

    const handleSaveFact = async (index: number) => {
        setLoadingStates(prev => ({ ...prev, [index]: 'saving' }));

        const fact = extractedFacts[index];
        const type = factTypes[index] || 'user' as MemoryType;

        let typeID: string;
        switch (type) {
            case 'user':
                if (!userEmail) {
                    throw new Error('User email not available');
                }
                typeID = userEmail;
                break;
            default:
                typeID = type;
        }

        try {
            await doSaveMemoryBatchOp([{
                content: fact.content,
                taxonomy_path: fact.taxonomy_path,
                memory_type: type as MemoryType,
                memory_type_id: typeID
            }]);

            // Rest of the function remains the same
            const updatedFacts = extractedFacts.filter((_, i) => i !== index);
            homeDispatch({ field: 'extractedFacts', value: updatedFacts });

            // Clean up the fact type
            const updatedFactTypes = { ...factTypes };
            delete updatedFactTypes[index];
            setFactTypes(updatedFactTypes);

            // Clear loading state on success
            setLoadingStates(prev => {
                const newState = { ...prev };
                delete newState[index];
                return newState;
            });
        } catch (error) {
            // Clear loading state on error
            setLoadingStates(prev => {
                const newState = { ...prev };
                delete newState[index];
                return newState;
            });
            console.error('Failed to save memory:', error);
            alert('Failed to save memory item');
        }
    };

    const handleDeleteFact = (index: number) => {
        setLoadingStates(prev => ({ ...prev, [index]: 'deleting' }));

        // Remove the fact without saving
        const updatedFacts = extractedFacts.filter((_, i) => i !== index);
        homeDispatch({ field: 'extractedFacts', value: updatedFacts });

        // Clean up the fact type
        const updatedFactTypes = { ...factTypes };
        delete updatedFactTypes[index];
        setFactTypes(updatedFactTypes);

        // Clear loading state
        setLoadingStates(prev => {
            const newState = { ...prev };
            delete newState[index];
            return newState;
        });
    };

    return (
        <>
            <div className="flex flex-col justify-center items-center stretch mx-2 flex flex-row gap-3 last:mb-2 md:mx-4 md:last:mb-6 lg:mx-auto lg:max-w-3xl">
                {featureFlags.memory && settingRef.current?.featureOptions.includeMemory && selectedConversation && selectedConversation.messages?.length > 0 && extractedFacts.length > 0 && (
                    <div>
                        {isFactsVisible &&
                            <div className="extracted-facts">
                                <div className="w-full flex justify-between items-center mb-4 px-4">
                                    <Toggle
                                        label="Auto-extract new memories"
                                        enabled={memoryExtractionEnabled}
                                        onChange={handleToggleMemoryExtraction}
                                        size="small"
                                    />
                                    <button
                                        onClick={() => setIsFactsVisible(false)}
                                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                                    >
                                        Hide facts
                                    </button>
                                </div>
                                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Fact</th>
                                            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Save to memory?</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...extractedFacts].map((fact, index) => (
                                            <tr key={index}>
                                                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{fact.content}</td>
                                                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                                                    <div className="flex justify-center gap-4">
                                                        {loadingStates[index] === 'saving' ? (
                                                            <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleSaveFact(index)}
                                                                // disabled={factTypes[index] === 'project' && !selectedProjects[index]}
                                                                className="hover:opacity-75 transition-opacity"
                                                            >✅</button>
                                                        )}
                                                        {loadingStates[index] === 'deleting' ? (
                                                            <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleDeleteFact(index)}
                                                                className="hover:opacity-75 transition-opacity"
                                                            >❌</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        }
                    </div>
                )}
            </div>
        </>
    )
};