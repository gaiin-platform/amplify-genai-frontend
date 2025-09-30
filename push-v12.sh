#!/bin/bash
set -e

echo "Pushing v12-final to ECR and deploying..."

# Re-authenticate with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com

# Tag the image
docker tag amplify-frontend:v12-final 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v12-final
docker tag amplify-frontend:v12-final 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest

# Push both tags
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v12-final
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest

# Force new deployment
echo "Triggering ECS deployment..."
aws ecs update-service --cluster hfu-hfu-amplify-cluster --service hfu-hfu-amplify-service --force-new-deployment

echo ""
echo "✅ v12-final deployed!"
echo ""
echo "This version includes:"
echo "- res.flush() to force proper streaming"
echo "- 10ms delays between words for proper SSE handling"
echo "- Debug handler endpoint for troubleshooting"
echo ""
echo "Monitor at: https://console.aws.amazon.com/ecs/home?region=us-east-1#/clusters/hfu-hfu-amplify-cluster/services/hfu-hfu-amplify-service/tasks"