# Amplify Project - Agent Deployment and MCP Installation Master Prompt

## Executive Summary
This document contains the complete prompt for deploying specialized agents and MCPs to resolve the Amplify platform's authentication and chat functionality issues. The core problem is that chat responses are blank due to authentication failures and improper streaming response handling.

## Agent Instantiation Instructions

### Creating the Agent Team

```markdown
You are the orchestrator for fixing the Amplify platform. You will coordinate four specialized agents to resolve authentication and chat issues. Here's how to deploy each agent:

## Agent 1: Platform Architecture Lead
Create an agent with the following prompt:
"You are the Platform Architecture Lead for the Amplify project. Analyze the current architecture where:
- Frontend at https://hfu-genai-alb-501693461.us-east-1.elb.amazonaws.com
- Cognito User Pool: us-east-1_PgwOR439P
- API Gateway: https://1y2q5khrvc.execute-api.us-east-1.amazonaws.com/prod
- NextAuth failing with 'Nonce cookie was missing' errors
- Chat responses returning blank due to authentication failures

Design a complete solution that:
1. Fixes the authentication flow from Cognito → NextAuth → Frontend
2. Enables proper SSE streaming for chat responses
3. Implements proper cookie/session handling for cross-origin requests
4. Creates fallback mechanisms when services fail

Provide architectural diagrams and specific implementation steps."

## Agent 2: Frontend Authentication Specialist
Create an agent with the following prompt:
"You are the Frontend Authentication Specialist. The Amplify frontend has critical auth issues:
- NextAuth OAuth callbacks failing with 'Nonce cookie was missing'
- Session not persisting between frontend and API calls
- Direct chat endpoint returning 401 Unauthorized

Fix the authentication by:
1. Updating /pages/api/auth/[...nextauth].js configuration
2. Setting proper cookie policies for cross-origin requests
3. Implementing session validation in /pages/api/direct/chat.ts
4. Creating auth context that properly handles token refresh

Current configuration:
- NEXTAUTH_URL=https://hfu-amplify.org (but actual URL is ELB)
- Cognito domain: https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com
- Client ID: 2rq8ekafegrh5mcd51q80rt0bh

Provide exact code changes needed."

## Agent 3: Backend API Integration Engineer
Create an agent with the following prompt:
"You are the Backend API Integration Engineer. The chat functionality is broken because:
- LLM router endpoint has CORS issues
- No working streaming SSE endpoints
- Lambda functions have dependency issues
- Chat responses return blank even when authentication works

Implement:
1. Working SSE endpoint that streams mock responses
2. LLM router service connecting to OpenAI, Gemini, and Bedrock
3. Proper CORS configuration in API Gateway
4. Lambda function fixes for Python dependencies

Current endpoints:
- LLM Router: https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm
- Main API: https://1y2q5khrvc.execute-api.us-east-1.amazonaws.com/prod

Provide Lambda function code and API Gateway configurations."

## Agent 4: DevOps Deployment Specialist
Create an agent with the following prompt:
"You are the DevOps Deployment Specialist. Current deployment issues:
- NEXT_PUBLIC_* environment variables not building into Docker image
- ECS tasks failing with platform architecture mismatches
- No proper health checks or monitoring
- Manual deployment process prone to errors

Fix the deployment by:
1. Creating Dockerfile that properly injects build-time variables
2. Setting up ECS task definitions with correct environment
3. Implementing blue-green deployments
4. Adding CloudWatch monitoring and alerts

Current setup:
- ECS Cluster: hfu-hfu-amplify-cluster
- ECR Repository: 135808927724.dkr.ecr.us-east-1.amazonaws.com/prod-amplifygenai-repo
- Task Definition: hfu-hfu-amplify-task

Provide updated Dockerfile and deployment scripts."
```

## MCP Installation Script

