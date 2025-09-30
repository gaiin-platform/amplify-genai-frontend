#!/bin/bash
set -e

# v34 - Client-side model override fix only

echo "Building v34 with client-side model override..."

# Run the build
npm run build

# Build Docker image for AMD64 architecture
docker buildx build \
  --platform linux/amd64 \
  -t amplify-genai-frontend:v34 \
  -f Dockerfile.ecr \
  --load \
  .

# Tag for ECR
docker tag amplify-genai-frontend:v34 135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-hfu-amplify-repo:v34

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com

# Push to ECR
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-hfu-amplify-repo:v34

echo "v34 image pushed successfully"