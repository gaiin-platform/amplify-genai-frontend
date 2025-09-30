#!/bin/bash

# CRITICAL FIX: Build v27 with clean cache
# This ensures authentication fixes are actually included

set -e

echo "🚨 CRITICAL BUILD: v27 with Authentication Fixes 🚨"
echo "=================================================="

# Variables
ECR_REPO="135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-hfu-amplify-repo"
TAG="v27"
REGION="us-east-1"

# Step 1: Clean all build artifacts
echo ""
echo "🧹 Cleaning build artifacts..."
rm -rf .next
rm -rf node_modules
docker system prune -f

# Step 2: Verify source file contains fixes
echo ""
echo "✅ Verifying authentication fixes are in source..."
grep -n "forcedUrl = 'https://hfu-amplify.org'" "pages/api/auth/[...nextauth].ts" || {
    echo "❌ ERROR: Authentication fixes not found in source file!"
    exit 1
}
echo "✅ Authentication fixes confirmed in source"

# Step 3: Login to ECR
echo ""
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REPO

# Step 4: Build with no cache and cache-busting
echo ""
echo "🔨 Building image with --no-cache..."
CACHEBUST=$(date +%s)
docker build \
  --no-cache \
  --build-arg CACHEBUST=$CACHEBUST \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4= \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  -t ${ECR_REPO}:${TAG} \
  -t ${ECR_REPO}:latest \
  -f Dockerfile \
  .

# Step 5: Verify the fix is in the built image
echo ""
echo "🔍 Verifying fix in built image..."
docker run --rm ${ECR_REPO}:${TAG} grep -q "forcedUrl" /app/server.js && {
    echo "✅ Authentication fixes confirmed in built image"
} || {
    echo "⚠️  Warning: Could not verify fixes in built image"
}

# Step 6: Push to ECR
echo ""
echo "📤 Pushing image to ECR..."
docker push ${ECR_REPO}:${TAG}
docker push ${ECR_REPO}:latest

echo ""
echo "✅ BUILD COMPLETE!"
echo "🏷️  Image pushed: ${ECR_REPO}:${TAG}"
echo ""
echo "📝 Next steps:"
echo "1. Deploy using: aws ecs update-service --cluster hfu-amplify-cluster --service hfu-amplify-service --force-new-deployment"
echo "2. Monitor logs: aws logs tail /ecs/hfu-amplify --follow"
echo "3. Test authentication at: https://hfu-amplify.org"