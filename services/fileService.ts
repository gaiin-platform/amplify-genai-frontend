import {AttachedDocument} from "@/types/attacheddocument";


const uploadFileToS3 = (
    file: File,
    presignedUrl: string,
    onProgress?: (progress: number) => void
) => {

    const xhr = new XMLHttpRequest();

    const result = new Promise((resolve, reject) => {

        // Event listener for upload progress
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
                const progress = Math.round((event.loaded / event.total) * 100);
                onProgress(progress);
            }
        });

        // Event listener for request completion
        xhr.onload = () => {
            if (xhr.status === 200) {
                resolve(true); // Resolve the promise when the file is successfully uploaded
            } else {
                const errorMessage = xhr.getResponseHeader('x-amz-error-message');
                reject(new Error(`Upload failed with status code: ${xhr.status}, error: ${errorMessage}, body: ${xhr.responseText}`));
            }
        };

        // Event listener for request error
        xhr.onerror = () => reject(new Error('Network error occurred during file upload.'));
        xhr.onabort = () => reject(new Error('Abort'));

        // Set up and send the request
        xhr.open('PUT', presignedUrl);

        // Add the Content-Type header with the file's MIME type
        if (file.type) {
            console.log("file type", file.type);
            xhr.setRequestHeader("Content-Type", file.type); // Ensure the Content-Type header is set
        } else {
            console.log("file type", "application/octet-stream");
            // If the file.type is not defined, you may choose to set a generic binary type, or
            // if your backend service requires a specific type, you'll need to provide it accordingly.
            xhr.setRequestHeader("Content-Type", "application/octet-stream");
        }

        xhr.send(file);
    });

    return {response:result, abort:()=>xhr.abort()};
}

export function checkContentReady(url: string, maxSeconds: number): Promise<any> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const intervalId = setInterval(() => {
            if (Date.now() - startTime >= maxSeconds * 1000) {
                clearInterval(intervalId);
                reject(new Error('Timeout reached'));
            }

            const xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        console.log("File ready for chat");
                        let metadata = null;
                        try{
                            metadata = JSON.parse(xhr.responseText);
                        }
                        catch(e){
                            console.log("Error parsing content metadata response", e);
                        }
                        clearInterval(intervalId);
                        resolve({success: true, metadata: metadata});
                    }
                    // else if (xhr.status !== 404) {
                    //     clearInterval(intervalId);
                    //     reject(new Error(`Unexpected status code: ${xhr.status}`));
                    // }
                }
            };
            xhr.send();
        }, 500);
    });
}

export const getFileDownloadUrl = async (key:string) => {
    const response = await fetch('/api/files/download', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            data:{
                key:key
            }
        }),
        signal: null,
    });

    if (!response.ok) {
        throw new Error(`Failed to get presigned download url: ${response.status}`);
    }

    const result = await response.json();

    return {key:key, downloadUrl:result.downloadUrl};
}

export const addFile = async (metadata:AttachedDocument, file: File, onProgress?: (progress: number) => void, abortSignal:AbortSignal|null= null) => {

    const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            data:{
                actions:[],
                type:metadata.type,
                name:metadata.name,
                knowledgeBase:"default",
                tags:[],
                data:{}
            }
        }),
        signal: abortSignal,
    });

    if (!response.ok) {
        throw new Error(`Failed to get presigned url: ${response.status}`);
    }

    const result = await response.json();

    console.log("result", result);

    const key = result.key;
    const uploadUrl = result.url;
    const contentUrl = result.contentUrl;
    const statusUrl = result.statusUrl;
    const metadataUrl = result.metadataUrl;

    console.log("contentUrl", contentUrl);
    console.log("statusUrl", statusUrl);
    console.log("metadataUrl", metadataUrl);

    const {response:uploadResponse, abort:abort} = uploadFileToS3(file, uploadUrl, (progress: number) => {
        if (onProgress) {
            onProgress(progress);
        }
    });

    return {key:key,
            contentUrl:contentUrl,
            metadataUrl:metadataUrl,
            statusUrl:statusUrl,
            response:uploadResponse,
            abortController:abort};
};


