#!/bin/bash
set -e

echo "Pushing v10-force-handler to ECR and deploying..."

# Re-authenticate with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com

# Tag the image
docker tag amplify-frontend:v10-force-handler 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v10-force-handler
docker tag amplify-frontend:v10-force-handler 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest

# Push both tags
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v10-force-handler
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest

# Force new deployment
echo "Triggering ECS deployment..."
aws ecs update-service --cluster hfu-hfu-amplify-cluster --service hfu-hfu-amplify-service --force-new-deployment

echo ""
echo "✅ v10-force-handler deployed!"
echo ""
echo "This version FORCES all bedrock/gemini/openai requests through /api/chat/llm-handler"
echo "The handler converts JSON responses to SSE format for proper display"
echo ""
echo "Monitor deployment at: https://console.aws.amazon.com/ecs/home?region=us-east-1#/clusters/hfu-hfu-amplify-cluster/services/hfu-hfu-amplify-service/tasks"
echo ""
echo "Wait 3-5 minutes for deployment to complete, then:"
echo "1. Check network tab - requests should go to /api/chat/llm-handler"
echo "2. Chat responses should display properly"