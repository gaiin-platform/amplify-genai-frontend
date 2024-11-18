import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";

interface reqPayload {
    method: any, 
    headers: any,
    body?: any
}

const adminOps =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        let apiUrl = 'http://localhost:3016/dev/admin'
        //process.env.API_BASE_URL + "/admin" || "";

        const reqData = req.body;
        const queryPath = reqData.op;
        apiUrl += queryPath;

        // console.log("API url: ", apiUrl);
        // @ts-ignore
        const { accessToken } = session;

        let reqPayload: reqPayload = {
            method: reqData.method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}` 
            },
        }
        
        if (reqData.data) reqPayload.body = JSON.stringify({data: reqData.data});

        try {

            const response = await fetch(apiUrl, reqPayload);

            if (!response.ok) throw new Error(`Request failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json(data);
        } catch (error) {
            console.error("Error calling admin get calls: ", error);
            res.status(500).json({ error: `Could not perform admin Op` });
        }
    };

export default adminOps;