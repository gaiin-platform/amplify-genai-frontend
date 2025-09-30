const EventSource = require('eventsource');

// Test the SSE endpoint locally
const testSSE = async () => {
  console.log('Testing SSE endpoint...');
  
  const response = await fetch('http://localhost:3000/api/chat/test-sse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ test: true })
  });

  if (!response.ok) {
    console.error('Response not OK:', response.status);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    console.log('Received chunk:', chunk);
  }
};

// Run test
testSSE().catch(console.error);