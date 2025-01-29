import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/optimizer";


export const optimizePrompt = async (prompt:string, maxPlaceholders:number) => {

    const op = {
        method: 'POST',
        data: {
            prompt: prompt,
            maxPlaceholders: maxPlaceholders
        },
        path: URL_PATH,
        op: "/prompt",
    };
    return await doRequestOp(op);
}

