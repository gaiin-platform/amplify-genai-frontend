#!/bin/bash

# Build and Push v24-amd64 Image with All Fixes
# This script builds the image with necessary environment variables for successful build

set -e

echo "🏗️  BUILD AND PUSH V24-AMD64 IMAGE 🏗️"
echo "======================================="

# Variables
ECR_REPO="135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-hfu-amplify-repo"
TAG="v24-amd64"
REGION="us-east-1"

# Step 1: Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REPO

# Step 2: Build the image with build arguments
echo "🔨 Building image with necessary build arguments..."
docker buildx build \
  --platform linux/amd64 \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXTAUTH_SECRET=dummy-build-secret \
  --build-arg NEXT_PUBLIC_API_URL=https://api.hfu-amplify.org \
  --build-arg NEXT_PUBLIC_BASE_URL=https://hfu-amplify.org \
  --build-arg NEXT_PUBLIC_DEFAULT_MODEL=claude-3-5-sonnet-20241022 \
  --build-arg NEXT_PUBLIC_DEFAULT_TEMPERATURE=0.5 \
  --build-arg DISABLE_STREAMING=false \
  --build-arg MODELS="claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022,claude-3-opus-20240229,gpt-4o,gpt-4o-mini,gpt-4-turbo,gemini-1.5-pro-002,gemini-1.5-flash-002,gemini-2.0-flash-exp,gemini-exp-1206" \
  -t ${ECR_REPO}:${TAG} \
  -t ${ECR_REPO}:latest \
  --load \
  .

# Step 3: Test the image locally (optional)
echo ""
read -p "Do you want to test the image locally? (yes/no): " test_local
if [ "$test_local" == "yes" ]; then
  echo "🧪 Testing image locally..."
  docker run -d --name amplify-test \
    -p 3001:3000 \
    -e NEXTAUTH_URL=http://localhost:3001 \
    -e NEXTAUTH_SECRET=test-secret \
    -e NODE_ENV=production \
    -e TRUST_HOST=true \
    ${ECR_REPO}:${TAG}
  
  echo "Container started. Testing in 10 seconds..."
  sleep 10
  
  curl -f http://localhost:3001/api/health || echo "Health check failed"
  
  echo ""
  read -p "Keep container running? (yes/no): " keep_running
  if [ "$keep_running" != "yes" ]; then
    docker stop amplify-test
    docker rm amplify-test
  fi
fi

# Step 4: Push to ECR
echo ""
echo "📤 Pushing image to ECR..."
docker push ${ECR_REPO}:${TAG}
docker push ${ECR_REPO}:latest

echo ""
echo "✅ BUILD AND PUSH COMPLETE!"
echo "🏷️  Image tags pushed:"
echo "   - ${ECR_REPO}:${TAG}"
echo "   - ${ECR_REPO}:latest"
echo ""
echo "📝 Next steps:"
echo "1. Update emergency-deploy.sh to use ':${TAG}' instead of ':demo-working'"
echo "2. Run ./emergency-deploy.sh to deploy the new image"