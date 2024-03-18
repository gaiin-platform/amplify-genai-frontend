import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";

const remoteMessagesFetchOp =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { accessToken } = session;

        // Accessing itemData parameters from the request
        const reqData = req.body;

        const uri = reqData.data?.uri;

        const allowedUris = [
            "https://temp-public-bucket.s3.amazonaws.com/"
        ];

        if (!allowedUris.some((allowedUri) => uri.startsWith(allowedUri))) {
            console.log("Disallowed remote messages uri: ", uri);
            return res.status(401).json({ error: 'Unauthorized' });
        }
        console.log("Allowed remote messages uri: ", uri);

        try {

            const response = await fetch(uri, {
                method: "GET",
                // headers: {
                //     "Content-Type": "application/json",
                //     "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                // },
            });

            if (!response.ok) throw new Error(`Convert remote fetch failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json({success:true, message:"Data fetched", data:data});
        } catch (error) {
            console.error("Error calling download: ", error);
            res.status(500).json({ error: `Could not perform remote fetch` });
        }
    };

export default remoteMessagesFetchOp;