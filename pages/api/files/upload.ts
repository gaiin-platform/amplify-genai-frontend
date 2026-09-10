import { NextApiRequest, NextApiResponse } from "next";
import { getServerAccessToken } from "@/utils/server/accessToken";

const getPresignedUrl =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const accessToken = await getServerAccessToken(req);

        if (!accessToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const itemData = req.body;

        const apiUrl = (process.env.API_BASE_URL || "") + '/files/upload';

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
                statusUrl: data.statusUrl || null,
                contentUrl: data.contentUrl || null,
                metadataUrl: data.metadataUrl || null,
                key: data.key
            });

        } catch (error) {
            console.error("Error calling files upload: ", error);
            res.status(500).json({ error: "Could not upload the item(s)" });
        }
    };

export default getPresignedUrl;