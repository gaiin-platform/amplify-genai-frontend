#!/bin/bash
set -e

echo "Building amplify-frontend:v43 - Simple JWT Fix"
echo "=============================================="
echo "Using getToken from next-auth/jwt (no complex imports)"

# Build
docker build --platform linux/amd64 \
  --build-arg NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4= \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=true \
  --build-arg NEXT_PUBLIC_ENABLE_STREAMING=true \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://hdviynn2m4.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod \
  --build-arg NEXT_PUBLIC_APP_VERSION=1.0.43 \
  -t amplify-frontend:v43 .

echo "✅ Build complete!"

# Tag and push
docker tag amplify-frontend:v43 \
  135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v43

echo "Pushing to ECR..."
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v43

echo "✅ Push complete!"