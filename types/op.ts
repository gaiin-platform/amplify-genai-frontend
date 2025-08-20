
export interface Schema {
    type: string;
    properties: {
      [key: string]: {
        type: string;
        [key: string]: any;
      };
    };
    required?: string[];
}

export type OpBindingMode = "ai" | "manual";

export interface OpBindings {
    [key: string] : {"value": string, "mode": OpBindingMode}
}

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

export interface Reference {
    id: string;
    type: string;
    object: any;
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
    data?: OpData;
    tag?: string;
    tags?: string[];
    parameters: Schema;
    output?: Schema;
    bindings?: OpBindings

}

export interface Op extends OpDef {
    paramChecker: (params: any) => boolean;
    execute: (context: OpContext, params: any) => Promise<OpResult>;
}



export const opLanguageOptionsMap = (featureFlags: any) => {
    const languageMap: any = {
        v1 : "Standard",
        custom : "Custom"
    }
    if (featureFlags.agentAssistantType)  languageMap.v4 = "Agent";
    return languageMap;
}