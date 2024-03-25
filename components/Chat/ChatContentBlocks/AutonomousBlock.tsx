import {
    IconFileCheck,
} from '@tabler/icons-react';
import React, {useEffect} from "react";

interface Props {
    action: any;
    ready: boolean;
}

const AutonomousBlock: React.FC<Props> = (
    {action, ready}) => {

    useEffect(() => {
        if (ready) {
            //alert("autonomous");
        }
    }, [ready, action]);

    return <div>
        <div
            className="rounded-xl text-neutral-600 border-2 dark:border-none dark:text-white bg-neutral-100 dark:bg-[#343541] rounded-md shadow-lg mb-2 mr-2"
        >
            <div className="text-xl text-right p-4 -mb-10">
                <div className="text-gray-400 dark:text-gray-600">Working...</div>
            </div>
        </div>
    </div>;
};

export default AutonomousBlock;
