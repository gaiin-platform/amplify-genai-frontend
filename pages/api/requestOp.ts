import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";
import { transformPayload } from "@/utils/app/data";
import { lzwCompress } from "@/utils/app/lzwCompression";
import { validateUrlForSSRF } from "@/utils/app/urlValidation";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb' // Increased limit for large conversations
        }
    }
}

interface reqPayload {
    method: any,
    headers: any,
    body?: any,
}

// Paths that should not be compressed
const NO_COMPRESSION_PATHS = ['/billing', '/se', "/amp", '/vu-agent', "/user-data", "/data-disclosure", "/integrations", "/notebook"];

const MCP_URL_OPS = new Set(['/mcp/servers/test', '/mcp/servers', '/mcp/server/update']);

const validateMCPPayloadUrl = (path: string, op: string, payload: any): string | null => {
    if (path !== '/integrations' || !MCP_URL_OPS.has(op)) {
        return null;
    }

    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const candidate = typeof payload.url === 'string'
        ? payload.url
        : (payload.data && typeof payload.data.url === 'string' ? payload.data.url : null);

    if (!candidate) {
        return null;
    }

    const result = validateUrlForSSRF(candidate);
    if (!result.valid) {
        return result.error || 'Invalid MCP server URL';
    }

    return null;
};


const requestOp =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Accessing itemData parameters from the request
        const reqData = req.body.data || {};
        const pollRequestId = req.body.pollRequestId;  // Extract pollRequestId at top level

        const method = reqData.method || null;
        let payload = reqData.data ? transformPayload.decode(reqData.data) : null;

        const reqPath: string = reqData.path || '';
        const reqOp: string = reqData.op || '';
        const ssrfError = validateMCPPayloadUrl(reqPath, reqOp, payload);
        if (ssrfError) {
            console.warn(`Blocked unsafe MCP URL for path=${reqPath} op=${reqOp}: ${ssrfError}`);
            return res.status(400).json({ error: ssrfError });
        }

        // @ts-ignore
        const { accessToken } = session;

        let reqPayload: reqPayload = {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
            },
        }

        if (payload) {
            // Use originalPath if available (set when running locally), otherwise use path
            const pathToCheck = reqData.originalPath || reqData.path;
            const shouldCompress = !NO_COMPRESSION_PATHS.includes(pathToCheck);

            if (shouldCompress) {
                try {
                    if (typeof payload === 'object') {
                        payload = lzwCompress(JSON.stringify(payload));
                        console.log("Compressed payload");
                    } else if (typeof payload === 'string' && payload.length > 1000) {
                        // Compress large strings
                        payload = lzwCompress(payload);
                        console.log("Compressed payload");
                    }
                } catch (e) {
                    console.error("Error in requestOp: ", e);
                    console.log("Sending uncompressed payload");
                }
            } else {
                console.log(`Skipping compression for path: ${reqData.path}`);
            }

            // Include pollRequestId if present (for polling support)
            const bodyData: any = { data: payload };
            if (pollRequestId) {
                bodyData.pollRequestId = pollRequestId;
                console.log(`Including pollRequestId in backend request: ${pollRequestId}`);
            }
            reqPayload.body = JSON.stringify(bodyData);
        }

        const apiUrl = constructUrl(reqData);

        try {
            const response = await fetch(apiUrl, reqPayload);

            if (!response.ok) throw new Error(`Request to ${apiUrl} failed with status: ${response.status}`);

            const responseData = await response.json();

            const encodedResponse = transformPayload.encode(responseData);

            res.status(200).json({ data: encodedResponse });
        } catch (error) {
            console.error("Error in requestOp: ", error);
            res.status(500).json({ error: `Could not perform requestOp` });
        }
    };

export default requestOp;


const sanitizePathSegment = (segment: string): string => {
    // Iteratively decode URL-encoded characters to handle multi-layer encoding
    // (e.g., %252e%252e → %2e%2e → ..)
    let decoded = segment;
    let prev = '';
    const MAX_DECODE_ITERATIONS = 5;
    for (let i = 0; i < MAX_DECODE_ITERATIONS && decoded !== prev; i++) {
        prev = decoded;
        try {
            decoded = decodeURIComponent(decoded);
        } catch {
            break;
        }
    }
    // Normalize backslashes to forward slashes (WHATWG URL spec treats \ as / in paths,
    // so attackers can use %5c or literal \ to bypass forward-slash-only splitting)
    const normalized = decoded.replace(/\\/g, '/');
    // Remove path traversal sequences after full decoding and normalization
    // Filter any "." or ".." path components to prevent directory traversal
    const sanitized = normalized
        .split('/')
        .filter(part => part !== '..' && part !== '.')
        .join('/');
    return sanitized;
};

const constructUrl = (data: any) => {
    let apiUrl = process.env.API_BASE_URL || "";

    const path: string = sanitizePathSegment(data.path || "");
    const op: string = sanitizePathSegment(data.op || "");

    apiUrl += path + op;

    const queryParams: { [key: string]: string } | undefined = data.queryParams;

    if (queryParams && Object.keys(queryParams).length > 0) {
      const queryString = Object.keys(queryParams)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent( transformPayload.decode(queryParams[key]) )}`)
        .join('&');
      apiUrl += `?${queryString}`;
    }
    console.log(`--- API url Request to: ${apiUrl} ---`);
    return apiUrl;
  };