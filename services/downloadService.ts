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

// Converter errors can contain pandoc internals and temp paths; show a short, readable line.
export const friendlyConversionError = (raw: string): string => {
    const firstLine = (raw || "").trim().split("\n")[0] || "";
    const cleaned = firstLine.replace(/(\/[\w.\-]+){2,}/g, "").replace(/\s+/g, " ").trim();
    return cleaned.length > 200 ? cleaned.slice(0, 200) + "…" : cleaned;
};

export type ConvertedFileOutcome =
    | { status: 'ready' }
    | { status: 'failed'; reason: string }   // converter wrote an error marker
    | { status: 'timeout' }                  // never showed up in time
    | { status: 'unreachable' }              // network error while polling
    | { status: 'stopped' };                 // caller asked us to stop (e.g. modal closed)

export interface WaitForConvertedFileOptions {
    shouldStop?: () => boolean;
    maxTries?: number;
    intervalMs?: number;
}

/**
 * Polls until the converted file at `url` exists. The converter writes a small marker at
 * `errorUrl` when it fails, so we can report the real reason instead of waiting for the timeout.
 */
export const waitForConvertedFile = async (
    url: string,
    errorUrl?: string,
    { shouldStop, maxTries = 90, intervalMs = 1000 }: WaitForConvertedFileOptions = {},
): Promise<ConvertedFileOutcome> => {
    for (let tries = 0; tries < maxTries; tries++) {
        if (shouldStop?.()) return { status: 'stopped' };
        try {
            const result = await fetch(url);
            if (result.ok) return { status: 'ready' };

            if (errorUrl) {
                try {
                    const errorResult = await fetch(errorUrl);
                    if (errorResult.ok) {
                        return { status: 'failed', reason: friendlyConversionError(await errorResult.text()) };
                    }
                } catch (e) {
                    // marker not readable yet - keep polling for the output
                }
            }
        } catch (e) {
            return { status: 'unreachable' };
        }
        if (tries < maxTries - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return { status: 'timeout' };
};
