import { FC, ReactElement } from "react";
import { Modal } from "./Modal";





interface Props {
    title?: string;
    message: string;
    confirmLabel?: string;
    denyLabel?: string;
    onConfirm: () => void;
    onDeny: () => void;
    height?: number;
    width?: number;
}


export const ConfirmModal: FC<Props> = ({title="", message, height=260, width=450,
                                        confirmLabel="Yes", denyLabel="No", onConfirm, onDeny}) => {

    return <Modal
        title={title}
        content={<div className="text-black dark:text-white"> {message} </div>}
        width={() => width}
        height={() => height}
        showClose={false}
        showCancel={false}
        showSubmit={false}
        additionalButtonOptions={[ {label: confirmLabel, handleClick: onConfirm}, 
                                   {label: denyLabel, handleClick: onDeny}
                                ]}
    />
}