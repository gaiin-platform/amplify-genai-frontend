# Amplify Platform Fix - Implementation Plan

## Quick Fix Path (Get Chat Working in 1 Hour)

### Step 1: Deploy Public Chat Endpoint (10 minutes)
```bash
# Create a temporary public endpoint that bypasses auth
cp solutions/sse-chat-endpoint.ts pages/api/public/chat.ts

# Update chat service to use public endpoint
sed -i.bak 's|/api/direct/chat|/api/public/chat|g' services/chatService.ts

# Test locally
npm run dev
```

### Step 2: Quick Docker Build (20 minutes)
```bash
# Use the production Dockerfile with build args
docker build \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT="https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm" \
  --build-arg NEXT_PUBLIC_API_URL="https://1y2q5khrvc.execute-api.us-east-1.amazonaws.com/prod" \
  -t amplify:quickfix \
  -f Dockerfile.production .

# Test the container locally
docker run -p 3000:3000 amplify:quickfix
```

### Step 3: Deploy to ECS (30 minutes)
```bash
# Run the deployment script
./solutions/deploy.sh
```

## Full Fix Path (Complete Solution in 1-2 Days)

### Day 1: Authentication Fix
1. **Morning**: Deploy NextAuth configuration fix
   - Copy `solutions/nextauth-config-fix.js` to `pages/api/auth/[...nextauth].js`
   - Test OAuth flow locally
   - Deploy to staging

2. **Afternoon**: Implement session management
   - Add token refresh logic
   - Test cookie persistence
   - Validate CORS headers

### Day 2: Backend Integration
1. **Morning**: Deploy SSE endpoint
   - Copy streaming endpoint to API
   - Test with mock responses
   - Verify streaming works

2. **Afternoon**: Connect LLM services
   - Deploy Lambda router function
   - Configure API Gateway
   - Test with real LLM calls

## Validation Checklist

### Quick Fix Validation
- [ ] Chat endpoint responds without auth
- [ ] Streaming responses display in UI
- [ ] Docker image builds with env vars
- [ ] ECS deployment succeeds

### Full Fix Validation  
- [ ] Users can log in via Cognito
- [ ] Sessions persist across refreshes
- [ ] No CORS errors in console
- [ ] Chat connects to real LLMs
- [ ] Monitoring shows healthy metrics

## Critical File Locations
- NextAuth Fix: `solutions/nextauth-config-fix.js`
- SSE Endpoint: `solutions/sse-chat-endpoint.ts`
- Dockerfile: `solutions/Dockerfile.production`
- Deploy Script: `solutions/deploy.sh`
- Lambda Router: `solutions/llm-router-lambda.py`
