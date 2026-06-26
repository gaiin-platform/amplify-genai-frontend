import React, {ReactNode, useState} from "react";
import {
    IconCaretDown,
    IconCaretRight,
} from '@tabler/icons-react';

type ExpansionProps = {
    title: string;
    content: any;
    openWidget?: ReactNode;
    closedWidget?: ReactNode;
    isOpened?: boolean;
    onOpen? : () => void;
    onClose? : () => void;
};

const ExpansionComponent: React.FC<ExpansionProps> = ({ title, content, openWidget, closedWidget, isOpened=false, onOpen, onClose}) => {
    const [isOpen, setIsOpen] = useState<boolean>(isOpened);

    const handleToggle = (): void => {
        if (isOpen && onClose) onClose();
        if (!isOpen && onOpen) onOpen();
        setIsOpen(!isOpen);
    };

    return (
        <>
            <button onClick={handleToggle} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            className="group text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            title={isOpen ? "Collapse" : "Expand"}
            id="expandComponent"
            >
                {isOpen ?
                    ((openWidget) ? openWidget : <IconCaretDown size={18} />) :
                    <div className="icon-pop-group">{(closedWidget) ? closedWidget : <IconCaretRight size={18} />}</div>
                }
                <span className="font-medium" style={{marginLeft: '8px'}}>
                    {title}
                </span>
            </button>

            {isOpen && (
                <div style={{marginTop: '8px'}} className="border-l border-gray-300 dark:border-gray-600 ml-2 pl-4" title="View Item">
                    {content}
                </div>
            )}
        </>
    );
}

export default ExpansionComponent;