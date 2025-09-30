#!/bin/bash

# Check if image tag was provided
if [ -z "$1" ]; then
    echo "Usage: $0 <image:tag>"
    echo "Example: $0 amplify-frontend:v6-stream-fix"
    exit 1
fi

IMAGE_TAG=$1
ECR_REPOSITORY="135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo"
AWS_REGION="us-east-1"

echo "Authenticating with ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPOSITORY

echo "Tagging image for ECR..."
docker tag $IMAGE_TAG $ECR_REPOSITORY:latest
docker tag $IMAGE_TAG $ECR_REPOSITORY:$IMAGE_TAG

echo "Pushing to ECR..."
docker push $ECR_REPOSITORY:latest
docker push $ECR_REPOSITORY:$IMAGE_TAG

echo "Forcing ECS deployment..."
aws ecs update-service --cluster hfu-hfu-amplify-cluster --service hfu-amplify-service --force-new-deployment --region $AWS_REGION

echo "Done! Deployment initiated."