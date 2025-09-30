#!/bin/bash
set -e

echo "Building amplify-frontend:v33 with JWT debug code (NO CACHE)..."

# Build without cache to ensure our changes are included
docker build --platform linux/amd64 \
  --no-cache \
  --build-arg NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4= \
  --build-arg NEXTAUTH_URL=https://hfu-amplify.org \
  --build-arg NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=true \
  --build-arg NEXT_PUBLIC_ENABLE_STREAMING=true \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://hdviynn2m4.execute-api.us-east-1.amazonaws.com/prod/proxy/llm \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod \
  --build-arg NEXT_PUBLIC_APP_NAME="HFU Amplify" \
  --build-arg NEXT_PUBLIC_APP_VERSION="1.0.33" \
  -t amplify-frontend:v33 .

echo "✅ Build complete!"

# Tag for ECR
docker tag amplify-frontend:v33 \
  135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v33

# Push to ECR
echo ""
echo "Pushing to ECR..."
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v33

echo "✅ Push complete!"
echo ""
echo "Now deploying..."

# Create task definition
cat > /tmp/task-def-v33.json << 'EOF'
{
  "family": "hfu-hfu-amplify-task",
  "taskRoleArn": "arn:aws:iam::135808927724:role/hfu-hfu-amplify-task-role",
  "executionRoleArn": "arn:aws:iam::135808927724:role/ecsTaskExecutionRole",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "hfu-amplifyApp",
      "image": "135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v33",
      "portMappings": [
        {
          "containerPort": 3000,
          "hostPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "API_BASE_URL",
          "value": "https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod"
        },
        {
          "name": "CHAT_ENDPOINT",
          "value": "https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod/amplify/chat"
        },
        {
          "name": "NEXT_PUBLIC_APP_NAME",
          "value": "HFU Amplify"
        },
        {
          "name": "PORT",
          "value": "3000"
        },
        {
          "name": "TRUST_PROXY",
          "value": "true"
        },
        {
          "name": "NEXT_PUBLIC_API_BASE_URL",
          "value": "https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod"
        },
        {
          "name": "NEXT_PUBLIC_APP_VERSION",
          "value": "1.0.33"
        },
        {
          "name": "NEXT_PUBLIC_LLM_ROUTER_ENDPOINT",
          "value": "https://hdviynn2m4.execute-api.us-east-1.amazonaws.com/prod/proxy/llm"
        },
        {
          "name": "COGNITO_ISSUER",
          "value": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_PgwOR439P"
        },
        {
          "name": "NEXT_PUBLIC_AUTH_ENABLED",
          "value": "true"
        },
        {
          "name": "COGNITO_DOMAIN",
          "value": "https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com"
        },
        {
          "name": "NEXT_PUBLIC_ENABLE_STREAMING",
          "value": "true"
        },
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "NEXTAUTH_URL",
          "value": "https://hfu-amplify.org"
        },
        {
          "name": "NEXT_TELEMETRY_DISABLED",
          "value": "1"
        },
        {
          "name": "NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER",
          "value": "cognito"
        },
        {
          "name": "NEXTAUTH_URL_INTERNAL",
          "value": "https://hfu-amplify.org"
        }
      ],
      "secrets": [
        {
          "name": "NEXTAUTH_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:135808927724:secret:amplify/nextauth-secret-LIsree:NEXTAUTH_SECRET::"
        },
        {
          "name": "COGNITO_CLIENT_ID",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:135808927724:secret:amplify/cognito-credentials-IofBy1:CLIENT_ID::"
        },
        {
          "name": "COGNITO_CLIENT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:135808927724:secret:amplify/cognito-credentials-IofBy1:CLIENT_SECRET::"
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
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:3000/api/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-def-v33.json \
  --region us-east-1

# Deploy
aws ecs update-service \
  --cluster hfu-hfu-amplify-cluster \
  --service hfu-hfu-amplify-service \
  --task-definition hfu-hfu-amplify-task \
  --force-new-deployment \
  --region us-east-1

echo "✅ Deployment started!"
echo ""
echo "Wait for deployment to complete:"
echo "aws ecs wait services-stable --cluster hfu-hfu-amplify-cluster --services hfu-hfu-amplify-service --region us-east-1"
echo ""
echo "Then check logs:"
echo "aws logs tail /ecs/hfu-amplify --follow --region us-east-1"