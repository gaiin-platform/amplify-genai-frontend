import { FC, memo } from "react";
import { RemoteMessages, Props } from "./RemoteMessages";

export const MemoizedRemoteMessages: FC<Props> = memo(
    RemoteMessages,
    (prevProps, nextProps) => (
        prevProps.message.content === nextProps.message.content
    )
);
