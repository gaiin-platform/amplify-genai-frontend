import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const getGroupAssistantDashboards = async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { accessToken } = session;
    const { data } = req.body;

    if (!data || !data.assistantId) {
        return res.status(400).json({ error: 'assistantId is required' });
    }

    let apiUrl = `${process.env.API_BASE_URL}/assistant/get_group_assistant_dashboards`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: JSON.stringify({ data }),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`Request failed with status: ${response.status}`);
        }

        const responseData = await response.json();
        res.status(200).json(responseData);
    } catch (error) {
        console.error("Error calling get group assistant dashboards: ", error);
        res.status(500).json({ error: `Could not get group assistant dashboards: ${error}` });
    }
};

export default getGroupAssistantDashboards;