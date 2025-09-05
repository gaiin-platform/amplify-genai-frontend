import React, { useState } from 'react';
import {
    IconRobot,
    IconAperture
} from '@tabler/icons-react';
import { Status } from "@/types/workflow";

interface StatusDisplayProps {
    statusHistory: Status[];
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({ statusHistory }) => {
    const [isOpen, setIsOpen] = useState(false);

    // If statusHistory is empty, use a default {summary: ''}
    const lastStatus = statusHistory.length > 0 ? statusHistory[statusHistory.length - 1] : {summary: '', message: ''};

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    }

    return (
        <div className="relative">
            {isOpen && (
                <div
                    className="absolute bottom-0 mb-9 w-full border border-neutral-200 rounded overflow-scroll bg-white dark:border-neutral-600 dark:bg-[#343541]"
                    style={{ height: "200px" }}
                >
                    {statusHistory.map((status, index) => (
                        <button key={index}
                        className="mt-3 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white py-2 px-4 text-black hover:opacity-50 dark:text-white dark:border-neutral-600 dark:bg-[#343541] md:mb-2 md:mt-2"
                        >
                        <IconRobot size={16} /> {(status.summary || status.message).slice(0, 100) + "..."}
                        </button>
                    ))}
                </div>
            )}
            {statusHistory.length > 0 && (
                <button
                    className="mt-6 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white py-2 px-4 text-black hover:opacity-50 dark:text-white dark:border-neutral-600 dark:bg-[#343541] md:mb-0 md:mt-2"
                    onClick={toggleDropdown}
                >
                    <IconAperture size={16} /> {(lastStatus.summary || lastStatus.message).slice(0, 35) + "..."}
                </button>
            )}
        </div>
    );
}

export default StatusDisplay;