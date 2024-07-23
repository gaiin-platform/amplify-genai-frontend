import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const mtdCostOp = async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        console.log("No session found");
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { accessToken } = session;
    const userEmail = session.user.email;

    let apiUrl = process.env.API_BASE_URL + "/billing/mtd-cost" || "";

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            body: JSON.stringify({
                data: {
                    email: userEmail
                }
            }),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
        });

        if (!response.ok) throw new Error(`Get latest failed with status: ${response.status}`);

        const data = await response.json();

        res.status(200).json({ item: data });
    } catch (error) {
        console.error("Error calling latest: ", error);
        res.status(500).json({ error: "Could not get mtd cost" });
    }
};

export default mtdCostOp;