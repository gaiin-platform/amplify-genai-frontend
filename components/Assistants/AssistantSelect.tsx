import { FC, useEffect, useRef } from 'react';

import { useTranslation } from 'next-i18next';
import {Assistant, AssistantProviderID} from "@/types/assistant";
import { LayeredAssistant } from '@/types/layeredAssistant';

interface Props {
    assistant: Assistant | null;
    availableAssistants: Assistant[];
    layeredAssistants?: LayeredAssistant[];
    onAssistantChange: (assistant: Assistant) => void;
    onLayeredAssistantChange?: (la: LayeredAssistant) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLSelectElement>) => void;
}

// Prefix used to distinguish layered assistant values in the <select>
const LA_PREFIX = '__la__:';

export const AssistantSelect: FC<Props> = ({
                                            assistant,
                                            availableAssistants,
                                            layeredAssistants = [],
                                            onAssistantChange,
                                            onLayeredAssistantChange,
                                            onKeyDown,
                                        }) => {
    const { t } = useTranslation('chat');

    const selectRef = useRef<HTMLSelectElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
        const selectElement = selectRef.current;
        const optionCount = selectElement?.options.length || 0;

        if (e.key === '/' && e.metaKey) {
            e.preventDefault();
            if (selectElement) {
                selectElement.selectedIndex =
                    (selectElement.selectedIndex + 1) % optionCount;
                selectElement.dispatchEvent(new Event('change'));
            }
        } else if (e.key === '/' && e.shiftKey && e.metaKey) {
            e.preventDefault();
            if (selectElement) {
                selectElement.selectedIndex =
                    (selectElement.selectedIndex - 1 + optionCount) % optionCount;
                selectElement.dispatchEvent(new Event('change'));
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectElement) {
                selectElement.dispatchEvent(new Event('change'));
            }

            onAssistantChange(
                availableAssistants.find(
                    (a) =>
                        a.id === selectElement?.selectedOptions[0].innerText,
                ) as Assistant,
            );
        } else {
            onKeyDown(e);
        }
    };

    useEffect(() => {
        if (selectRef.current) {
            selectRef.current.focus();
        }
    }, []);

    // Determine the current select value — layered assistants use the LA_PREFIX
    const currentValue = assistant?.definition?.data?.isLayeredAssistant
        ? `${LA_PREFIX}${assistant.id}`
        : (assistant?.id || '');

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val.startsWith(LA_PREFIX)) {
            const publicId = val.slice(LA_PREFIX.length);
            const la = layeredAssistants.find(x => x.publicId === publicId);
            if (la && onLayeredAssistantChange) onLayeredAssistantChange(la);
        } else {
            onAssistantChange(
                availableAssistants.find((a) => a.id === val) as Assistant,
            );
        }
    };

    return (
        <div className="flex flex-col">
            <div id="selectConversationAssistant" className="mb-1 w-full rounded border border-neutral-200 bg-transparent pr-2 text-neutral-900 dark:border-neutral-600 dark:text-white">
                <select
                    ref={selectRef}
                    className="w-full cursor-pointer bg-transparent p-2"
                    placeholder={t('Standard Conversation') || ''}
                    value={currentValue}
                    onChange={handleChange}
                    onKeyDown={(e) => {
                        handleKeyDown(e);
                    }}
                >
                    <option
                        key={AssistantProviderID.AMPLIFY}
                        value={AssistantProviderID.AMPLIFY}
                        id="standardConversation"
                        className="dark:bg-[#343541] dark:text-white"
                    >
                        Standard Conversation
                    </option>

                    {availableAssistants.map((a) => (
                        <option
                            key={a.id}
                            value={a.id}
                            className="dark:bg-[#343541] dark:text-white"
                            id="assistantName"
                        >
                            {a.definition.name}
                        </option>
                    ))}

                    {layeredAssistants.length > 0 && (
                        <optgroup label="── Layered Assistants ──" className="dark:bg-[#343541] dark:text-white">
                            {layeredAssistants.map((la) => (
                                <option
                                    key={la.publicId || la.id}
                                    value={`${LA_PREFIX}${la.publicId}`}
                                    className="dark:bg-[#343541] dark:text-white"
                                >
                                    {la.name}
                                </option>
                            ))}
                        </optgroup>
                    )}
                </select>
            </div>
        </div>
    );
};
