

export function stringChunkCallback(processChunkCallback: (chunkStr:string) => string){

    const proc = (chunk: Uint8Array) => {
        const text = new TextDecoder().decode(chunk);

        // Here you can perform any string manipulation you need on the text
        // For the sake of example: converting text to uppercase
        const processedText = processChunkCallback(text);

        // Convert the processed text back to a Uint8Array
        const processedChunk = new TextEncoder().encode(processedText);

        return processedChunk;
    };

    return proc;
}

export async function wrapResponse(
    response: Response,
    processChunkCallback: (chunk: Uint8Array) => Uint8Array,
    onDoneCallback?:()=>void,
    onCancelCallback?:(reason:any)=>void): Promise<Response> {

    const originalBodyStream = response.body;
    if (!originalBodyStream) {
        throw new Error('Response body stream is null');
    }

    const reader = originalBodyStream.getReader();

    const newStream = new ReadableStream<Uint8Array>({
        async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
                if(onDoneCallback) {onDoneCallback();}

                controller.close();
                return;
            }
            const processedValue = processChunkCallback(value!);
            controller.enqueue(processedValue);
        },
        cancel(reason) {
            if(onCancelCallback){
                onCancelCallback(reason);
            }
            reader.cancel();
        }
    });

    // Clone the original response, but override the body with our processed stream
    const wrappedResponse = new Response(newStream, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });

    // Preserve other methods like .ok or .redirected by copying them from the original response
    Object.defineProperties(wrappedResponse, {
        ok: { value: response.ok },
        redirected: { value: response.redirected },
        type: { value: response.type },
        url: { value: response.url },
        useFinalURL: { value: response.url },
        // ... copy other properties or methods you need
    });

    return wrappedResponse;
}
