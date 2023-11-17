import { NextApiRequest, NextApiResponse } from "next";
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";

const getPresignedUrl = withApiAuthRequired(
    async (req: NextApiRequest, res: NextApiResponse) => {

        const itemData = req.body;
        const apiUrl = (process.env.FILES_API_URL || "") + '/upload'; // API Gateway URL from environment variables

        try {
            const { accessToken } = await getAccessToken(req, res);

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

            res.status(200).json({ url: data.presigned_url, key: data.key });
        } catch (error) {
            console.error("Error calling share: ", error);
            res.status(500).json({ error: "Could share the item(s)" });
        }
    }
);

export default getPresignedUrl;