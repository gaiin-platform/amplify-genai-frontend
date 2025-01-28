import { transformPayload } from "@/utils/app/data";

interface opData {
    // env base api url is used if not provided
    url?: string; // used for running localhost or sending request to another url
    method: string,
    path: string;
    op: string;
    data?: any;
    queryParams?: queryParams;
}

interface queryParams { 
    [key: string]: string;
}


export const doRequestOp = async (opData: opData, abortSignal = null) => {
    const request = `${opData.method} - ${opData.path + opData.op}`;
    // const obfuscatedPayload = transformPayload.encode(opData);
    if (opData.data) opData.data = transformPayload.encode(opData.data); // obfuscate data in payload
    if (opData.queryParams) Object.entries(opData.queryParams).map(([k, v]) =>  {
            if (opData.queryParams) opData.queryParams[k] = transformPayload.encode(v)
    }); // obfuscate query params in payload
    

    try {
        const response = await fetch('/api/requestOp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: abortSignal,
            body: JSON.stringify({ data: opData }),
        });

        if (response.ok){
            try {
                const encodedResult = await response.json();
                // Decode response
                return transformPayload.decode(encodedResult.data);
            } catch (e) {
                return { success: false, message: `Error parsing response from ${request}.` };
            }
        } else {
            console.log(`Error calling.\n ${request}: ${response.statusText}.`);
            return {success: false, message:`Error calling ${request}: ${response.statusText}.`}
        }

    } catch (error) {
        console.log(`Network Error calling ${request}: ${error}.`);
        return {success: false, message:`Network Error calling ${request}: ${error}.`}

    }
   
}

