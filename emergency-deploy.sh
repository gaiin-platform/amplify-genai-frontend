#!/bin/bash

# Emergency Deployment Script for Amplify
# This script forces deployment with a working image and all required configurations

set -e

echo "🚨 EMERGENCY DEPLOYMENT SCRIPT INITIATED 🚨"
echo "==========================================="

# Variables
CLUSTER="hfu-hfu-amplify-cluster"
SERVICE="hfu-hfu-amplify-service"
ECR_REPO="135808927724.dkr.ecr.us-east-1.amazonaws.com/hfu-hfu-amplify-repo"
WORKING_IMAGE="${ECR_REPO}:demo-working"
REGION="us-east-1"

# Step 1: Get current task definition
echo "📋 Fetching current task definition..."
TASK_DEF_ARN=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].taskDefinition' --output text)
FAMILY=$(aws ecs describe-task-definition --task-definition $TASK_DEF_ARN --query 'taskDefinition.family' --output text)

# Step 2: Create new task definition with all fixes
echo "🔧 Creating new task definition with all fixes..."
cat > emergency-task-def.json <<EOF
{
  "family": "$FAMILY",
  "taskRoleArn": "arn:aws:iam::135808927724:role/ecsTaskExecutionRole",
  "executionRoleArn": "arn:aws:iam::135808927724:role/ecsTaskExecutionRole",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "hfu-amplify-container",
      "image": "$WORKING_IMAGE",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "NEXT_PUBLIC_API_URL",
          "value": "https://api.hfu-amplify.org"
        },
        {
          "name": "PORT",
          "value": "3000"
        },
        {
          "name": "HOSTNAME",
          "value": "0.0.0.0"
        },
        {
          "name": "NEXTAUTH_URL",
          "value": "https://hfu-amplify.org"
        },
        {
          "name": "NEXT_PUBLIC_BASE_URL",
          "value": "https://hfu-amplify.org"
        },
        {
          "name": "DISABLE_STREAMING",
          "value": "false"
        },
        {
          "name": "TRUST_HOST",
          "value": "true"
        },
        {
          "name": "NEXT_PUBLIC_DEFAULT_TEMPERATURE",
          "value": "0.5"
        },
        {
          "name": "NEXT_PUBLIC_DEFAULT_MODEL",
          "value": "claude-3-5-sonnet-20241022"
        },
        {
          "name": "MODELS",
          "value": "claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022,claude-3-opus-20240229,gpt-4o,gpt-4o-mini,gpt-4-turbo,gemini-1.5-pro-002,gemini-1.5-flash-002,gemini-2.0-flash-exp,gemini-exp-1206"
        }
      ],
      "secrets": [
        {
          "name": "NEXTAUTH_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:135808927724:secret:amplify/nextauth-secret-LIsree"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/hfu-amplify",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

# Step 3: Register new task definition
echo "📝 Registering new task definition..."
NEW_TASK_DEF=$(aws ecs register-task-definition --cli-input-json file://emergency-task-def.json --query 'taskDefinition.taskDefinitionArn' --output text)
echo "✅ New task definition: $NEW_TASK_DEF"

# Step 4: Update service with new task definition
echo "🚀 Updating ECS service..."
aws ecs update-service \
  --cluster $CLUSTER \
  --service $SERVICE \
  --task-definition $NEW_TASK_DEF \
  --force-new-deployment \
  --desired-count 2 \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100" \
  --health-check-grace-period-seconds 60

echo ""
echo "⏳ Waiting for deployment to start..."
sleep 10

# Step 5: Monitor deployment
echo "📊 Monitoring deployment status..."
for i in {1..30}; do
  DEPLOYMENTS=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].deployments | length(@)' --output text)
  RUNNING_COUNT=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].runningCount' --output text)
  DESIRED_COUNT=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].desiredCount' --output text)
  
  echo "⏱️  Attempt $i/30: Deployments: $DEPLOYMENTS, Running: $RUNNING_COUNT/$DESIRED_COUNT"
  
  if [ "$DEPLOYMENTS" -eq 1 ] && [ "$RUNNING_COUNT" -eq "$DESIRED_COUNT" ]; then
    echo "✅ Deployment completed successfully!"
    break
  fi
  
  sleep 20
done

# Step 6: Check ALB target health
echo ""
echo "🔍 Checking ALB target health..."
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups --names hfu-hfu-amplify-tg-3000 --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")

if [ -n "$TARGET_GROUP_ARN" ]; then
  aws elbv2 describe-target-health --target-group-arn $TARGET_GROUP_ARN --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason]' --output table
else
  echo "⚠️  Could not find target group"
fi

# Step 7: Get service details
echo ""
echo "📋 Service Details:"
aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].[serviceName,status,runningCount,desiredCount,launchType]' --output table

# Step 8: Get running tasks
echo ""
echo "🔧 Running Tasks:"
TASK_ARNS=$(aws ecs list-tasks --cluster $CLUSTER --service $SERVICE --desired-status RUNNING --query 'taskArns' --output json)
if [ "$TASK_ARNS" != "[]" ]; then
  aws ecs describe-tasks --cluster $CLUSTER --tasks $(echo $TASK_ARNS | jq -r '.[]') --query 'tasks[*].[taskArn,lastStatus,cpu,memory]' --output table
fi

echo ""
echo "✅ EMERGENCY DEPLOYMENT COMPLETE!"
echo "🌐 Application should be accessible at: https://hfu-amplify.org"
echo ""
echo "📝 Next Steps:"
echo "1. Monitor CloudWatch logs for any errors"
echo "2. Test the application functionality"
echo "3. If issues persist, use rollback-deploy.sh"

# Cleanup
rm -f emergency-task-def.json