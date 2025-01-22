import {ApiCall, OpDef, Reference} from "@/types/op";
import JSON5 from "json5";
import {Message} from "@/types/chat";
import {execOp} from "@/services/opsService";

// Reference types
export const DATASOURCE_TYPE = "#$"
export const OP_TYPE = "#!"
export const ASSISTANT_TYPE = "#@"

export const remoteOpHandler = (opDef:OpDef) => {

    console.log("Building remote op handler", opDef);

    const opData = opDef.data || {};

    const url = opDef.url;
    const method = opDef.method || "POST";
    const defaultErrorMessage = opData.defaultErrorMessage;
    const includeMessage = opData.includeMessage;
    const includeConversation = opData.includeConversation;
    const includeAccessToken = opData.includeAccessToken;
    const shouldConfirm = opData.shouldConfirm;
    const confirmationMessage = opData.confirmationMessage || "Do you want to allow the assistant to perform the specified operation?";

    return async (params:any) => {
        if(!shouldConfirm || confirm(confirmationMessage)){

            const headers = {
                "Content-Type": "application/json"
            }
            if (includeAccessToken){
                console.log("Including access token");
                // @ts-ignore
                headers["Authorization"] = `Bearer ${session?.accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
            }

            const req:Record<string,any> = {
                method,
                headers
            };

            const payload:Record<string,any> = {};

            // params = params.slice(1); // The first param is the operation name
            for (let i = 0; i < opDef.params.length; i++) {
                const paramDef = opDef.params[i];
                console.log(`paramDef ${i}:`, paramDef);
                try {
                    payload[paramDef.name] = JSON5.parse(params[i]);
                } catch (e) {
                    payload[paramDef.name] = params[i];
                }
                console.log(`payload ${i}:`, payload[paramDef.name]);
            }

            try {

                const response = await execOp(url, method, payload)

                if (response) {
                    return response;
                } else {
                    return {
                        success: false,
                        result: defaultErrorMessage || response.statusText
                    }
                }
            } catch (e) {
                console.error("Error invoking remote op:", e);
                return {
                    success: false,
                    result: defaultErrorMessage || `${e}`
                }
            }
        }
        else {
            return {success:false, result:"The user canceled the operation and asked you to stop."}
        }
    };
}


export const getServerProvidedOps = (message:Message) => {
    return (message.data && message.data.state) ?
        message.data.state.resolvedOps : [];
}

export const getServerProvidedOpFormat = (message:Message) => {
    return (message.data && message.data.state) ?
        message.data.state.opsConfig : [];
}

export const getServerProvidedReferences = (message:Message): Reference[] => {
    return (message.data && message.data.state) ?
        message.data.state.references : [];
}

export const resolveServerHandler = (message:Message, id:string) => {
    const serverResolvedOps = getServerProvidedOps(message);

    if(!serverResolvedOps || serverResolvedOps.length === 0){
        return null;
    }

    const opDef = serverResolvedOps.find(
        (op:any) => op.id === id || op.id === "/"+id
    );

    return opDef ? remoteOpHandler(opDef) : null;
}

export const resolveOpDef = (message:Message, id:string) => {
    const serverResolvedOps = getServerProvidedOps(message);

    if(!serverResolvedOps || serverResolvedOps.length === 0){
        return null;
    }

    const opDef = serverResolvedOps.find(
        (op:any) => op.id === id || op.id === "/"+id
    );

    return opDef;
}

export function getApiCalls(context:{[key:string]:any}, message:Message, action:string):ApiCall[] {
    const opConfig = getServerProvidedOpFormat(message);
    const apiCalls: ApiCall[] = [];

    if(opConfig && opConfig.opFormat && opConfig.opFormat.type === "regex"){
            const opFormat = opConfig.opFormat;

            const regex = new RegExp(opFormat.opPattern, 'g');
            let match;

            while ((match = regex.exec(action)) !== null) {
                const op = match[opFormat.opIdGroup];
                let args = match[opFormat.opArgsGroup];

                const refs = getServerProvidedReferences(message) || [];

                const messageIdMapping = message.data &&
                                         message.data.state &&
                                         message.data.state.messageIdMapping ?
                    message.data.state.messageIdMapping : null;

                if(context.conversation && messageIdMapping) {

                    Object.keys(messageIdMapping).forEach((shortMsgId:string) => {

                        const refMessageId = messageIdMapping[shortMsgId];
                        const refMessage = context.conversation.messages.find((m:Message) => m.id === refMessageId);

                        if(refMessage) {
                            const messageText = refMessage.content;
                            const escaped = JSON.stringify(messageText);
                            const trimmed = escaped.substring(1, escaped.length - 1);
                            args = args.replaceAll(`%^${shortMsgId}`, trimmed);
                        }
                    })
                }

                refs.forEach(ref => {
                    const refId = ref.id;
                    const refType = ref.type || "#$";
                    const refObject = ref.object;

                    // Check if refId or refType or refObject is undefined
                    if(refId !== undefined || refType !== undefined || refObject !== undefined) {
                        const jsonValueStr = JSON.stringify(JSON.stringify(refObject));
                        args = args.replaceAll("\""+refType + refId+"\"", jsonValueStr);
                        args = args.replaceAll(refType + refId, jsonValueStr);

                        const linesEscaped = jsonValueStr.split("\n").join("\\n");
                        args = args.replaceAll("\"\\"+refType + refId+"\"", linesEscaped);
                        args = args.replaceAll("\\"+refType + refId, linesEscaped);
                    }

                });


                let params = [];
                try {
                    console.log("Raw params:", args)
                    params = JSON5.parse("[" + args + "]");
                    console.log("Resolved params:", params);
                } catch (e) {
                    console.error("Error parsing args:", e);
                    params = args.split(",");
                }

                const apiCall:ApiCall = {
                    functionName: op,
                    params,
                    code: match[0]
                }
                apiCalls.push(apiCall);
            }

            return apiCalls;
    } else {
            return parseApiCalls(action);
    }
}

export function parseApiCall(str:string):ApiCall  {
    if(str.startsWith("do(") && str.endsWith(")")) {
        const functionName = str.split("(")[0];
        const paramsStr = str.substring(str.indexOf('(') + 1, str.lastIndexOf(')'));
        const params = JSON5.parse("[" + paramsStr + "]");
        return {functionName:params[0], params:params.slice(1), code:str};
    }
    else {
        const functionName = str.split("(")[0];
        const paramsStr = str.substring(str.indexOf('(') + 1, str.lastIndexOf(')'));
        const params = JSON5.parse("[" + paramsStr + "]");
        return {functionName, params, code:str};
    }
}

export function parseApiCalls(str:string):ApiCall[] {
    const calls = str.split("\n").map(a => {
        if(a.trim().indexOf("(") > 0) {
            try {
                return parseApiCall(a);
            } catch (e) {
                return null;
            }
        }
        return null;
    }).filter(a => a !== null) as ApiCall[];
    return calls;
}

export function resolveOp(id:string, message:Message) {
    const serverHandler = resolveServerHandler(message, id);

    if(serverHandler){
        return serverHandler;
    }

    return null;
}