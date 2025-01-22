import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/memory";

export const doExtractFactsOp = async (userInput: string) => {
    const op = {
        url: 'http://localhost:3015/dev/memory/extract-facts',
        method: 'POST',
        path: '',
        op: "",
        // path: URL_PATH,
        // op: "/extract-facts",
        data: { user_input: userInput }
    };
    return await doRequestOp(op);
}
