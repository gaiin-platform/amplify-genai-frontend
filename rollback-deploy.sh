#!/bin/bash

# Rollback Deployment Script for Amplify
# This script rolls back to the previous working deployment

set -e

echo "🔄 ROLLBACK DEPLOYMENT SCRIPT INITIATED 🔄"
echo "=========================================="

# Variables
CLUSTER="hfu-hfu-amplify-cluster"
SERVICE="hfu-hfu-amplify-service"
REGION="us-east-1"

# Step 1: Get task definition history
echo "📋 Fetching task definition history..."
FAMILY=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].taskDefinition' --output text | awk -F: '{print $(NF-1)}')

echo "Task definition family: $FAMILY"
echo ""
echo "Recent task definitions:"
aws ecs list-task-definitions --family-prefix $FAMILY --max-items 5 --sort DESC --query 'taskDefinitionArns[]' --output table

# Step 2: Get current and previous task definitions
CURRENT_TASK_DEF=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].taskDefinition' --output text)
CURRENT_REVISION=$(echo $CURRENT_TASK_DEF | awk -F: '{print $NF}')
PREVIOUS_REVISION=$((CURRENT_REVISION - 1))
PREVIOUS_TASK_DEF="${FAMILY}:${PREVIOUS_REVISION}"

echo ""
echo "Current task definition: $CURRENT_TASK_DEF"
echo "Rolling back to: $PREVIOUS_TASK_DEF"
echo ""

read -p "Do you want to proceed with rollback? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Rollback cancelled."
  exit 0
fi

# Step 3: Update service with previous task definition
echo "🔄 Rolling back ECS service..."
aws ecs update-service \
  --cluster $CLUSTER \
  --service $SERVICE \
  --task-definition $PREVIOUS_TASK_DEF \
  --force-new-deployment \
  --desired-count 2

echo ""
echo "⏳ Waiting for rollback to start..."
sleep 10

# Step 4: Monitor rollback
echo "📊 Monitoring rollback status..."
for i in {1..30}; do
  DEPLOYMENTS=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].deployments | length(@)' --output text)
  RUNNING_COUNT=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].runningCount' --output text)
  DESIRED_COUNT=$(aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].desiredCount' --output text)
  
  echo "⏱️  Attempt $i/30: Deployments: $DEPLOYMENTS, Running: $RUNNING_COUNT/$DESIRED_COUNT"
  
  if [ "$DEPLOYMENTS" -eq 1 ] && [ "$RUNNING_COUNT" -eq "$DESIRED_COUNT" ]; then
    echo "✅ Rollback completed successfully!"
    break
  fi
  
  sleep 20
done

# Step 5: Check service status
echo ""
echo "📋 Service Status After Rollback:"
aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].[serviceName,status,runningCount,desiredCount,taskDefinition]' --output table

# Step 6: Check ALB target health
echo ""
echo "🔍 Checking ALB target health..."
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups --names hfu-hfu-amplify-tg-3000 --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")

if [ -n "$TARGET_GROUP_ARN" ]; then
  aws elbv2 describe-target-health --target-group-arn $TARGET_GROUP_ARN --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State]' --output table
fi

echo ""
echo "✅ ROLLBACK COMPLETE!"
echo "🌐 Application should be accessible at: https://hfu-amplify.org"