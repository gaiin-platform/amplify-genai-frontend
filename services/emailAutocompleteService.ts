import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/utilities";


export const fetchEmailSuggestions = async (queryInput: string) => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/emails",
        queryParams: {emailprefix : queryInput}
    };
    const result = await doRequestOp(op);
    try {
        return JSON.parse(result.body);
    } catch {
        return null;
    }
}
