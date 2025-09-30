// Test SSE format parsing
const { createParser } = require('eventsource-parser');

// Test data that should work
const testSSE = `data: {"choices":[{"delta":{"content":"Hello "},"index":0}]}

data: {"choices":[{"delta":{"content":"world "},"index":0}]}

data: {"choices":[{"delta":{"content":"test"},"index":0}]}

data: {"choices":[{"delta":{},"index":0,"finish_reason":"stop"}]}

data: [DONE]

`;

console.log('Testing SSE parsing...\n');

const onParse = (event) => {
  if (event.type === 'event') {
    console.log('Event data:', event.data);
    
    if (event.data === '[DONE]') {
      console.log('=> Stream complete');
      return;
    }
    
    try {
      const json = JSON.parse(event.data);
      if (json.choices && json.choices[0] && json.choices[0].delta) {
        const content = json.choices[0].delta.content;
        if (content) {
          console.log('=> Content:', content);
        } else if (json.choices[0].finish_reason) {
          console.log('=> Finish reason:', json.choices[0].finish_reason);
        }
      }
    } catch (e) {
      console.log('=> Parse error:', e.message);
    }
  }
};

const parser = createParser(onParse);

// Feed the test data
parser.feed(testSSE);

console.log('\nTest complete.');