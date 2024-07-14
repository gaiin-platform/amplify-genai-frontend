

const failureResponse = (reason: string) => {
    return {
        success: false,
        message: reason,
        data: {}
    }
}


const doOptimizerOp = async (opName:string, data:any, errorHandler=(e:any)=>{}) => {
    const op = {
        data: data
    };

    const url = '/api/optimizer'+opName;
    console.log("Optimizer URL:", url);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: null,
        body: JSON.stringify(op),
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
        return {success:false, message:`Error calling optimizer op: ${response.statusText} .`}
    }
}

export const optimizePrompt = async (prompt:string, maxPlaceholders:number) => {

    const {success, message, data} = await doOptimizerOp(
        '/prompt',
        {
            prompt: prompt,
            maxPlaceholders: maxPlaceholders
        });

    if(!success){
        return failureResponse(message);
    }

    return {success:true, message:"Prompt optimized successfully.", data:data};
}
