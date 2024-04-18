import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const latestExport =
    async (req: NextApiRequest, res: NextApiResponse) => {
        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { accessToken } = session;

        const apiUrl = process.env.API_BASE_URL + "/data-disclosure/latest" || ""; // API Gateway URL from environment variables
        console.log(apiUrl);

        try {

            const response = await fetch(apiUrl, {
                method: "GET",
                // body: JSON.stringify(itemData),
                headers: {
                    "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                },
            });

            if (!response.ok) throw new Error(`Get latest failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json({ item: data });
        } catch (error) {
            console.error("Error calling latest: ", error);
            res.status(500).json({ error: "Could not get latest data disclosure" });
        }
    };

export default latestExport;