import { ExportFormatV4 } from "@/types/export";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/chat";
const SERVICE_NAME = "download";

export interface ConversionOptions {
    format: string;
    userHeader: string;
    assistantHeader: string;
    messageHeader: string;
    conversationHeader: string;
    templateName?: string;
    includeConversationName?: boolean;
}

export const convert = async (options: ConversionOptions, content: ExportFormatV4) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/convert",
        data: { ...options, content: content },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}
