import { NextApiRequest, NextApiResponse } from "next";
import {getSession} from "next-auth/react";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";

const getPresignedUrl =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { accessToken } = session;

        const itemData = req.body;
        const apiUrl = (process.env.API_BASE_URL + "/assistant/files" || "") + '/upload'; // API Gateway URL from environment variables

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
                url: data.uploadUrl,
                statusUrl: data.statusUrl,
                contentUrl: data.contentUrl,
                metadataUrl: data.metadataUrl,
                key: data.key });

        } catch (error) {
            console.error("Error calling share: ", error);
            res.status(500).json({ error: "Could share the item(s)" });
        }
    };

export default getPresignedUrl;