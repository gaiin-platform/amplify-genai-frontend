// MTDCOST FILE
import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/billing";


export const doMtdCostOp = async (userEmail: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/mtd-cost",
        data: {email: userEmail}
    }; 
    return await doRequestOp(op);
}

