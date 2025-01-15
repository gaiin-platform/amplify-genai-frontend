import {Account} from "@/types/accounts";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = '/state/accounts'; 


export const saveAccounts = async (accounts:Account[]) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/save",
        data: {accounts: accounts}
    };
    return await doRequestOp(op);
}


export const getAccounts = async () => {
    const op = {
        method: 'GET',
        path: URL_PATH,
        op: "/get",
    };
    return await doRequestOp(op);
}