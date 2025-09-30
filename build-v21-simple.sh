#!/bin/bash

# Build v21: Simple build with proper environment variables
# This build uses existing code and focuses on proper configuration

set -e

echo "=== Amplify Frontend Build v21: Simplified Configuration-Based Build ==="
echo "This build maintains existing code but ensures proper environment configuration"

# Clean only build artifacts, not source code
echo "Cleaning build artifacts..."
rm -rf .next
rm -rf node_modules/.cache

# Create comprehensive .env.production with ALL required variables
echo "Creating comprehensive .env.production..."
cat > .env.production << 'EOL'
# NextAuth Configuration
NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4=
NEXTAUTH_URL=https://hfu-amplify.org

# Cognito Configuration
COGNITO_CLIENT_ID=2rq8ekafegrh5mcd51q80rt0bh
COGNITO_CLIENT_SECRET=p2np9r5nt5nptnc74gv65q7siigo8a0rim211ai1nqmqvl7ssuk
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_PgwOR439P
COGNITO_DOMAIN=https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com

# API Endpoints
CHAT_ENDPOINT=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod/amplify/chat
API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod

# LLM Router endpoint
NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm

# Authentication Provider Configuration
NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito
NEXT_PUBLIC_AUTH_ENABLED=true

# Feature Flags
NEXT_PUBLIC_ENABLE_STREAMING=true
NEXT_PUBLIC_ENABLE_CANVAS_INTEGRATION=false

# Analytics (optional)
MIXPANEL_TOKEN=
NEXT_PUBLIC_MIXPANEL_TOKEN=

# Application Configuration
NEXT_PUBLIC_APP_NAME="HFU Amplify"
NEXT_PUBLIC_APP_VERSION="1.0.21"

# Telemetry disabled
NEXT_TELEMETRY_DISABLED=1
EOL

# Ensure amplify-handler.ts exists for chat streaming
echo "Ensuring amplify-handler.ts exists..."
if [ ! -f "pages/api/chat/amplify-handler.ts" ]; then
  echo "Creating amplify-handler.ts..."
  mkdir -p pages/api/chat
  cat > pages/api/chat/amplify-handler.ts << 'EOL'
import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = await getToken({ req });
    if (!token || !token.accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { messages, model, stream = true } = req.body;

    // Forward to Amplify backend
    const amplifyEndpoint = process.env.CHAT_ENDPOINT || 'https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod/amplify/chat';
    
    const response = await fetch(amplifyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.accessToken}`,
      },
      body: JSON.stringify({
        messages,
        model,
        stream
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Amplify backend error:', error);
      return res.status(response.status).json({ error });
    }

    if (stream && response.body) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const reader = response.body;
      reader.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            // Parse Amplify format and convert to OpenAI format
            if (line.startsWith('data: ')) {
              try {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  res.write('data: [DONE]\n\n');
                } else {
                  // Extract content and send in OpenAI format
                  const parsed = JSON.parse(data);
                  const content = parsed.content || parsed.chunk || '';
                  if (content) {
                    res.write(\`data: {"choices":[{"delta":{"content":"\${content}"}}]}\n\n\`);
                  }
                }
              } catch (e) {
                // If not JSON, treat as plain text
                res.write(\`data: {"choices":[{"delta":{"content":"\${data}"}}]}\n\n\`);
              }
            }
          }
        }
      });

      reader.on('end', () => res.end());
      reader.on('error', (err: Error) => {
        console.error('Stream error:', err);
        res.end();
      });
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
EOL
fi

# Build the application
echo "Building Next.js application..."
NODE_OPTIONS='--max-old-space-size=4096' npm run build

# Create the Docker image with all build args
echo "Building Docker image..."
docker build -t hfu-amplify-frontend:v21 \
  --build-arg NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4= \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=true \
  --build-arg NEXT_PUBLIC_ENABLE_STREAMING=true \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod \
  --build-arg NEXT_PUBLIC_APP_NAME="HFU Amplify" \
  --build-arg NEXT_PUBLIC_APP_VERSION="1.0.21" \
  .

# Tag for ECR
echo "Tagging for ECR..."
docker tag hfu-amplify-frontend:v21 135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-amplify-repo:v21
docker tag hfu-amplify-frontend:v21 135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-amplify-repo:latest

echo ""
echo "=== Build v21 Complete ==="
echo ""
echo "This build includes:"
echo "✓ Proper Cognito authentication configuration"
echo "✓ Amplify-compatible SSE handler"
echo "✓ All required environment variables"
echo "✓ Clean build preserving existing code"
echo ""
echo "To deploy to production:"
echo "1. Push to ECR:"
echo "   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com"
echo "   docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-amplify-repo:v21"
echo "   docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-amplify-repo:latest"
echo ""
echo "2. Update ECS service:"
echo "   aws ecs update-service --cluster hfu-amplify-cluster --service hfu-amplify-service --force-new-deployment"
echo ""
echo "3. Update task definition with proper environment variables (use ecs-task-definition-v21.json)"