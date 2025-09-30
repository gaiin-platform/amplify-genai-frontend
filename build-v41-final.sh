#!/bin/bash
set -e

echo "Building amplify-frontend:v41 - FINAL JWT FIX"
echo "============================================="

# Show what we're fixing
echo "This build fixes:"
echo "1. JWT endpoint to use getSession() and return accessToken"
echo "2. Includes version marker to verify deployment"
echo ""

# Build
docker build --platform linux/amd64 \
  --no-cache \
  --build-arg NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4= \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=true \
  --build-arg NEXT_PUBLIC_ENABLE_STREAMING=true \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://hdviynn2m4.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod \
  --build-arg NEXT_PUBLIC_APP_VERSION=1.0.41 \
  -t amplify-frontend:v41 .

echo "✅ Build complete!"

# Tag
docker tag amplify-frontend:v41 \
  135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v41

# Re-auth and push
echo "Re-authenticating with ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com

echo "Pushing to ECR..."
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v41

echo "✅ Push complete!"