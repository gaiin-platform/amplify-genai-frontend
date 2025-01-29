import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/assistant-api";

export const executeAssistantApiCall = async (data: any) => {
    const op = {
        //url: 'http://localhost:3015',
        method: 'POST',
        path: URL_PATH,
        op: "/execute-custom-auto",
        data: data
    };
    return await doRequestOp(op);
}

export const getAsyncResult = async (data: any) => {

    const sleepTime = data.sleepTime || 1000;
    console.log("Sleeping for", sleepTime);
    await new Promise((resolve) => setTimeout(resolve, sleepTime));

    const op = {
        //url: 'http://localhost:3015',
        method: 'POST',
        path: URL_PATH,
        op: "/get-job-result",
        data: data
    };
    return await doRequestOp(op);
}

