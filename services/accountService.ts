import { Account } from "@/types/accounts";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = '/state/accounts';
const SERVICE_NAME = 'accounts';

export const saveAccounts = async (accounts: Account[]) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/save",
        data: { accounts: accounts },
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}

export const getAccounts = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/get",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
}
