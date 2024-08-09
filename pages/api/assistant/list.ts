import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";

const assistantList =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        let apiUrl = process.env.ASSISTANTS_API_BASE + "/assistant/list" || "";



        try {
            // @ts-ignore
            const { accessToken } = session;

            console.log("Calling assistant list: ", apiUrl);

            const response = await fetch(apiUrl, {
                method: req.method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                },
            });

            if (!response.ok) throw new Error(`Assistant list op:failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json(data);
        } catch (error) {
            console.error("Error calling assistant: ", error);
            res.status(500).json({ error: `Could not perform assistant list op` });
        }
    };

export default assistantList;