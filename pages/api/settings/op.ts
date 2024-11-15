import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";

interface reqPayload {
    method: any, 
    headers: any,
    body?: any
}

const settingsOp =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }


        let apiUrl = process.env.API_BASE_URL + "/state/settings" || "";
        // Accessing itemData parameters from the request
        const reqData = req.body || null;

        const payload = reqData?.data || null;

        const queryPath = typeof req.query.path === 'string' ? req.query.path : ""; 
        if (queryPath) apiUrl += queryPath;

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

        if (payload) reqPayload.body = JSON.stringify({data:payload});

        try {

            const response = await fetch(apiUrl, reqPayload);

            if (!response.ok) throw new Error(`Settings op:${queryPath} failed with status: ${response.status}`);

            const data = await response.json();
            
            res.status(200).json(data);
        } catch (error) {
            console.error("Error calling Settings: ", error);
            res.status(500).json({ error: `Could not perform Settings op` });
        }
    };

export default settingsOp;