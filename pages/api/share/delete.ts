import { NextApiRequest, NextApiResponse } from "next";
import { getServerAccessToken } from "@/utils/server/accessToken";


export const deleteItem =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const accessToken = await getServerAccessToken(req);

        if (!accessToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const apiUrl = process.env.API_BASE_URL + "/state/share/delete"; 

        try {

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` 
                },
                body: JSON.stringify(req.body),
            });

            if (!response.ok) throw new Error(`Delete failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json({ item: data });
        } catch (error) {
            console.error("Error calling API Gateway: ", error);
            res.status(500).json({ error: "Could not delete item" });
        }
    };

export default deleteItem;