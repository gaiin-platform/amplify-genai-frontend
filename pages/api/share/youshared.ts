import { NextApiRequest, NextApiResponse } from "next";
import { getServerAccessToken } from "@/utils/server/accessToken";



export const getYouShared =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const accessToken = await getServerAccessToken(req);

        if (!accessToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const apiUrl = process.env.API_BASE_URL + "/state/shared" || ""; 

        try {


            const response = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` 
                },
            });

            if (!response.ok) throw new Error(`Fetch failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json({ item: data });
        } catch (error) {
            console.error("Error calling API Gateway: ", error);
            res.status(500).json({ error: "Could not fetch item" });
        }
    };

export default getYouShared;