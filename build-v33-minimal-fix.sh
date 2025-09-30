#!/bin/bash
set -e

# v33 - Minimal fix for model availability without breaking health checks

echo "Building v33 with minimal fixes..."

# Run the build
npm run build

# Build Docker image for AMD64 architecture (with timeout to handle warnings)
timeout 300 docker buildx build \
  --platform linux/amd64 \
  -t amplify-genai-frontend:v33 \
  -f Dockerfile.ecr \
  --load \
  . || true

# Check if image was built
if ! docker images | grep -q "amplify-genai-frontend.*v33"; then
  echo "Error: Docker image was not built successfully"
  exit 1
fi

# Tag for ECR
docker tag amplify-genai-frontend:v33 135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-hfu-amplify-repo:v33

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com

# Push to ECR
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-hfu-amplify-repo:v33

echo "v33 image pushed successfully"