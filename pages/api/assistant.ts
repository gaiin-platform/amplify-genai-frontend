import { NextApiRequest, NextApiResponse } from "next";
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import OpenAI from "openai";
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI();

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '20mb',
        },
    },
}

const createAssistant = withApiAuthRequired(
    async (req: NextApiRequest, res: NextApiResponse) => {

        const apiUrl = process.env.SHARE_API_URL || ""; // API Gateway URL from environment variables

        // Accessing itemData parameters from the request
        const assistantData = req.body;

        try {
            const { accessToken } = await getAccessToken(req, res);

            const name = assistantData.name;
            const instructions = assistantData.instructions;
            const tools = assistantData.tools || [];

            const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });

            // const file = await openai.files.create({
            //     file: fs.createReadStream("mydata.csv"),
            //     purpose: "assistants",
            // });

            const assistant = await openai.beta.assistants.create({
                name: name,
                instructions: instructions,
                tools: tools,
                model: "gpt-4-1106-preview"
            });

            const data = {};
            // if (!response.ok) throw new Error(`Share failed with status: ${response.status}`);
            //
            // const data = await response.json();

            res.status(200).json({ item: data });
        } catch (error) {
            console.error("Error calling share: ", error);
            res.status(500).json({ error: "Could share the item(s)" });
        }
    }
);

export default createAssistant;