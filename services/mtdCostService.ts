import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/billing";
const SERVICE_NAME = "mtd";

export const doMtdCostOp = async () => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/mtd-cost",
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
        // console.log('Raw doRequestOp result:', result); // Debug log
        if (result && result.users) return { success: true, data: result };

    } catch (error) {
        console.error('Error in getAllUserMtdCosts:', error);
    }

    return { success: false, message: 'Failed to fetch user MTD costs' };
}



export const getUserMtdCosts = async () => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/list-user-mtd-costs",
        data: {},
        service: SERVICE_NAME
    };

    try {
        const result = await doRequestOp(op);
        if (result && result.email) return { success: true, data: result };

    } catch (error) {
        console.error('Error in getUserMtdCosts:', error);
    }

    return { success: false, message: 'Failed to fetch user MTD costs' };
}

export const getBillingGroupsCosts = async () => {
    const op = {
        method: 'POST',
        path: URL_PATH,
        op: "/billing-groups-costs",
        data: {},
        service: SERVICE_NAME
    };

    try {
        const result = await doRequestOp(op);
        if (result && result.billingGroups) return { success: true, data: result };

    } catch (error) {
        console.error('Error in getBillingGroupsCosts:', error);
    }

    return { success: false, message: 'Failed to fetch billing groups costs' };
}

