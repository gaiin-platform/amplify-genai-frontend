#!/bin/bash
echo "DevOps Deployment Specialist - Creating deployment fixes..."

# Create fixed Dockerfile
cat > Dockerfile.production << 'EODOCK'
# Production-ready Dockerfile with proper env handling
FROM --platform=linux/amd64 node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM --platform=linux/amd64 node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
ENV NEXT_TELEMETRY_DISABLED 1

# CRITICAL: Build arguments for Next.js public environment variables
ARG NEXT_PUBLIC_LLM_ROUTER_ENDPOINT
ARG NEXT_PUBLIC_MIXPANEL_TOKEN
ARG NEXT_PUBLIC_LOCAL_SERVICES
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_COGNITO_CLIENT_ID
ARG NEXT_PUBLIC_COGNITO_USER_POOL_ID
ARG NEXT_PUBLIC_COGNITO_DOMAIN

# Set them as ENV for the build process
ENV NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=$NEXT_PUBLIC_LLM_ROUTER_ENDPOINT
ENV NEXT_PUBLIC_MIXPANEL_TOKEN=$NEXT_PUBLIC_MIXPANEL_TOKEN
ENV NEXT_PUBLIC_LOCAL_SERVICES=$NEXT_PUBLIC_LOCAL_SERVICES
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_COGNITO_CLIENT_ID=$NEXT_PUBLIC_COGNITO_CLIENT_ID
ENV NEXT_PUBLIC_COGNITO_USER_POOL_ID=$NEXT_PUBLIC_COGNITO_USER_POOL_ID
ENV NEXT_PUBLIC_COGNITO_DOMAIN=$NEXT_PUBLIC_COGNITO_DOMAIN

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM --platform=linux/amd64 node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
EODOCK

# Create deployment script
cat > deploy.sh << 'EODEPLOY'
#!/bin/bash
set -e

# Configuration
ECR_REPO="135808927724.dkr.ecr.us-east-1.amazonaws.com/prod-amplifygenai-repo"
IMAGE_TAG="v$(date +%Y%m%d-%H%M%S)"
ECS_CLUSTER="hfu-hfu-amplify-cluster"
ECS_SERVICE="hfu-hfu-amplify-service"
TASK_FAMILY="hfu-hfu-amplify-task"

echo "🚀 Starting Amplify deployment..."

# Step 1: Build Docker image with all required build args
echo "📦 Building Docker image..."
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_LLM_ROUTER_ENDPOINT="https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm" \
  --build-arg NEXT_PUBLIC_API_URL="https://1y2q5khrvc.execute-api.us-east-1.amazonaws.com/prod" \
  --build-arg NEXT_PUBLIC_COGNITO_CLIENT_ID="2rq8ekafegrh5mcd51q80rt0bh" \
  --build-arg NEXT_PUBLIC_COGNITO_USER_POOL_ID="us-east-1_PgwOR439P" \
  --build-arg NEXT_PUBLIC_COGNITO_DOMAIN="https://cognito-idp.us-east-1.amazonaws.com" \
  --build-arg NEXT_PUBLIC_MIXPANEL_TOKEN="" \
  --build-arg NEXT_PUBLIC_LOCAL_SERVICES="" \
  -t amplify:${IMAGE_TAG} \
  -f Dockerfile.production .

# Step 2: Tag for ECR
echo "🏷️  Tagging image..."
docker tag amplify:${IMAGE_TAG} ${ECR_REPO}:${IMAGE_TAG}
docker tag amplify:${IMAGE_TAG} ${ECR_REPO}:latest

# Step 3: Push to ECR
echo "⬆️  Pushing to ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${ECR_REPO}
docker push ${ECR_REPO}:${IMAGE_TAG}
docker push ${ECR_REPO}:latest

# Step 4: Update ECS task definition
echo "📝 Updating task definition..."
TASK_DEFINITION=$(aws ecs describe-task-definition --task-definition ${TASK_FAMILY} --query 'taskDefinition')

# Update the image in the task definition
NEW_TASK_DEF=$(echo $TASK_DEFINITION | jq --arg IMAGE "${ECR_REPO}:${IMAGE_TAG}" '.containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn) | del(.revision) | del(.status) | del(.requiresAttributes) | del(.compatibilities) | del(.registeredAt) | del(.registeredBy)')

# Register new task definition
NEW_TASK_ARN=$(aws ecs register-task-definition --cli-input-json "$NEW_TASK_DEF" --query 'taskDefinition.taskDefinitionArn' --output text)

echo "✅ New task definition: $NEW_TASK_ARN"

# Step 5: Update ECS service
echo "🔄 Updating ECS service..."
aws ecs update-service \
  --cluster ${ECS_CLUSTER} \
  --service ${ECS_SERVICE} \
  --task-definition ${NEW_TASK_ARN} \
  --force-new-deployment

echo "⏳ Waiting for deployment to stabilize..."
aws ecs wait services-stable --cluster ${ECS_CLUSTER} --services ${ECS_SERVICE}

echo "✅ Deployment complete!"
echo "🌐 Application URL: https://hfu-genai-alb-501693461.us-east-1.elb.amazonaws.com"
EODEPLOY

chmod +x deploy.sh

# Create health check endpoint
cat > health-check.ts << 'EOHEALTH'
// pages/api/health.ts - Health check endpoint
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: {
      node: process.version,
      nextAuth: !!process.env.NEXTAUTH_URL,
      llmRouter: !!process.env.NEXT_PUBLIC_LLM_ROUTER_ENDPOINT,
    }
  };
  
  res.status(200).json(health);
}
EOHEALTH

echo "✓ DevOps solutions created"
