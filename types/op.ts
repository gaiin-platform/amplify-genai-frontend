import {Conversation} from "@/types/chat";

export interface OpContext {
    [key: string]: any;
}

export interface OpResult {
    [key: string]: any;
    message: string;
}

export interface OpData {
    shouldConfirm?: boolean;
    [key: string]: any;
}

export interface OpDef {
    id: string;
    name: string;
    description: string;
    type: string;
    params: Record<string, string>; // An empty object, or possibly a more specific type if needed.
    data?: OpData;
}

export interface Op extends OpDef {
    paramChecker: (params: any) => boolean;
    execute: (context: OpContext, params: any) => Promise<OpResult>;
}
