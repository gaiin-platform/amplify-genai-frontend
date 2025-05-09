import {
    FC,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import HomeContext from '@/pages/api/home/home.context';
import { getSettings } from '@/utils/app/settings';
import { useSession } from 'next-auth/react';
import { doSaveMemoryOp } from '@/services/memoryService';
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
    if (settingRef.current === null) settingRef.current = getSettings(featureFlags);

    useEffect(() => {
        const handleEvent = (event: any) => settingRef.current = getSettings(featureFlags)
        window.addEventListener('updateFeatureSettings', handleEvent);
        return () => window.removeEventListener('updateFeatureSettings', handleEvent)
    }, []);

    const [factTypes, setFactTypes] = useState<{ [key: string]: MemoryType }>({});
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
            await doSaveMemoryOp([{
                content: fact.content,
                taxonomy_path: fact.taxonomy_path,
                memory_type: type as MemoryType,
                memory_type_id: typeID,
                conversation_id: selectedConversation?.id
            }]);

            const updatedFacts = extractedFacts.filter((_, i) => i !== index);
            homeDispatch({ field: 'extractedFacts', value: updatedFacts });

            const updatedFactTypes = { ...factTypes };
            delete updatedFactTypes[index];
            setFactTypes(updatedFactTypes);

            setLoadingStates(prev => {
                const newState = { ...prev };
                delete newState[index];
                return newState;
            });
        } catch (error) {
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

        const updatedFacts = extractedFacts.filter((_, i) => i !== index);
        homeDispatch({ field: 'extractedFacts', value: updatedFacts });

        const updatedFactTypes = { ...factTypes };
        delete updatedFactTypes[index];
        setFactTypes(updatedFactTypes);

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
                    <div className="w-full">
                        {isFactsVisible && (
                            <div className="text-black dark:text-white extracted-facts bg-white dark:bg-[#343541] rounded-lg shadow-lg flex flex-col">
                                <div className="relative max-h-96 overflow-y-auto pt-0.5">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="sticky -top-1 border border-gray-200 dark:border-gray-600 px-4 py-2 text-left bg-white dark:bg-[#343541] z-10">Fact</th>
                                                <th className="sticky -top-1 border border-gray-200 dark:border-gray-600 px-4 py-2 text-center w-32 bg-white dark:bg-[#343541] z-10">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="px-4">
                                            {extractedFacts.map((fact, index) => (
                                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">{fact.content}</td>
                                                    <td className="border border-gray-200 dark:border-gray-600 px-4 py-2">
                                                        <div className="flex justify-center gap-4">
                                                            {loadingStates[index] === 'saving' ? (
                                                                <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleSaveFact(index)}
                                                                    className="hover:opacity-75 transition-opacity"
                                                                    title="Save memory"
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
                                                                    title="Delete memory"
                                                                >❌</button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="w-full flex justify-between items-center px-4 py-3 border-t border-gray-200 dark:border-gray-600 mt-2 bg-gray-50 dark:bg-gray-700 rounded-b-lg">
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
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};