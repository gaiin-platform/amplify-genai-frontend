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


export const ConfirmModal: FC<Props> = ({title="", message, height=240, width=450,
                                        confirmLabel="Yes", denyLabel="No", onConfirm, onDeny}) => {

    return <Modal
        title={title}
        content={<div> {message} </div>}
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