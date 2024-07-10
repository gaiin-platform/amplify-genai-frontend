import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";

interface reqPayload {
    method: any, 
    headers: any,
    body?: any
}

const getApikeysOp =
    async (req: NextApiRequest, res: NextApiResponse) => {
        console.log("____________!!!");

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        let apiUrl = process.env.API_BASE_URL + "/apiKeys" || "";
        console.log("API url: ", apiUrl);

        const queryPath = typeof req.query.path === 'string' ? req.query.path : ""; 
        const apikeyId = req.query.apiKeyId;
        console.log("API url: ", apiUrl);

        const queryapiKeyId = apikeyId && typeof apikeyId === 'string' ? apikeyId: "";
        console.log("API url: ", apiUrl);

        
        if (queryPath) apiUrl += queryPath;
        if (queryapiKeyId) apiUrl += `?apiKeyId=${encodeURIComponent(queryapiKeyId)}`

        console.log("API url: ", apiUrl);
        // @ts-ignore
        const { accessToken } = session;

        let reqPayload: reqPayload = {
            method: req.method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}` 
            },
        }

        try {

            const response = await fetch(apiUrl, reqPayload);

            if (!response.ok) throw new Error(`Request failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json(data);
        } catch (error) {
            console.error("Error calling get api key(s): ", error);
            res.status(500).json({ error: `Could not perform api keys op` });
        }
    };

export default getApikeysOp;