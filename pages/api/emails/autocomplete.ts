import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const fetchEmailSuggestions = async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        // Unauthorized access, no session found
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { accessToken } = session;

    const query = typeof req.query.emailprefix === 'string' ? req.query.emailprefix : ""; 
    
    const apiUrl = process.env.API_BASE_URL + `/utilities/emails/?emailprefix=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}` 
            }
        });

        if (!response.ok) throw new Error(`Failed with status: ${response.status}`);

        const data = await response.json();

        console.log("Email data: ", data);
        res.status(200).json(data);

    } catch (error) {
        console.log("ERROR");
        console.error("Error making request to get email suggestions: ", error);
        res.status(500).json({ success: false, error: "Could not retrieve email suggestions"});
    }
};

export default fetchEmailSuggestions;
