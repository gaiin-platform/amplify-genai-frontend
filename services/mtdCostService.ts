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

export const getAllUserMtdCosts = async (limit: number = 50, lastEvaluatedKey: any = null) => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/list-all-user-mtd-costs",
        data: { 
            pageSize: limit,
            lastEvaluatedKey: lastEvaluatedKey 
        },
        service: SERVICE_NAME
    };

    try {
        const result = await doRequestOp(op);
        console.log('Raw doRequestOp result:', result); // Debug log

        // doRequestOp should return the decoded data directly
        // If result is the data directly, return it with success wrapper
        if (result && (result.users || Array.isArray(result))) {
            return { success: true, data: result };
        }

        // If result has success property, return as-is
        if (result && typeof result === 'object' && 'success' in result) {
            return result;
        }

        // Otherwise assume success and wrap the result
        return { success: true, data: result };
    } catch (error) {
        console.error('Error in getAllUserMtdCosts:', error);
        return { success: false, message: 'Failed to fetch user MTD costs' };
    }
}