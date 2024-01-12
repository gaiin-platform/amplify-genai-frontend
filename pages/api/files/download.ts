import { NextApiRequest, NextApiResponse } from "next";
import {getSession} from "next-auth/react";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";

const getPresignedDownloadUrl =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { accessToken } = session;

        const itemData = req.body;
        const apiUrl = (process.env.FILES_API_URL || "") + '/download'; // API Gateway URL from environment variables

        try {

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                },
                body: JSON.stringify(itemData),
            });

            if (!response.ok) throw new Error(`Failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json({
                downloadUrl: data.downloadUrl
            });

        } catch (error) {
            console.error("Error calling download file: ", error);
            res.status(500).json({ error: "Could download the item(s)" });
        }
    };

export default getPresignedDownloadUrl;