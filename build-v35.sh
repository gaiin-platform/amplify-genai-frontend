#!/bin/bash
set -e

echo "Building amplify-frontend:v35 with JWT session fix..."

docker build --platform linux/amd64 \
  --no-cache \
  --build-arg NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4= \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=true \
  --build-arg NEXT_PUBLIC_ENABLE_STREAMING=true \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://hdviynn2m4.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod \
  -t amplify-frontend:v35 .

echo "✅ Build complete!"
echo ""
echo "Next steps:"
echo "1. Tag the image:"
echo "   docker tag amplify-frontend:v35 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v35"
echo ""
echo "2. Push to ECR:"
echo "   docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v35"