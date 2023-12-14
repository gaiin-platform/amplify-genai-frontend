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
};

const ExpansionComponent: React.FC<ExpansionProps> = ({ title, content, openWidget, closedWidget }) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);

    const handleToggle = (): void => {
        setIsOpen(!isOpen);
    };

    return (
        <>
            <button onClick={handleToggle} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                {isOpen ?
                    ((openWidget) ? openWidget : <IconCaretDown size={18} />) :
                    ((closedWidget) ? closedWidget : <IconCaretRight size={18} />)
                }
                <span style={{marginLeft: '10px'}}>
          {title}
        </span>
            </button>

            {isOpen && (
                <div style={{marginTop: '10px'}} className="border-l ml-2 pl-4">
                    {content}
                </div>
            )}
        </>
    );
}

export default ExpansionComponent;