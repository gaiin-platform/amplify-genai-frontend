import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const executeCustomAutoOp = async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        console.log("No session found");
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { accessToken } = session;
    const userEmail = session.user.email;

    let apiUrl = process.env.API_BASE_URL + "/assistant-api/execute-custom-auto" || "";

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            body: JSON.stringify({
                name: "custom_auto",
                data: {
                    ...req.body
                }
            }),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
        });

        if (!response.ok) throw new Error(`Execute custom auto failed with status: ${response.status}`);

        const data = await response.json();

        res.status(200).json(data);
    } catch (error) {
        console.error("Error executing custom auto: ", error);
        res.status(500).json({ error: "Could not execute custom auto" });
    }
};

export default executeCustomAutoOp;