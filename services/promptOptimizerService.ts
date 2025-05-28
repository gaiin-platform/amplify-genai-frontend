import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/optimizer";
const SERVICE_NAME = "optimizer";
// no longer in use
export const optimizePrompt = async (prompt:string, maxPlaceholders:number) => {

    const op = {
        method: 'POST',
        data: {
            prompt: prompt,
            maxPlaceholders: maxPlaceholders
        },
        path: URL_PATH,
        op: "/prompt",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}
