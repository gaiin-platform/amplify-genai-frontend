


export const deleteAssistant = async (assistantId: string, abortSignal = null) => {
    
    const response = await fetch('/api/codeInterpreter/delete' + `?assistantId=${encodeURIComponent(assistantId)}&path=${encodeURIComponent("/delete")}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: abortSignal,
    });

    const result = await response.json();
    try {
        if (result.success) {
            return true;
        } else {
            console.error("Error deleting code interpreter: ", result.message);
            return false;
        }
    } catch (e) {
        console.error("Error during delete conde interpreter request: ", e);
        return false;
    }
};



export const getPresignedDownloadUrl = async (data:any, errorHandler=(e:any)=>{}) => {

    const response = await fetch('/api/codeInterpreter/download', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: null,
        body: JSON.stringify({'data': data}),
    });


    if (response.ok){
        try {
            const result = await response.json();

            return result;
        } catch (e){
            return {success:false, message:"Error parsing response."};
        }
    }
    else {
        return {success:false, message:`Error calling assistant: ${response.statusText} .`}
    }
}