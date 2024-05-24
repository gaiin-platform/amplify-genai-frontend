import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const fetchInCognitoGroup = async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        // Unauthorized access, no session found
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { accessToken } = session;
    
    const apiUrl = process.env.API_BASE_URL + `/utilities/in_cognito_group`;

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
        res.status(500).json({ success: false, error: "Could not make call to check if cognito groups"});
    }
};

export default fetchInCognitoGroup;
