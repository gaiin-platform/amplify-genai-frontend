import { NextApiRequest, NextApiResponse } from "next";
import { getServerAccessToken } from "@/utils/server/accessToken";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb' // Set desired value here
        }
    }
}

const saveState =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const accessToken = await getServerAccessToken(req);

        if (!accessToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const apiUrl = process.env.API_BASE_URL + "/state" || ""; // API Gateway URL from environment variables

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

            if (!response.ok) throw new Error(`Fetch failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json({ item: data });
        } catch (error) {
            console.error("Error calling API Gateway: ", error);
            res.status(500).json({ error: "Could not create item" });
        }
    };

export const getState =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const accessToken = await getServerAccessToken(req);

        if (!accessToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const apiUrl = process.env.API_BASE_URL + "state" || ""; // API Gateway URL from environment variables

        // Accessing itemData parameters from the request
        const stateId = req.query.id;

        try {

            const response = await fetch(apiUrl + "/" + stateId, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
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

export default saveState;
