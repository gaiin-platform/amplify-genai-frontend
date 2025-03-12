import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/utilities";
const SERVICE_NAME = "emailAutocomplete";

export const fetchEmailSuggestions = async (queryInput: string) => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/emails",
        queryParams: { emailprefix: queryInput },
        service: SERVICE_NAME
    };
    const result = await doRequestOp(op);
    try {
        return JSON.parse(result.body);
    } catch {
        return null;
    }
}
