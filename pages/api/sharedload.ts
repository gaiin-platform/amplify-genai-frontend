import { NextApiRequest, NextApiResponse } from "next";
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";



export const loadSharedItem = withApiAuthRequired(
    async (req: NextApiRequest, res: NextApiResponse) => {

        const apiUrl = process.env.SHARE_API_URL + "/load"; // API Gateway URL from environment variables

        try {
            const { accessToken } = await getAccessToken(req, res);

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                },
                body: JSON.stringify(req.body),
            });

            if (!response.ok) throw new Error(`Fetch failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json({ item: data });
        } catch (error) {
            console.error("Error calling API Gateway: ", error);
            res.status(500).json({ error: "Could not fetch item" });
        }
    }
);

export default loadSharedItem;