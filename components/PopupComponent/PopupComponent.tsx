import React, { FC, MouseEvent } from 'react';

interface PopUpComponentProps {
    onClose: (event: MouseEvent<HTMLButtonElement>) => void;
}

const PopUpComponent: FC<PopUpComponentProps> = ({ onClose }) => (
    <div className="popup">
        <div className="popup-content">
            <h2>New Chat Started</h2>

            <button onClick={onClose}>Close</button>
        </div>
    </div>
);

export default PopUpComponent;