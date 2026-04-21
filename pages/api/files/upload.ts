import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const getPresignedUrl =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions as any);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get access token from session - it might be in different places depending on the provider
        const accessToken = (session as any).accessToken || (session as any).token?.accessToken || '';

        const itemData = req.body;

        // Check if file service should run locally (same logic as doRequestOp)
        let apiUrl = (process.env.API_BASE_URL || "") + '/files/upload';
        const localServices = process.env.NEXT_PUBLIC_LOCAL_SERVICES || '';
        const serviceConfigs = localServices.split(',').map(s => s.trim());
        for (const config of serviceConfigs) {
            const [service, port, stage] = config.split(':');
            if (service?.trim() === 'file' && port) {
                apiUrl = `http://localhost:${port.trim()}/${(stage || 'dev').trim()}/files/upload`;
                console.log('[UPLOAD] Routing to local file service:', apiUrl);
                break;
            }
        }

        try {

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}` // Assuming the API Gateway/Lambda expects a Bearer token
                },
                body: JSON.stringify(itemData),
            });

            if (!response.ok) throw new Error(`Failed with status: ${response.status}`);

            const data = await response.json();

            res.status(200).json({
                url: data.uploadUrl,
                statusUrl: data.statusUrl || null,
                contentUrl: data.contentUrl || null,
                metadataUrl: data.metadataUrl || null,
                key: data.key
            });

        } catch (error) {
            console.error("Error calling files upload: ", error);
            res.status(500).json({ error: "Could not upload the item(s)" });
        }
    };

export default getPresignedUrl;