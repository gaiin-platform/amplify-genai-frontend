import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/personal";
const SERVICE_NAME = "personal";

const failureResponse = (reason: string) => {
    return {
        success: false,
        message: reason,
        data: {}
    }
}


const doPdbOp = async (opName:string, data:any, errorHandler=(e:any)=>{}) => {
    const op = {
        data: data,
        op: opName
    };

    const response = await fetch('/api/pdb/op', {
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
        return {success:false, message:`Error calling Ops op: ${response.statusText} .`}
    }
}

export const getDbsForUser = async () => {

    const {success, message, data} = await doPdbOp(
        '/list',
        {});

    if(!success){
        return failureResponse(message);
    }

    return {success:true, message:"User DBs fetched successfully.", data:data};
}
