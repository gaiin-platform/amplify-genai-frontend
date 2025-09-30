#!/bin/bash

# Debug Docker Build Script
# This script helps diagnose why code changes aren't making it to the Docker image

set -e

echo "🔍 DOCKER BUILD DEBUGGING 🔍"
echo "============================"

# Step 1: Check current file timestamps
echo ""
echo "📅 Current file timestamps:"
echo "Source file:"
ls -la "pages/api/auth/[...nextauth].ts"
echo ""
echo "Compiled files (if exist):"
ls -la ".next/server/pages/api/auth/[...nextauth].js" 2>/dev/null || echo "No compiled file in .next/server"
ls -la ".next/standalone/.next/server/pages/api/auth/[...nextauth].js" 2>/dev/null || echo "No compiled file in .next/standalone"

# Step 2: Clean build artifacts
echo ""
echo "🧹 Cleaning build artifacts..."
rm -rf .next

# Step 3: Check Docker build cache
echo ""
echo "🗄️  Docker build cache info:"
docker system df

# Step 4: Build with no cache
echo ""
echo "🔨 Building Docker image with --no-cache..."
docker build \
  --no-cache \
  --progress=plain \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXTAUTH_SECRET=dummy-build-secret \
  -t test-build:debug \
  . 2>&1 | tee build-debug.log

# Step 5: Inspect the built image
echo ""
echo "🔍 Inspecting built image..."
docker run --rm test-build:debug cat /app/server.js | head -20

echo ""
echo "📝 Build log saved to: build-debug.log"
echo "✅ Debug build complete!"