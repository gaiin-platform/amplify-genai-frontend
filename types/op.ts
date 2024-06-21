import {Conversation} from "@/types/chat";

export interface OpContext {
    [key: string]: any;
}

export interface OpResult {
    [key: string]: any;
    message: string;
}

export interface ApiCall {
    functionName: string;
    params: any[];
    code: string;
}

export interface OpData {
    shouldConfirm?: boolean;
    includeConversation?: boolean;
    includeMessage?: boolean;
    includeAccessToken?: boolean;
    [key: string]: any;
}

export interface OpDef {
    id: string;
    name: string;
    url: string;
    method?: string;
    description: string;
    type: string;
    params: Record<string, string>[];
    data?: OpData;
}

export interface Op extends OpDef {
    paramChecker: (params: any) => boolean;
    execute: (context: OpContext, params: any) => Promise<OpResult>;
}
