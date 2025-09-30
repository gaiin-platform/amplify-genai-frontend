#!/bin/bash
set -e

echo "Building amplify-frontend:v40 with JWT fallbacks in multiple locations..."
echo "=================================================================="

# Verify our changes
echo "1. Checking JWT fallback in getClientJWT.ts..."
grep -n "JWT endpoint failed" utils/client/getClientJWT.ts || echo "WARNING: Fallback not found in getClientJWT.ts!"

echo -e "\n2. Checking JWT fallback in llm.ts..."
grep -n "Fallback: try to get token directly from session" utils/app/llm.ts || echo "WARNING: Fallback not found in llm.ts!"

# Build with no cache
echo -e "\n3. Starting clean build..."
docker build --platform linux/amd64 \
  --no-cache \
  --build-arg NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4= \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=true \
  --build-arg NEXT_PUBLIC_ENABLE_STREAMING=true \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://hdviynn2m4.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod \
  --build-arg NEXT_PUBLIC_APP_VERSION=1.0.40 \
  -t amplify-frontend:v40 .

echo "✅ Build complete!"

# Tag and push
docker tag amplify-frontend:v40 \
  135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v40

echo "Pushing to ECR..."
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v40

echo "✅ Push complete!"