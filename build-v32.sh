#!/bin/bash
set -e

echo "Building amplify-frontend:v32 with JWT debug code..."

docker build --platform linux/amd64 \
  --build-arg NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4= \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=true \
  --build-arg NEXT_PUBLIC_ENABLE_STREAMING=true \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://hdviynn2m4.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod \
  -t amplify-frontend:v32 .

echo "✅ Build complete!"
echo ""
echo "Next steps:"
echo "1. Tag the image:"
echo "   docker tag amplify-frontend:v32 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v32"
echo ""
echo "2. Login to ECR:"
echo "   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com"
echo ""
echo "3. Push the image:"
echo "   docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v32"