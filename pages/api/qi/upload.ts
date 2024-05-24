import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";



const uploadToQiS3 =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        

        // Accessing itemData parameters from the request
        const reqData = req.body;
        const payload = reqData.data;
        const type = reqData.type;
        
        const apiUrl = process.env.API_BASE_URL + `/qi/upload/${type}` || "";

        try {
            // @ts-ignore
            const { accessToken } = session;

            console.log("Call to upload qi: ", apiUrl, payload);

            const response = await fetch(apiUrl, {
                method: "POST",
                body: JSON.stringify({data:payload}),
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                },
            });

            if (!response.ok) throw new Error(`Call failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json(data);
        } catch (error) {
            console.error("Error calling assistant: ", error);
            res.status(500).json({ error: `Could not perform upload to S3` });
        }
    };

export default uploadToQiS3;