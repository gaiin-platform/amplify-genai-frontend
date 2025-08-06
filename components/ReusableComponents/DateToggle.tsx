import { userFriendlyDate } from "@/utils/app/date";
import { useState } from "react";

export const DateToggle: React.FC<{ dateString: string }> = ({ dateString }) => {
    const [showLocalTime, setShowLocalTime] = useState(true);
    
    const utcDisplay = dateString;
    const localDisplay = userFriendlyDate(dateString);
    
    return (
        <span 
            className="inline-flex items-center gap-1 text-blue-500 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 rounded-md transition-all duration-150"
            onClick={() => setShowLocalTime(!showLocalTime)}
            title={`Click to toggle between UTC and local time. Currently showing: ${showLocalTime ? 'Local Time' : 'UTC'}`}
        >
            <span className="font-mono text-sm">
                {showLocalTime ? localDisplay : utcDisplay}
            </span>
            <span className="text-xs opacity-60">
            </span>
        </span>
    );
};