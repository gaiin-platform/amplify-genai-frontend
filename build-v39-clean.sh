#!/bin/bash
set -e

echo "Building amplify-frontend:v39 with JWT fallback (clean build)..."
echo "=================================================="

# First, verify the getClientJWT.ts has our fallback code
echo "Verifying JWT fallback code is present..."
if grep -q "JWT endpoint failed, trying session directly" utils/client/getClientJWT.ts; then
    echo "✅ JWT fallback code confirmed in getClientJWT.ts"
else
    echo "❌ JWT fallback code NOT FOUND!"
    exit 1
fi

# Clean build with --no-cache to ensure all changes are included
echo "Starting clean build..."
docker build --platform linux/amd64 \
  --no-cache \
  --build-arg NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4= \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=true \
  --build-arg NEXT_PUBLIC_ENABLE_STREAMING=true \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://hdviynn2m4.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod \
  --build-arg NEXT_PUBLIC_APP_VERSION=1.0.39 \
  -t amplify-frontend:v39 .

echo "✅ Build complete!"

# Tag and push
docker tag amplify-frontend:v39 \
  135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v39

echo "Pushing to ECR..."
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v39

echo "✅ Push complete!"