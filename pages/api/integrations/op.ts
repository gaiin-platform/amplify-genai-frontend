import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const integrationOp = async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        console.log("No session found");
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { accessToken } = session;
    const { data } = req.body;

    let apiUrl = process.env.API_BASE_URL + "/integrations/oauth/start-auth" || "";

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            body: JSON.stringify({ data }),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
        });

        if (!response.ok) throw new Error(`Get integration redirect URL failed with status: ${response.status}`);

        const result = await response.json();

        res.status(200).json({ result });
    } catch (error) {
        console.error("Error calling integration start_auth: ", error);
        res.status(500).json({ error: "Could not call start_auth for an integration oauth flow" });
    }
};

export default integrationOp;