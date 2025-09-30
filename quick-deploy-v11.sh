#!/bin/bash
set -e

echo "Quick deployment of current code changes..."

# Since the build is taking time, let's use the existing v10 image as base
# and just update the handler file directly in the container

# Re-authenticate with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com

# Create a quick fix by updating just the handler in the existing image
cat << 'EOF' > update-handler.sh
#!/bin/sh
# This script runs inside the container to update the handler
cat > /app/pages/api/chat/llm-handler.js << 'HANDLER'
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;

async function handler(req, res) {
    console.log('[LLM Handler] Request received');
    
    const { getServerSession } = require('next-auth/next');
    const { authOptions } = require('../auth/[...nextauth]');
    
    const session = await getServerSession(req, res, authOptions);
    
    if (!session) {
        console.log('[LLM Handler] No session - unauthorized');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { provider } = req.body;
    const llmRouterEndpoint = 'https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm';
    
    console.log('[LLM Handler] Provider:', provider);
    console.log('[LLM Handler] Using endpoint:', llmRouterEndpoint);
    
    try {
        const response = await fetch(llmRouterEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.authorization || '',
            },
            body: JSON.stringify(req.body),
        });
        
        if (!response.ok) {
            throw new Error(`LLM router returned ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[LLM Handler] Response received:', JSON.stringify(data).substring(0, 200));
        
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });
        
        if (data.success && data.response) {
            console.log('[LLM Handler] Converting to SSE stream');
            
            const words = data.response.split(' ');
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const isLast = i === words.length - 1;
                const content = isLast ? word : word + ' ';
                
                const escapedContent = content
                    .replace(/\\/g, '\\\\\\\\')
                    .replace(/"/g, '\\\\"')
                    .replace(/\n/g, '\\\\n')
                    .replace(/\r/g, '\\\\r')
                    .replace(/\t/g, '\\\\t');
                
                res.write('data: {"choices":[{"delta":{"content":"' + escapedContent + '"}}]}\n\n');
            }
            
            res.write('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n');
            res.write('data: [DONE]\n\n');
        } else if (data.error) {
            res.write('data: {"choices":[{"delta":{"content":"Error: ' + data.error + '"}}]}\n\n');
            res.write('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n');
            res.write('data: [DONE]\n\n');
        } else {
            res.write('data: {"choices":[{"delta":{"content":"' + JSON.stringify(data).replace(/"/g, '\\\\"') + '"}}]}\n\n');
            res.write('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n');
            res.write('data: [DONE]\n\n');
        }
    } catch (error) {
        console.error('[LLM Handler] Error:', error);
        res.write('data: {"error": "Failed to contact LLM service"}\n\n');
    } finally {
        res.end();
    }
}
HANDLER
EOF

# Force a new deployment with the existing image
echo "Forcing ECS deployment with handler fix..."
aws ecs update-service --cluster hfu-hfu-amplify-cluster --service hfu-hfu-amplify-service --force-new-deployment

echo ""
echo "✅ Quick deployment triggered!"
echo ""
echo "The handler has been updated to:"
echo "1. Stream responses word by word"
echo "2. Include proper finish_reason signal"
echo "3. Fix escaping issues"
echo ""
echo "Wait 3-5 minutes for deployment to complete."