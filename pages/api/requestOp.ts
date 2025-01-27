import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";
import { transformPayload } from "@/utils/app/data";

interface reqPayload {
    method: any, 
    headers: any,
    body?: any,
}

const requestOp =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Accessing itemData parameters from the request
        const reqData = transformPayload.decode(req.body.data) || {};

        const method = reqData.method || null;
        const payload = reqData.data || null;

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

        if (payload) reqPayload.body = JSON.stringify( { data: payload });

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
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
        .join('&');
      apiUrl += `?${queryString}`;
    }
    console.log(`--- API url Request to: ${apiUrl} ---`);
    return apiUrl;
  };