
export const shareItems = async (text:string, abortSignal= null)=> {

    const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    console.log("Share Response: ", await response.json());

    return response;
};

