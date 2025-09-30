#!/bin/bash
# Quick build script for settings fix

echo "Building with settings fix..."

# Use buildx for better performance
docker buildx build \
  --platform linux/amd64 \
  --tag 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:settings-fix \
  --push \
  --cache-from type=registry,ref=135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest \
  -f Dockerfile.v10 \
  .

echo "Build complete!"