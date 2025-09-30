import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";
import { getAuthToken } from "@/utils/auth/getAuthToken";


export const deleteItem =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions as any);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const accessToken = await getAuthToken(req, res);
        if (!accessToken) {
            return res.status(401).json({ error: 'No valid authentication token' });
        }

        const apiUrl = process.env.API_BASE_URL + "/state/shared/delete"; 

        try {

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` 
                },
                body: JSON.stringify(req.body),
            });

            if (!response.ok) throw new Error(`Delete failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json({ item: data });
        } catch (error) {
            console.error("Error calling API Gateway: ", error);
            res.status(500).json({ error: "Could not delete item" });
        }
    };

export default deleteItem;