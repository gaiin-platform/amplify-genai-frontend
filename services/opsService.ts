
import { OpDef } from "@/types/op";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/ops";
const SERVICE_NAME = "ops";

export const getOpsForUser = async (tag?: string) => {
    const op = {
        data: tag ? { tag: tag } : {},
        method: 'POST',
        path: URL_PATH,
        op: '/get',
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

// in use? didnt find the backend for this call
// export const getOpsForUserAllTags = async () => {

//     const {success, message, data} = await doOpsOp(
//       '/get_all_tags',
//       {});

//     if(!success){
//         return failureResponse(message);
//     }

//     return {success:true, message:"User Ops fetched successfully.", data:data};
// }

const noPayload = ["GET", "DELETE"]

export const execOp = async (path: string, method: string, data?: any, queryParams?: any, url?: string, errorHandler = (e: any) => { }) => {
    const op = {
        url: url, // in case we want to support urls other than our internal api endpoint
        data: noPayload.includes(method) ? null : data,
        method: method,
        path: path,
        op: '',
        service: SERVICE_NAME,
        queryParams: queryParams // in case we want to support query params in the future
    };
    return await doRequestOp(op);
}

export const registerOps = async (ops: OpDef[]) => {
    const op = {
        data: { ops: ops },
        method: 'POST',
        path: URL_PATH,
        op: '/register',
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const deleteOp = async (removeOp: any) => {
    const op = {
        data: { op: removeOp },
        method: 'POST',
        path: URL_PATH,
        op: '/delete',
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}