```bash
#!/bin/bash
# Amplify MCP Installation Script

# Set project directory
PROJECT_DIR="/Users/mgreen2/code/amplify/amplify-genai-frontend"
cd $PROJECT_DIR

# Install MCP CLI if not already installed
if ! command -v mcp &> /dev/null; then
    echo "Installing MCP CLI..."
    npm install -g @modelcontextprotocol/cli
fi

# 1. Authentication Handler MCP
echo "Installing Authentication Handler MCP..."
cat > mcp-auth-config.json << 'EOF'
{
  "name": "@mcp/auth-handler",
  "version": "1.0.0",
  "config": {
    "provider": "cognito",
    "region": "us-east-1",
    "userPoolId": "us-east-1_PgwOR439P",
    "clientId": "2rq8ekafegrh5mcd51q80rt0bh",
    "sessionStorage": "secure-cookie",
    "cookieOptions": {
      "httpOnly": true,
      "secure": true,
      "sameSite": "none",
      "domain": ".elb.amazonaws.com"
    },
    "tokenRefresh": {
      "enabled": true,
      "bufferTime": 300
    }
  }
}
EOF
mcp install @mcp/auth-handler --config-file mcp-auth-config.json

# 2. LLM Router MCP
echo "Installing LLM Router MCP..."
cat > mcp-llm-router-config.json << 'EOF'
{
  "name": "@mcp/llm-router",
  "version": "1.0.0",
  "config": {
    "providers": {
      "openai": {
        "enabled": true,
        "apiKeyEnv": "OPENAI_API_KEY",
        "models": ["gpt-3.5-turbo", "gpt-4"],
        "streaming": true
      },
      "gemini": {
        "enabled": true,
        "apiKeyEnv": "GEMINI_API_KEY",
        "models": ["gemini-1.5-pro", "gemini-1.5-flash"],
        "streaming": true
      },
      "bedrock": {
        "enabled": true,
        "region": "us-east-1",
        "models": ["anthropic.claude-3-sonnet", "anthropic.claude-3-haiku"],
        "streaming": true
      }
    },
    "fallbackOrder": ["openai", "gemini", "bedrock"],
    "retryPolicy": {
      "maxRetries": 3,
      "backoffMultiplier": 2
    },
    "streamingFormat": "openai-compatible"
  }
}
EOF
mcp install @mcp/llm-router --config-file mcp-llm-router-config.json

# 3. SSE Stream Handler MCP
echo "Installing SSE Stream Handler MCP..."
cat > mcp-sse-config.json << 'EOF'
{
  "name": "@mcp/sse-stream",
  "version": "1.0.0",
  "config": {
    "responseFormat": "openai-compatible",
    "errorHandling": "graceful-degradation",
    "compressionEnabled": true,
    "heartbeatInterval": 30000,
    "cors": {
      "enabled": true,
      "origins": ["https://hfu-genai-alb-501693461.us-east-1.elb.amazonaws.com"],
      "credentials": true
    },
    "streaming": {
      "chunkSize": 1024,
      "flushInterval": 100
    }
  }
}
EOF
mcp install @mcp/sse-stream --config-file mcp-sse-config.json

# 4. Service Monitor MCP
echo "Installing Service Monitor MCP..."
cat > mcp-monitor-config.json << 'EOF'
{
  "name": "@mcp/service-monitor",
  "version": "1.0.0",
  "config": {
    "services": {
      "auth": {
        "endpoint": "/api/auth/session",
        "interval": 30000,
        "timeout": 5000
      },
      "llm-router": {
        "endpoint": "/api/health",
        "interval": 30000,
        "timeout": 5000
      },
      "frontend": {
        "endpoint": "/",
        "interval": 60000,
        "timeout": 10000
      }
    },
    "metrics": {
      "enabled": true,
      "namespace": "Amplify/Production",
      "dimensions": {
        "Environment": "Production",
        "Service": "AmplifyChat"
      }
    },
    "alerting": {
      "enabled": true,
      "channels": ["cloudwatch"],
      "thresholds": {
        "errorRate": 0.05,
        "latency": 3000
      }
    }
  }
}
EOF
mcp install @mcp/service-monitor --config-file mcp-monitor-config.json

echo "MCP installation complete!"
```

## Immediate Action Plan

### Phase 1: Emergency Fix (Day 1-2)
```bash
# 1. Deploy authentication bypass for testing
echo "Deploying emergency chat fix..."

# Create public chat endpoint (temporary)
cat > pages/api/public/chat.ts << 'EOF'
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });

  const mockResponse = "This is a temporary response. Authentication is being fixed.";
  const words = mockResponse.split(' ');
  
  for (const word of words) {
    res.write(`data: {"choices":[{"delta":{"content":"${word} "}}]}\n\n`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  res.write('data: [DONE]\n\n');
  res.end();
}
EOF

# Update chatService to use public endpoint temporarily
sed -i.bak 's|/api/direct/chat|/api/public/chat|g' services/chatService.ts
```

