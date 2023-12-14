import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";

const assistantOp =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        let apiUrl = process.env.ASSISTANT_API_URL || "";

        // Accessing itemData parameters from the request
        const reqData = req.body;
        const payload = reqData.data;
        const op = reqData.op;

        apiUrl = apiUrl + op;

        try {
            // @ts-ignore
            const { accessToken } = session;

            console.log("Calling assistant: ", apiUrl, payload);

            const response = await fetch(apiUrl, {
                method: "POST",
                body: JSON.stringify({data:payload}),
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                },
            });

            if (!response.ok) throw new Error(`Assistant op:${op} failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json(data);
        } catch (error) {
            console.error("Error calling assistant: ", error);
            res.status(500).json({ error: `Could not perform assistant op:${op}` });
        }
    };

export default assistantOp;