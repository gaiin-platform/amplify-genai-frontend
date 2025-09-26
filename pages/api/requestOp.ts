import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";
import { transformPayload } from "@/utils/app/data";
import { lzwCompress } from "@/utils/app/lzwCompression";

interface reqPayload {
    method: any, 
    headers: any,
    body?: any,
}

// Paths that should not be compressed
const NO_COMPRESSION_PATHS = ['/billing', '/se', "/amp", '/vu-agent', "/user-data", "/data-disclosure"];


const requestOp =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Accessing itemData parameters from the request
        const reqData = req.body.data || {};

        const method = reqData.method || null;
        let payload = reqData.data ? transformPayload.decode(reqData.data) : null;

        const apiUrl = constructUrl(reqData);
        // @ts-ignore
        const { accessToken } = session;

        let reqPayload: reqPayload = {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}` 
            },
        }

        if (payload) {
            const shouldCompress = !NO_COMPRESSION_PATHS.includes(reqData.path);
            
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
            reqPayload.body = JSON.stringify( { data: payload });

        }

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


const constructUrl = (data: any) => {  
    let apiUrl = data.url ?? (process.env.API_BASE_URL || "");

    const path: string = data.path || "";
    const op: string = data.op || "";

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