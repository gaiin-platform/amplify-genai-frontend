import { NextApiRequest, NextApiResponse } from "next";
import { getServerAccessToken } from "@/utils/server/accessToken";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const accessToken = await getServerAccessToken(req);
    if (!accessToken) return res.status(401).json({ error: 'Unauthorized' });

    const apiUrl = process.env.API_BASE_URL + "/state/share/sent";
    try {
        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
            },
        });
        if (!response.ok) throw new Error(`Failed with status: ${response.status}`);
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("Error fetching sent shares:", error);
        res.status(500).json({ success: false, error: "Could not fetch sent shares" });
    }
}
