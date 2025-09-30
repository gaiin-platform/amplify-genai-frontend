import React, { useState } from 'react';
import { useSession } from 'next-auth/react';

const TestSSEPage: React.FC = () => {
  const { data: session } = useSession();
  const [output, setOutput] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [provider, setProvider] = useState('bedrock');

  const testDirectSSE = async () => {
    setOutput(['Testing direct SSE endpoint...']);
    setIsStreaming(true);

    try {
      const response = await fetch('/api/chat/test-sse');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setOutput(prev => [...prev, 'Stream completed']);
            } else {
              try {
                const json = JSON.parse(data);
                setOutput(prev => [...prev, `Received: ${JSON.stringify(json)}`]);
              } catch (e) {
                setOutput(prev => [...prev, `Raw data: ${data}`]);
              }
            }
          }
        }
      }
    } catch (error) {
      setOutput(prev => [...prev, `Error: ${error}`]);
    } finally {
      setIsStreaming(false);
    }
  };

  const testLLMRouter = async () => {
    setOutput(['Testing LLM router with handler...']);
    setIsStreaming(true);

    try {
      const response = await fetch('/api/chat/fixed-handler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(session as any)?.accessToken || ''}`,
        },
        body: JSON.stringify({
          model: 'anthropic.claude-3-sonnet-20240229-v1:0',
          provider: provider,
          messages: [{ role: 'user', content: 'Say "Hello from test"' }],
          temperature: 0.7,
          max_tokens: 100,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('No reader available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1];
        
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setOutput(prev => [...prev, '✅ Stream completed']);
            } else {
              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  setOutput(prev => [...prev, `Content: "${content}"`]);
                } else if (json.choices?.[0]?.delta?.role) {
                  setOutput(prev => [...prev, `Role: ${json.choices[0].delta.role}`]);
                } else if (json.choices?.[0]?.finish_reason) {
                  setOutput(prev => [...prev, `Finish reason: ${json.choices[0].finish_reason}`]);
                }
              } catch (e) {
                setOutput(prev => [...prev, `Parse error: ${e} - Data: ${data}`]);
              }
            }
          }
        }
      }
    } catch (error) {
      setOutput(prev => [...prev, `❌ Error: ${error}`]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">SSE Stream Testing</h1>
      
      <div className="mb-4">
        <label className="block mb-2">Provider:</label>
        <select 
          value={provider} 
          onChange={(e) => setProvider(e.target.value)}
          className="border rounded px-4 py-2"
        >
          <option value="bedrock">Bedrock</option>
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>
      
      <div className="flex gap-4 mb-6">
        <button
          onClick={testDirectSSE}
          disabled={isStreaming}
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test Direct SSE
        </button>
        
        <button
          onClick={testLLMRouter}
          disabled={isStreaming || !session}
          className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          Test LLM Router
        </button>
        
        <button
          onClick={() => setOutput([])}
          className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
        >
          Clear
        </button>
      </div>

      <div className="border rounded p-4 bg-gray-100 dark:bg-gray-800 h-96 overflow-y-auto">
        <pre className="text-sm font-mono">
          {output.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </pre>
      </div>
    </div>
  );
};

export default TestSSEPage;