#!/bin/bash

# Push v24 AMD64 image to ECR
# This script pushes the AMD64-specific build to ECR

set -e

echo "=== Pushing v24 AMD64 to ECR ==="

# Get ECR login token
echo "Authenticating with ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com

# Push the v24-amd64 tag
echo "Pushing v24-amd64 tag..."
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v24-amd64

# Push the latest tag
echo "Pushing latest tag..."
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest

# Force ECS service update
echo "Forcing ECS service update..."
aws ecs update-service \
  --cluster hfu-hfu-amplify-cluster \
  --service hfu-hfu-amplify-service \
  --force-new-deployment

# Wait a moment for the deployment to start
sleep 5

# Show deployment status
echo ""
echo "=== Deployment Status ==="
aws ecs describe-services \
  --cluster hfu-hfu-amplify-cluster \
  --services hfu-hfu-amplify-service \
  --query 'services[0].{DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount,Deployments:deployments[*].{Status:status,TaskDef:taskDefinition,DesiredCount:desiredCount,RunningCount:runningCount}}' \
  --output table

echo ""
echo "=== Recent Events ==="
aws ecs describe-services \
  --cluster hfu-hfu-amplify-cluster \
  --services hfu-hfu-amplify-service \
  --query 'services[0].events[0:5].[createdAt,message]' \
  --output table

echo ""
echo "✓ Push complete!"
echo ""
echo "Monitor deployment progress:"
echo "  watch 'aws ecs describe-services --cluster hfu-hfu-amplify-cluster --services hfu-hfu-amplify-service --query \"services[0].deployments\" --output table'"