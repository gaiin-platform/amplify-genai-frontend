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


export const addFile = async (metadata:AttachedDocument, file: File, onProgress?: (progress: number) => void, abortSignal:AbortSignal|null= null) => {

    const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({type:metadata.type, name:metadata.name}),
        signal: abortSignal,
    });

    if (!response.ok) {
        throw new Error(`Failed to get presigned url: ${response.status}`);
    }

    const result = await response.json();
    const key = result.key;
    const uploadUrl = result.url;


    const {response:uploadResponse, abort:abort} = uploadFileToS3(file, uploadUrl, (progress: number) => {
        if (onProgress) {
            onProgress(progress);
        }
    });

    return {key:key, response:uploadResponse, abortController:abort};
};


