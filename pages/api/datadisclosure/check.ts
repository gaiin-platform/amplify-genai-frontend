import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const checkExport =
    async (req: NextApiRequest, res: NextApiResponse) => {
        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { accessToken } = session;

        const email = session?.user?.email;
        const queryParams = new URLSearchParams({ email }); // Create query params with email

        const apiUrl = (process.env.API_BASE_URL + "/data-disclosure/check?" + queryParams) || ""; // API Gateway URL with query parameters
        // console.log(apiUrl);

        try {

            const response = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                },
            });

            if (!response.ok) throw new Error(`Check user failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json({ item: data });
        } catch (error) {
            console.error("Error calling check: ", error);
            res.status(500).json({ error: "Could not check user's data disclosure status" });
        }
    };

export default checkExport;