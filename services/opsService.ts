
import { OpDef } from "@/types/op";
import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/ops";


const failureResponse = (reason: string) => {
    return {
        success: false,
        message: reason,
        data: {}
    }
}


const doOpsOp = async (opName:string, data:any, errorHandler=(e:any)=>{}) => {
    const op = {
        data: data,
        op: opName
    };

    const response = await fetch('/api/ops/op', {
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

export const getOpsForUser = async () => {

    const {success, message, data} = await doOpsOp(
        '/get',
        {});

    if(!success){
        return failureResponse(message);
    }

    return {success:true, message:"User Ops fetched successfully.", data:data};
}

export const execOp = async (path:string, data:any, errorHandler=(e:any)=>{}) => {
    const op = {
        data: data,
        path: path
    };

    const response = await fetch('/api/ops/exec', {
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
            return {success:false, message:"Error parsing op exec response."};
        }
    }
    else {
        return {success:false, message:`Error in exec op: ${response.statusText} .`}
    }
}

export const execOpGet = async (path:string, errorHandler=(e:any)=>{}) => {
    
    const response = await fetch('/api/ops/execGet' + `?path=${encodeURIComponent(path)}` , {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: null,
    });


    if (response.ok){
        try {
            const result = await response.json();

            return result;
        } catch (e){
            return {success:false, message:"Error parsing op exec get response."};
        }
    }
    else {
        return {success:false, message:`Error in exec get op: ${response.statusText} .`}
    }
}

export const registerOps = async (ops:OpDef[]) => {

    const {success, message, data} = await doOpsOp(
        '/register',
        {ops: ops});

    if(!success){
        return failureResponse(message);
    }

    return {success:true, message:"User Ops fetched successfully.", data:data};
}


export const deleteOp = async (op:any) => {

    const {success, message, data} = await doOpsOp(
        '/delete',
        {op: op});

    if(!success){
        return failureResponse(message);
    }

    return {success:true, message:"User Ops fetched successfully.", data:data};
}