#!/bin/bash
set -e

echo "Building Amplify Frontend v12 - Final SSE Fix"
echo "- Added flush() to ensure proper streaming"
echo "- Small delays between words"
echo "- Simple test endpoint included"
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
  -t amplify-frontend:v12-final \
  -f Dockerfile.standalone \
  .

echo ""
echo "Build complete! Tagged as v12-final"