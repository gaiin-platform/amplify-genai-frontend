import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/billing";
const SERVICE_NAME = "mtd";

export const doMtdCostOp = async (userEmail: string) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/mtd-cost",
        data: { email: userEmail },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}
