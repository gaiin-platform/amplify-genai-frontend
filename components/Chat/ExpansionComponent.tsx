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
};

const ExpansionComponent: React.FC<ExpansionProps> = ({ title, content, openWidget, closedWidget, isOpened=false }) => {
    const [isOpen, setIsOpen] = useState<boolean>(isOpened);

    const handleToggle = (): void => {
        setIsOpen(!isOpen);
    };

    return (
        <>
            <button onClick={handleToggle} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            title={isOpen ? "Collapse" : "Expand"}
            >
                {isOpen ?
                    ((openWidget) ? openWidget : <IconCaretDown size={18} />) :
                    ((closedWidget) ? closedWidget : <IconCaretRight size={18} />)
                }
                <span style={{marginLeft: '10px'}}>
          {title}
        </span>
            </button>

            {isOpen && (
                <div style={{marginTop: '10px'}} className="border-l ml-2 pl-4" title="View Item">
                    {content}
                </div>
            )}
        </>
    );
}

export default ExpansionComponent;