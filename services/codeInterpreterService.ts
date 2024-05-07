
import {Stopper} from "@/utils/app/tools";

const doCodeInterpreterOp = async (stopper: Stopper, opName: string, data: any, errorHandler = (e: any) => {
}) => {
    const op = {
        data: data,
        op: opName
    };

    console.log("Code Interpreter Data Op:", op);

    const response = await fetch('/api/codeInterpreter/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: stopper.signal,
        body: JSON.stringify(op),
    });

    console.log("Assistant Op response:", response);

    if (response.ok) {
        try {
            const result = await response.json();
            console.log("Assistant Op result:", result);

            return result;
        } catch (e) {
            return {success: false, message: "Error parsing response."};
        }
    } else {
        return {success: false, message: `Error calling codeInterpreter${response.statusText} .`}
    }
}



export const deleteAssistant = async (assistantId: string, abortSignal = null) => {
    const response = await fetch('/api/assistant/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({op: "/delete", data: {assistantId}}),
        signal: abortSignal,
    });

    const result = await response.json();

    if (result.success) {
        return true;
    } else {
        console.error("Error deleting assistant: ", result.message);
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