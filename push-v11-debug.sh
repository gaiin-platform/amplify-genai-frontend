#!/bin/bash
set -e

echo "Pushing v11-debug to ECR and deploying..."

# Re-authenticate with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com

# Tag the image
docker tag amplify-frontend:v11-debug 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v11-debug
docker tag amplify-frontend:v11-debug 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest

# Push both tags
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v11-debug
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest

# Update task definition and force deployment
echo "Updating task definition..."
aws ecs register-task-definition --family hfu-hfu-amplify-task --cli-input-json file://task-definition-v10.json > /dev/null

echo "Triggering ECS deployment..."
aws ecs update-service --cluster hfu-hfu-amplify-cluster --service hfu-hfu-amplify-service --force-new-deployment

echo ""
echo "✅ v11-debug deployed!"
echo ""
echo "This version includes:"
echo "- Debug handler with extensive logging"
echo "- Proper SSE format with role and index"
echo "- Word-by-word streaming"
echo ""
echo "Monitor deployment at: https://console.aws.amazon.com/ecs/home?region=us-east-1#/clusters/hfu-hfu-amplify-cluster/services/hfu-hfu-amplify-service/tasks"