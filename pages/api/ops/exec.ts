import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";


const opExec =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { accessToken } = session;

        // Accessing itemData parameters from the request
        const reqData = req.body;
        const payload = reqData.data;
        const path = reqData.path;

        let apiUrl = process.env.API_BASE_URL + path || "";

        try {

            console.log("Invoking op at: ", apiUrl)
            console.log("With payload: ", payload)

            const response = await fetch(apiUrl, {
                method: "POST",
                body: JSON.stringify({data:payload}),
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                },
            });

            if (!response.ok) throw new Error(`Op exec failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json(data);
        } catch (error) {
            console.error("Error calling Ops op: ", error);
            res.status(500).json({ error: `Could not exec Op` });
        }
    };

export default opExec;