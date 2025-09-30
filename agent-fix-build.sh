#!/bin/bash
set -e

echo "Building Amplify Frontend with Agent Fixes..."
echo "Version: agent-fixes-v1"
echo "Fixes included:"
echo "- SSR-safe settings.ts with proper hasOwnProperty calls"
echo "- Base64 transformation layer error handling"
echo "- TypeScript ES5 compatibility"
echo ""

# Copy production env file
cp .env.production .env.local

# Build the Next.js app
echo "Building Next.js application..."
npm run build

# Build Docker image with platform flag
echo "Building Docker image..."
docker build --platform linux/amd64 -t amplify-frontend:agent-fixes-v1 -f Dockerfile.simple .

# Tag for ECR
echo "Tagging for ECR..."
docker tag amplify-frontend:agent-fixes-v1 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:agent-fixes-v1
docker tag amplify-frontend:agent-fixes-v1 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest

echo "Build complete! Tagged as agent-fixes-v1"
echo ""
echo "To push to ECR, run:"
echo "aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com"
echo "docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:agent-fixes-v1"
echo "docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest"