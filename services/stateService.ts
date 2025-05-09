import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/state";
const SERVICE_NAME = "state";

const saveState = async(user:string, name:string, data:any) => {
    try {
        const response = await fetch("api/state", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user, name, data })
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const result = await response.json();
        return result;
    }
    catch (error) {
        console.error("Error calling saveState: ", error);
        return null;
    }
}

export default saveState;
