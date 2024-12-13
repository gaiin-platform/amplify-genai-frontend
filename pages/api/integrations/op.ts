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
    const reqData = req.body;
    const payload = reqData.data;
    const op = reqData.op;

    let apiUrl = process.env.API_BASE_URL + "/integrations/oauth/" || "";
    apiUrl = apiUrl + op;

    console.log("Accessing Integration at: ", apiUrl);

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            body: JSON.stringify({data:payload}),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
        });

        if (!response.ok) throw new Error(`Get integration redirect URL failed with status: ${response.status}`);

        const result = await response.json();

        res.status(200).json({ result });
    } catch (error) {
        console.error("Error calling integration op: ", op, error);
        res.status(500).json({ error: "Could not call start_auth for an integration oauth flow" });
    }
};

export default integrationOp;