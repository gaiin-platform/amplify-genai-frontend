import React, { useState } from "react";

type ExpansionProps = {
    title: string;
    content: any;
};

const ExpansionComponent: React.FC<ExpansionProps> = ({ title, content }) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);

    const handleToggle = (): void => {
        setIsOpen(!isOpen);
    };

    return (
        <>
            <button onClick={handleToggle} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                {isOpen ? '↓' : '→'}
                <span style={{marginLeft: '10px'}}>
          {title}
        </span>
            </button>

            {isOpen && (
                <div style={{marginTop: '10px'}}>
                    {content}
                </div>
            )}
        </>
    );
}

export default ExpansionComponent;