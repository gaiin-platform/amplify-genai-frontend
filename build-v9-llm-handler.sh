#!/bin/bash
set -e

echo "Building Amplify Frontend v9 - LLM Handler Solution"
echo "- Routes LLM providers through local handler"
echo "- Converts JSON responses to SSE format"
echo "- Removes fallback logic that was bypassing the fix"
echo ""

# Build with all required NEXT_PUBLIC variables
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT="https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm" \
  --build-arg NEXT_PUBLIC_MIXPANEL_TOKEN="" \
  --build-arg NEXT_PUBLIC_LOCAL_SERVICES="" \
  --build-arg NEXT_PUBLIC_API_URL="https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod" \
  --build-arg NEXT_PUBLIC_COGNITO_CLIENT_ID="2rq8ekafegrh5mcd51q80rt0bh" \
  --build-arg NEXT_PUBLIC_COGNITO_USER_POOL_ID="us-east-1_PgwOR439P" \
  --build-arg NEXT_PUBLIC_COGNITO_DOMAIN="https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com" \
  -t amplify-frontend:v9-llm-handler \
  -f Dockerfile.standalone \
  .

echo ""
echo "Build complete! Tagged as v9-llm-handler"
echo ""
echo "This version will:"
echo "1. Route OpenAI/Gemini/Bedrock through /api/chat/llm-handler"
echo "2. Convert JSON responses to SSE format"
echo "3. Display chat responses properly"