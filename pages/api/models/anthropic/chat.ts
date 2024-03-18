import { AnthropicStream, StreamingTextResponse } from 'ai';

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge';

// Build a prompt from the messages
function buildPrompt(
    messages: { content: string; role: 'system' | 'user' | 'assistant' }[],
) {
    return (
        messages
            .map(({ content, role }) => {
                if (role === 'user') {
                    return `Human: ${content}`;
                } else {
                    return `Assistant: ${content}`;
                }
            })
            .join('\n\n') + 'Assistant:'
    );
}

const handler = async (req: Request) => {
    // Extract the `messages` from the body of the request

    const { messages } = await req.json();

    console.log("Request: " + JSON.stringify(messages));

    const response = await fetch('https://api.anthropic.com/v1/complete', {
        method: 'POST',
        // @ts-ignore
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
        },
        body: JSON.stringify({
            prompt: buildPrompt(messages),
            model: 'claude-v1',
            max_tokens_to_sample: 300,
            temperature: 0.9,
            stream: true,
        }),
    });

    // Check for errors
    if (!response.ok) {
        return new Response(await response.text(), {
            status: response.status,
        });
    }

    // Convert the response into a friendly text-stream
    const stream = AnthropicStream(response);

    // Respond with the stream
    return new StreamingTextResponse(stream);
}

export default handler;