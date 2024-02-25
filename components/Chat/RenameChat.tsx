async function callRenameChatApi(taskDescription: string) {
    const response = await fetch('/api/renameChat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskDescription }),
    });

    if (!response.ok) {
        throw new Error('Failed to rename chat');
    }

    const data = await response.json();
    // Assuming `data.item` contains the chat name with potential quotes
    // Remove quotes from the name
    const nameWithoutQuotes = data.item.replace(/^"|"$/g, ''); // This regex removes leading and trailing quotes
    return nameWithoutQuotes;
}

export default callRenameChatApi;
