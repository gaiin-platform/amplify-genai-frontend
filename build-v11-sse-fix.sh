#!/bin/bash
set -e

echo "Building Amplify Frontend v11 - SSE Format Fix"
echo "- Streams responses word by word"
echo "- Properly includes finish_reason signal"
echo "- Fixed escaping for special characters"
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
  -t amplify-frontend:v11-sse-fix \
  -f Dockerfile.standalone \
  .

echo ""
echo "Build complete! Tagged as v11-sse-fix"
echo ""
echo "This version will:"
echo "1. Stream responses word by word (not all at once)"
echo "2. Include proper finish_reason signal"
echo "3. Properly escape special characters"
echo "4. Fix the chat display issue"