#!/bin/bash
set -e

echo "Building amplify-frontend:v37 with client-side JWT fallback..."

docker build --platform linux/amd64 \
  --no-cache \
  --build-arg NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4= \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=true \
  --build-arg NEXT_PUBLIC_ENABLE_STREAMING=true \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://hdviynn2m4.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod \
  -t amplify-frontend:v37 .

echo "✅ Build complete!"

# Tag and push
docker tag amplify-frontend:v37 \
  135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v37

echo "Pushing to ECR..."
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v37

echo "✅ Push complete!"