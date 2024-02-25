import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Ensure this handler accepts POST requests only
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { accessToken } = session;

    const apiUrl = process.env.API_BASE_URL + "/execute_rename" || ""; // API Gateway URL from environment variables

    // Accessing itemData parameters from the request
    const itemData = { data: { task: req.body.taskDescription } };

    try {

        const response = await fetch(apiUrl, {
            method: "POST",
            body: JSON.stringify(itemData),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
            },
        });

        if (!response.ok) throw new Error(`Rename chat failed with status: ${response.status}`);

        const data = await response.json();

        res.status(200).json({ item: data });

    } catch (error) {
        console.error("Error renaming chat: ", error);
        res.status(500).json({ error: "Could not rename the chat" });
    }
}
