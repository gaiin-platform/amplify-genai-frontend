// chatService.js
import {ChatBody, newMessage} from "@/types/chat";
import {createParser, ParsedEvent, ReconnectInterval} from "eventsource-parser";
import {v4 as uuidv4} from 'uuid';

export interface MetaHandler {
    status: (meta: any) => void;
    mode: (mode: string) => void;
    state: (state: any) => void;
    shouldAbort: () => boolean;
}

export async function killRequest(endpoint: string, accessToken: string, requestId: string) {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken,
        },
        body:JSON.stringify({killSwitch:{requestId, value:true}}),
    });

    return res.status === 200;
}

export async function sendChatRequestWithDocuments(endpoint: string, accessToken: string, chatBody: ChatBody, abortSignal?: AbortSignal, metaHandler?: MetaHandler) {

    if (chatBody.response_format && chatBody.response_format.type === 'json_object') {
        if (!chatBody.messages.some(m => m.content.indexOf('json') > -1)) {
            chatBody.messages.push(newMessage({role: 'user', content: 'Please provide a json object as output.'}))
        }
    }

    const keysToExclude = ['messages', 'temperature', 'max_tokens', 'stream', 'dataSources'];
    const vendorProps = Object.fromEntries(
        Object.entries(chatBody).filter(([key, _]) => !keysToExclude.includes(key))
    );

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Use the timzezone to get the user's local time
    const time = new Date().toLocaleString('en-US', {timeZone: timeZone});

    let requestBody = {
        model: chatBody.model.id,
        temperature: chatBody.temperature,
        max_tokens: chatBody.maxTokens || 1000,
        stream: true,
        dataSources: chatBody.dataSources || [],
        messages: [
            {
                role: 'system',
                content: chatBody.prompt,
            },
            ...chatBody.messages
        ],
        options: {
            conversationId: chatBody.conversationId || uuidv4(),
            // Determine the current timezone
            timeZone,
            time,
            requestId: uuidv4(),
            ...vendorProps
        }
    }

    // console.log('sending chat request with dataSources', requestBody);

    const body = JSON.stringify(requestBody);

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken,
        },
        signal: abortSignal,
        body,
    });

    // @ts-ignore
    const functions = requestBody.options && requestBody.options.functions;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    if (res.status !== 200) {
        const result = await res.json();
        let error = 'Error communicating with the server. Please try again in a minute.';
        if (result.error) {
            error = result.error;
        } else if (result.value) {
            error = decoder.decode(result?.value);
        } else if (result.statusText) {
            error = result.statusText;
        }
        if (typeof error !== 'string')  error = JSON.stringify(error);

        const blob = new Blob([error], {type: 'text/plain'});
        const stream = blob.stream();

        return new Response(stream, {
            status: res.status,
            statusText: res.statusText,
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    }

    let nameDone = false;
    let first = true;

    const fnCallHandler = (controller: any, json: any) => {

        const base = json.choices[0].delta.function_call
        let text = "";

        if (base && base.name) {
            if (first) {
                text = "{\"name\":\"";
                first = false;
            }
            text += base.name;
        }
        if (base && base.arguments) {
            if (!nameDone) {
                text += "\", \"arguments\":";
                nameDone = true;
            }
            text += (base.arguments) ? base.arguments : "";
        }
        if (json.choices[0].finish_reason != null) {

            text += "}";

            const queue = encoder.encode(text);
            controller.enqueue(queue);

            console.log("Chat request completed",
                //current time
                new Date().toLocaleString('en-US', {timeZone: 'America/Chicago'}));

            controller.close();
            return;
        }

        const queue = encoder.encode(text);
        controller.enqueue(queue);

        first = false;
    }

    let sourceMapping = [];
    let lastSource: string | null = null;
    let outOfOrderMode = false;

    const stream = new ReadableStream({
        async start(controller) {
            const onParse = (event: ParsedEvent | ReconnectInterval) => {

                if(abortSignal?.aborted || metaHandler?.shouldAbort()){
                    controller.close();
                    return;
                }

                if (event.type === 'event') {

                    const data = event.data;

                    try {
                        const json = JSON.parse(data);

                        if (json.s && json.s === 'meta') {
                            //console.log("Meta Event:", json);
                            if (json.d && json.d.sources) {
                                sourceMapping = json.d.sources;
                            } else if (json.s && json.s === 'meta' && json.st) {
                                //console.log("Status Event:",json.st);
                                if (metaHandler) {
                                    metaHandler.status(json.st);
                                }
                            } else if (json.s && json.s === 'meta' && json.m === 'out_of_order') {
                                outOfOrderMode = true;
                                if (metaHandler) {
                                    metaHandler.mode('out_of_order');
                                }
                            } else if (json.s && json.s === 'meta' && json.state) {
                                if (metaHandler) {
                                    metaHandler.state(json.state);
                                }
                            } else if (json.s && json.s === 'meta' && json.stateReset) {
                                if (metaHandler) {
                                    metaHandler.state({});
                                }
                            }
                            return;
                        } else if (json.d) {

                            if (outOfOrderMode && typeof json.d === 'string') {
                                json.choices = [{delta: {content: data}}];
                                //console.log("Translated Event:",json);
                            } else if (typeof json.d === 'string') {
                                //console.log("Message Event:",json);
                                const prefix = lastSource != null && lastSource != json.s ? "\n\n" : "";
                                // Fake it right now for compatibility!
                                json.choices = [{delta: {content: prefix + json.d}}];
                                //console.log("Translated Event:",json);
                            } else if (json.d.tool_calls && json.d.tool_calls.length > 0) {
                                //console.log("Function Event:",json);
                                // Fake it right now for compatibility!
                                if (json.d.tool_calls[0].function) {
                                    json.choices = [{delta: {function_call: json.d.tool_calls[0].function}}];
                                }
                                //console.log("Translated Event:",json);
                            }

                            lastSource = json.s;
                        } else {
                            return;
                        }

                        if (functions) {
                            fnCallHandler(controller, json);
                        } else {
                            if (json.choices[0].finish_reason != null) {

                                console.log("Chat request completed",
                                    //current time
                                    new Date().toLocaleString('en-US', {timeZone: 'America/Chicago'}));

                                controller.close();
                                return;
                            }

                            const text = json.choices[0].delta.content;
                            const queue = encoder.encode(text);
                            controller.enqueue(queue);
                        }
                    } catch (e) {
                        // Apparent edge case required for Azure
                        if (data === "[DONE]") {
                            return;
                        } else {
                            controller.error(e);
                        }
                    }
                }
            };

            const parser = createParser(onParse);
            // @ts-ignore
            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const {value: chunk, done} = await reader.read();
                    if (done) {
                        // Ensure the end of the parser is dealt with
                        //parser.finish();
                        break;
                    }
                    parser.feed(decoder.decode(chunk));
                }
            } catch (e) {
                controller.error(e);
            } finally {
                await reader.cancel();
                reader.releaseLock(); 
            }

            controller.close();
        },
    });


    return new Response(stream, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
    });


}
