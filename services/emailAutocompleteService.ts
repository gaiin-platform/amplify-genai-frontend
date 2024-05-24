export const fetchEmailSuggestions = async (queryInput: string) => {
    try {
        const response = await fetch('/api/emails/autocomplete' + `?emailprefix=${queryInput}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const result = await response.json();
            return JSON.parse(result.body);
        } else {
            return { success: false, error: `Error getting email suggestions: ${response.statusText}`};
        }
    } catch (e) {
        console.error("Error fetching email suggestions:", e);
        return { success: false, error: "Error getting email suggestions."};
    }
}
