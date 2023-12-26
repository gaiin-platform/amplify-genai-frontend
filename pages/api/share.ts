import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '20mb',
        },
    },
}

const shareExport =
    async (req: NextApiRequest, res: NextApiResponse) => {
        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { accessToken } = session;

        const apiUrl = process.env.API_BASE_URL + "/state/share" || ""; // API Gateway URL from environment variables

        // Accessing itemData parameters from the request
        const itemData = req.body;

        try {

            const response = await fetch(apiUrl, {
                method: "POST",
                body: JSON.stringify(itemData),
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                },
            });

            if (!response.ok) throw new Error(`Share failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json({ item: data });
        } catch (error) {
            console.error("Error calling share: ", error);
            res.status(500).json({ error: "Could share the item(s)" });
        }
    };

export default shareExport;