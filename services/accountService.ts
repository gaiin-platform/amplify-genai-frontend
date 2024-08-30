import {Account} from "@/types/accounts";


const failureResponse = (reason: string) => {
    return {
        success: false,
        message: reason,
        data: {}
    }
}


const doAccountOp = async (opName:string, data:any, errorHandler=(e:any)=>{}) => {
    const op = {
        data: data,
        op: opName
    };

    const response = await fetch('/api/accounts/op', {
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
        return {success:false, message:`Error calling accounts: ${response.statusText} .`}
    }
}

const serviceHook = (opName: string) => {

    return async (requestData: any) => {
        console.log(`${opName} request:`, requestData);

        const {success, message, data} = await doAccountOp(
            opName,
            requestData);

        console.log(`${opName} response:`, success, message, data);

        if (!success) {
            return failureResponse(message);
        }

        return {success: true, message: `${opName} success.`, data: data};
    }
}

export const getAccounts = async () => {

    const {success, message, data} = await doAccountOp(
        '/accounts/get',
        {});

    if(!success){
        return failureResponse(message);
    }

    return {success:true, message:"Accounts fetched successfully.", data:data};
}

export const saveAccounts = async (accounts:Account[]) => {

    const {success, message, data} = await doAccountOp(
        '/accounts/save',
        {accounts:accounts});

    if(!success){
        return failureResponse(message);
    }

    return {success:true, message:"Accounts saved successfully.", data:data};
}
