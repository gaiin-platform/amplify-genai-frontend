import { FC, useState } from 'react';

import { AstGroupTypeData } from '@/utils/app/groups';
import { IconExclamationCircle, IconExclamationMark } from '@tabler/icons-react';

interface Props {
  groupOptionsData: AstGroupTypeData;
  setSelected: (type: string | undefined) => void;
}

export const GroupTypeSelector: FC<Props> = ({ groupOptionsData, setSelected}) => {
    const [groupOptions, setGroupOptions] = useState<string[]>(Object.keys(groupOptionsData));
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const handleSelection = (option: string) => {
        setSelectedOption(option);
        setSelected(groupOptionsData[option].isDisabled ? undefined : option);
    };

    return (
        <div className='flex flex-col'>
            Please select the group you best identify with to start chatting.
            {groupOptions.map((option) => (
                <div key={option} className="mt-2 radio-option">
                    <label>
                        <input
                            className='mr-2'
                            type="radio"
                            value={option}
                            checked={selectedOption === option}
                            onChange={() => handleSelection(option)}
                        />
                        {option}
                    </label>
                </div>
            ))}

            { selectedOption && groupOptionsData[selectedOption].isDisabled && (
                <div className='mt-6 flex flex-row gap-2 flex items-center mx-6 p-2 border border-gray-400 dark:border-gray-500 rounded'>
                    <IconExclamationCircle size={22} className='flex-shrink-0 text-red-600' />
                    {groupOptionsData[selectedOption].disabledMessage || "Conversation is not available for this group."}
                </div>
              
            )

            }
        </div>
    );
}