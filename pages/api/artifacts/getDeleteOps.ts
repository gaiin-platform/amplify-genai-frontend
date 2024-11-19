import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";

interface reqPayload {
    method: any, 
    headers: any,
    body?: any
}

const artifactOps =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        let apiUrl = process.env.API_BASE_URL + "/artifacts" || "";

        const queryPath = typeof req.query.path === 'string' ? req.query.path : ""; 
        const artifactKey = req.query.artifactKey;

        const queryArtifactKey = artifactKey && typeof artifactKey === 'string' ? artifactKey: "";

        
        if (queryPath) apiUrl += queryPath;
        if (queryArtifactKey) apiUrl += `?artifact_id=${encodeURIComponent(queryArtifactKey)}`

        // console.log("API url: ", apiUrl);
        // @ts-ignore
        const { accessToken } = session;

        let reqPayload: reqPayload = {
            method: req.method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}` 
            },
        }

        try {

            const response = await fetch(apiUrl, reqPayload);

            if (!response.ok) throw new Error(`Request failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json(data);
        } catch (error) {
            console.error("Error calling artifact get/delete calls: ", error);
            res.status(500).json({ error: `Could not perform artifact getDeleteOp` });
        }
    };

export default artifactOps;