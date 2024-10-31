export const executeCustomAuto = async (data: any) => {
    try {
        const response = await fetch('/api/assistantApi/op', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (response.ok) {
            try {
                const result = await response.json();
                return result;
            } catch (e) {
                return { success: false, message: "Error parsing response." };
            }
        } else {
            return { success: false, message: `Error executing custom auto: ${response.statusText}.` }
        }
    } catch (error) {
        return { success: false, message: `Network error: ${error}` };
    }
}