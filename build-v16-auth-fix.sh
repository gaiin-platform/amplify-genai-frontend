#!/bin/bash
set -e

echo "Building Amplify Frontend v16 - Auth Fix"
echo "- Fixed login callback URL issue"
echo "- Force NEXTAUTH_URL to use proper domain"
echo "- Includes v15 fixes (DNS, TypeScript, SSE)"
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
  -t amplify-frontend:v16-auth-fix \
  -f Dockerfile.standalone \
  .

echo ""
echo "Build complete! Tagged as v16-auth-fix"
echo ""
echo "Deploying to ECR..."
docker tag amplify-frontend:v16-auth-fix 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v16-auth-fix
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v16-auth-fix

echo ""
echo "Pushed to ECR. Ready for ECS deployment."