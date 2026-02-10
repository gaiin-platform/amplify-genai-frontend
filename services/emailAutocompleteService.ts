import { doRequestOp } from "./doRequestOp";
import { lzwUncompress, isLzwCompressed } from "@/utils/app/lzwCompression";


const URL_PATH = "/utilities";
const SERVICE_NAME = "emailAutocomplete";
const OBJECT_ACCESS_SERVICE_NAME = "object-access";

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
        let body = result.body && isLzwCompressed(result.body) ? lzwUncompress(result.body) : result.body;
        return JSON.parse(body);
    } catch {
        return null;
    }
}

export const validateUsers = async (userNames: string[]) => {
    const op = {
        method: 'POST',
        data: { user_names: userNames },
        path: URL_PATH,
        op: "/validate_users",
        service: OBJECT_ACCESS_SERVICE_NAME
    };
    return await doRequestOp(op);
}

