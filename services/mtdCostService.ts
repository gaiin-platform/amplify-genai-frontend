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
        if (result && result.users) return { success: true, data: result };

    } catch (error) {
        console.error('Error in getAllUserMtdCosts:', error);
    }

    return { success: false, message: 'Failed to fetch user MTD costs' };
}

export interface AutoLoadProgress {
    users: any[];
    loadedCount: number;
    currentTotalCost: number;
    batchNumber: number;
    hasMore: boolean;
    isComplete: boolean;
}

export const getAllUserMtdCostsRecursive = async (
    onProgress: (progress: AutoLoadProgress) => void,
    abortSignal?: AbortSignal,
    batchSize: number = 100
) => {
    let allUsers: any[] = [];
    let nextKey: any = null;
    let batchNumber = 0;
    let hasMore = true;

    try {
        while (hasMore) {
            if (abortSignal?.aborted) {
                onProgress({
                    users: allUsers,
                    loadedCount: allUsers.length,
                    currentTotalCost: allUsers.reduce((sum, u) => sum + u.totalCost, 0),
                    batchNumber,
                    hasMore: false,
                    isComplete: false
                });
                return { success: true, data: { users: allUsers, aborted: true } };
            }

            const result = await getAllUserMtdCosts(batchSize, nextKey);
            
            if (!result.success || !result.data) {
                throw new Error(result.message || 'Failed to fetch batch');
            }

            const newUsers = result.data.users || [];
            allUsers = [...allUsers, ...newUsers];
            batchNumber++;
            hasMore = result.data.hasMore && !!result.data.lastEvaluatedKey;
            nextKey = result.data.lastEvaluatedKey;

            const currentTotalCost = allUsers.reduce((sum, u) => sum + (u.totalCost || 0), 0);

            onProgress({
                users: allUsers,
                loadedCount: allUsers.length,
                currentTotalCost,
                batchNumber,
                hasMore,
                isComplete: !hasMore
            });

            if (!hasMore) break;
        }

        return { 
            success: true, 
            data: { 
                users: allUsers, 
                totalCount: allUsers.length,
                totalCost: allUsers.reduce((sum, u) => sum + (u.totalCost || 0), 0)
            } 
        };
    } catch (error) {
        console.error('Error in getAllUserMtdCostsRecursive:', error);
        return { 
            success: false, 
            message: error instanceof Error ? error.message : 'Failed to fetch all user MTD costs',
            data: { users: allUsers }
        };
    }
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