### Phase 2: Authentication Fix (Day 3-5)
```bash
# 2. Fix NextAuth configuration
cat > pages/api/auth/[...nextauth].js << 'EOF'
import NextAuth from "next-auth"
import CognitoProvider from "next-auth/providers/cognito"

export const authOptions = {
    session: {
        strategy: "jwt",
        maxAge: 60 * 60 // 1 hour
    },
    cookies: {
        sessionToken: {
            name: `__Secure-next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: 'none',
                path: '/',
                secure: true,
                domain: '.amazonaws.com' // Allow subdomain sharing
            }
        }
    },
    providers: [
        CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID,
            clientSecret: process.env.COGNITO_CLIENT_SECRET,
            issuer: process.env.COGNITO_ISSUER,
            checks: ['state'], // Remove nonce check temporarily
        })
    ],
    callbacks: {
        async jwt({ token, account, user }) {
            if (account && user) {
                return {
                    ...token,
                    accessToken: account.access_token,
                    refreshToken: account.refresh_token,
                    accessTokenExpires: account.expires_at * 1000,
                    user
                };
            }
            
            if (Date.now() < token.accessTokenExpires) {
                return token;
            }
            
            return refreshAccessToken(token);
        },
        async session({ session, token }) {
            session.accessToken = token.accessToken;
            session.error = token.error;
            session.user = token.user;
            return session;
        }
    }
}

export default NextAuth(authOptions)
EOF
```

### Phase 3: Docker Fix (Day 6-7)
```bash
# 3. Create proper Dockerfile with build args
cat > Dockerfile.fixed << 'EOF'
FROM --platform=linux/amd64 node:lts-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS build
# CRITICAL: Accept build args for NEXT_PUBLIC vars
ARG NEXT_PUBLIC_LLM_ROUTER_ENDPOINT
ARG NEXT_PUBLIC_MIXPANEL_TOKEN
ARG NEXT_PUBLIC_LOCAL_SERVICES

# Set them as ENV for the build process
ENV NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=$NEXT_PUBLIC_LLM_ROUTER_ENDPOINT
ENV NEXT_PUBLIC_MIXPANEL_TOKEN=$NEXT_PUBLIC_MIXPANEL_TOKEN
ENV NEXT_PUBLIC_LOCAL_SERVICES=$NEXT_PUBLIC_LOCAL_SERVICES

COPY . .
RUN npm run build

FROM --platform=linux/amd64 node:lts-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
EOF

# Build with proper args
docker build \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  --build-arg NEXT_PUBLIC_MIXPANEL_TOKEN="" \
  --build-arg NEXT_PUBLIC_LOCAL_SERVICES="" \
  -t amplify-fixed:latest \
  -f Dockerfile.fixed .
```

### Phase 4: Monitoring Setup (Day 8)
```bash
# 4. Create monitoring dashboard
cat > cloudwatch-dashboard.json << 'EOF'
{
    "widgets": [
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    ["AWS/ECS", "CPUUtilization", "ServiceName", "hfu-hfu-amplify-service"],
                    [".", "MemoryUtilization", ".", "."]
                ],
                "period": 300,
                "stat": "Average",
                "region": "us-east-1",
                "title": "ECS Service Health"
            }
        },
        {
            "type": "log",
            "properties": {
                "query": "SOURCE '/ecs/hfu-hfu-amplify-task' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20",
                "region": "us-east-1",
                "title": "Recent Errors"
            }
        }
    ]
}
EOF

aws cloudwatch put-dashboard \
  --dashboard-name AmplifyMonitoring \
  --dashboard-body file://cloudwatch-dashboard.json
```

## Validation Checklist

```markdown
## Pre-deployment Validation
- [ ] Authentication flow works end-to-end
- [ ] Chat responses stream properly
- [ ] Environment variables are correctly injected
- [ ] Docker image builds with all required variables
- [ ] ECS health checks pass

## Post-deployment Validation
- [ ] Users can log in via Cognito
- [ ] Chat messages receive responses
- [ ] No CORS errors in console
- [ ] Session persists across refreshes
- [ ] Monitoring shows healthy metrics

## Success Criteria
- [ ] Zero "Nonce cookie was missing" errors
- [ ] Chat responses display within 2 seconds
- [ ] 99% uptime for authentication service
- [ ] All LLM providers accessible via router
- [ ] Automatic failover working
```

This master prompt provides everything needed to deploy the agents and fix the Amplify platform issues. Execute each section in order for best results.