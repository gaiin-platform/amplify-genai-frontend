#!/bin/bash

# Script to update ECS task definition with proper environment variables

echo "Updating ECS Task Definition with environment variables..."

# Get current task definition
TASK_FAMILY="dev-amplifygenai-task"
TASK_DEF=$(aws ecs describe-task-definition --task-definition $TASK_FAMILY --region us-east-1)

# Update the task definition with environment variables
NEW_TASK_DEF=$(echo $TASK_DEF | jq --arg nextauth_secret "$NEXTAUTH_SECRET" \
  --arg nextauth_url "$NEXTAUTH_URL" \
  --arg cognito_client_id "$COGNITO_CLIENT_ID" \
  --arg cognito_client_secret "$COGNITO_CLIENT_SECRET" \
  --arg cognito_issuer "$COGNITO_ISSUER" \
  --arg cognito_domain "$COGNITO_DOMAIN" \
  --arg api_base_url "$API_BASE_URL" \
  --arg chat_endpoint "$CHAT_ENDPOINT" \
  '.taskDefinition | .containerDefinitions[0].environment = [
    {"name": "NEXTAUTH_SECRET", "value": $nextauth_secret},
    {"name": "NEXTAUTH_URL", "value": $nextauth_url},
    {"name": "COGNITO_CLIENT_ID", "value": $cognito_client_id},
    {"name": "COGNITO_CLIENT_SECRET", "value": $cognito_client_secret},
    {"name": "COGNITO_ISSUER", "value": $cognito_issuer},
    {"name": "COGNITO_DOMAIN", "value": $cognito_domain},
    {"name": "API_BASE_URL", "value": $api_base_url},
    {"name": "CHAT_ENDPOINT", "value": $chat_endpoint},
    {"name": "NODE_ENV", "value": "production"}
  ]')

# Register the new task definition
echo "$NEW_TASK_DEF" | jq '.family, .containerDefinitions, .cpu, .memory, .networkMode, .requiresCompatibilities, .taskRoleArn, .executionRoleArn' > new-task-def.json
aws ecs register-task-definition --cli-input-json file://new-task-def.json --region us-east-1

echo "Task definition updated. Now update the service to use the new revision."