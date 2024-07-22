// MTDCOST FILE

const failureResponse = (reason: string) => {
    return {
        success: false,
        message: reason,
        data: {}
    }
}

export const doMtdCostOp = async () => {
    try {
        const response = await fetch('/api/mtd/op', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: null,
        });

        if (response.ok) {
            try {
                const result = await response.json();
                return result;
            } catch (e) {
                return { success: false, message: "Error parsing response." };
            }
        } else {
            return { success: false, message: `Error calling mtd cost: ${response.statusText}.` }
        }
    } catch (error) {
        return { success: false, message: `Network error: ${error}` };
    }
}
