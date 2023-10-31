import { NextApiRequest, NextApiResponse } from "next";
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";

const share = withApiAuthRequired(
    async (req: NextApiRequest, res: NextApiResponse) => {

        try {
            const { accessToken } = await getAccessToken(req, res);
            return res.status(200).json({ success:true });
        } catch (error) {
            console.error(error);
            // @ts-ignore
            return res.status(error.status || 500).end(error.message);
        }
    }
);

export default share;