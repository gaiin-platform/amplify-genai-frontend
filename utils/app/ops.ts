import {ApiCall, OpDef} from "@/types/op";
import JSON5 from "json5";
import {Message} from "@/types/chat";
import {execOp} from "@/services/opsService";

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

                console.log("Sending remote op request", url)//, payload);

                const response = await execOp(url, payload);

                //const response = await fetch(url, req);
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