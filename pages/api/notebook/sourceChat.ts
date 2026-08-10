import axios from 'axios';
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerAccessToken } from '@/utils/server/accessToken';
import {
    getOpenNotebookBase,
    upstreamErrorMessage,
} from '@/utils/server/openNotebook';

// Sends one message to a source-scoped chat session. Open Notebook's
// /sources/{id}/chat/sessions/{sid}/messages endpoint only speaks SSE, but it
// isn't a real token stream — the graph runs to completion and the whole AI
// reply arrives as a single event. So this route buffers the SSE body and
// hands the browser plain JSON (matching the non-streaming shape of notebook
// chat's /chat/execute). Callers refetch the session afterwards for the
// persisted message list, so only errors need to be surfaced from the stream.
const notebookSourceChat = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const accessToken = await getServerAccessToken(req);
    if (!accessToken) return res.status(401).json({ error: 'Unauthorized' });

    const base = getOpenNotebookBase();
    if (!base) {
        return res.status(500).json({ error: 'API_BASE_URL not configured' });
    }

    const {
        source_id: sourceId,
        session_id: sessionId,
        message,
        model_override: modelOverride,
    } = req.body ?? {};
    if (typeof sourceId !== 'string' || !sourceId) {
        return res.status(400).json({ error: 'source_id is required' });
    }
    if (typeof sessionId !== 'string' || !sessionId) {
        return res.status(400).json({ error: 'session_id is required' });
    }
    if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'message is required' });
    }

    const url = `${base}/api/sources/${encodeURIComponent(sourceId)}/chat/sessions/${encodeURIComponent(sessionId)}/messages`;

    try {
        const upstream = await axios.post(
            url,
            { message, model_override: modelOverride ?? null },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream',
                },
                responseType: 'text',
                validateStatus: () => true,
                // Same ceiling as the JSON proxy — one LLM call, like /chat/execute.
                timeout: 120_000,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            },
        );

        const raw = typeof upstream.data === 'string' ? upstream.data : '';

        if (upstream.status < 200 || upstream.status >= 300) {
            let body: unknown = null;
            try {
                body = JSON.parse(raw);
            } catch {
                // non-JSON error body; fall through to generic message
            }
            console.error(
                `notebook source chat upstream error: ${sourceId}/${sessionId} -> ${upstream.status}`,
            );
            return res.status(200).json({
                success: false,
                status: upstream.status,
                data: null,
                message: upstreamErrorMessage(upstream.status, body),
            });
        }

        // Scan the buffered SSE events for an error; everything else (the AI
        // reply, context indicators) is re-read from the session afterwards.
        for (const line of raw.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
                const event = JSON.parse(line.slice(6));
                if (event?.type === 'error') {
                    return res.status(200).json({
                        success: false,
                        status: upstream.status,
                        data: null,
                        message: event.message || 'Source chat failed',
                    });
                }
            } catch {
                // ignore unparseable events
            }
        }

        return res.status(200).json({
            success: true,
            status: upstream.status,
            data: null,
        });
    } catch (error: any) {
        console.error('notebook source chat network error:', error?.message ?? error);
        return res.status(200).json({
            success: false,
            status: null,
            data: null,
            message: error?.message || 'Network error reaching Open Notebook',
        });
    }
};

export default notebookSourceChat;
