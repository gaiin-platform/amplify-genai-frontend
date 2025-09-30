# Amplify v21 Deployment Plan - Complete Integration

## Current Status
- **Current ECS Image**: v20-cognito-fix (deployed 2025-08-29T07:56:46)
- **ECR Repository**: 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo
- **Issues to Fix**:
  1. Authentication showing "credentials" provider instead of Cognito
  2. Chat text not displaying in responses
  3. Missing critical environment variables

## v21 Integration Summary

### 1. Authentication Fixes
- **Root Cause**: Stale build artifact and missing `NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER` environment variable
- **Solution**: 
  - Clean build with proper environment variables
  - Ensure NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito is set at build time
  - Verify [...nextauth].ts uses Cognito provider configuration

### 2. Chat Text Display Fixes
- **Root Cause**: SSE format mismatch and React memoization issues
- **Solutions**:
  - Update amplify-handler.ts to send OpenAI-compatible SSE format
  - Fix MemoizedChatMessage comparison function to allow re-renders during streaming
  - Add null safety checks in usePromptFinderService and MemoizedReactMarkdown

### 3. Environment Variable Fixes
- **Missing Variables**:
  - NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito
  - NEXT_PUBLIC_AUTH_ENABLED=true
  - NEXT_PUBLIC_ENABLE_STREAMING=true
  - NEXT_PUBLIC_API_BASE_URL
  - NEXT_PUBLIC_APP_NAME
  - NEXT_PUBLIC_APP_VERSION

## Deployment Steps

### Step 1: Create AWS Secrets (One-time setup)
```bash
./create-secrets.sh
```
This creates:
- `amplify/nextauth-secret` with NEXTAUTH_SECRET
- `amplify/cognito-credentials` with CLIENT_ID and CLIENT_SECRET

### Step 2: Build v21 Image
```bash
./build-v21-simple.sh
```
This will:
- Clean build artifacts (preserving source code)
- Create comprehensive .env.production
- Build Next.js with proper configuration
- Create Docker image with all build args
- Tag as v21 and latest

### Step 3: Push to ECR
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 135808927724.dkr.ecr.us-east-1.amazonaws.com

# Push v21
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:v21
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest
```

### Step 4: Update ECS Task Definition
```bash
# Register new task definition with proper environment variables and secrets
aws ecs register-task-definition --cli-input-json file://ecs-task-definition-v21.json
```

### Step 5: Deploy to ECS
```bash
# Force new deployment with updated task definition
aws ecs update-service \
  --cluster hfu-hfu-amplify-cluster \
  --service hfu-hfu-amplify-service \
  --task-definition hfu-hfu-amplify-task:52 \
  --force-new-deployment
```

### Step 6: Monitor Deployment
```bash
# Watch deployment progress
aws ecs describe-services \
  --cluster hfu-hfu-amplify-cluster \
  --services hfu-hfu-amplify-service \
  --query 'services[0].deployments[*].{Status: status, TaskDef: taskDefinition, Running: runningCount, Pending: pendingCount, UpdatedAt: updatedAt}'
```

## Verification Steps

### 1. Check Authentication
- Visit https://hfu-amplify.org
- Click login button
- Should redirect to Cognito login (NOT show "HFU Demo" credentials)
- After login, should return to application

### 2. Check Chat Functionality
- Send a test message
- Verify streaming text appears character by character
- Check browser console for any SSE parsing errors

### 3. Verify Environment Variables
```bash
# Check ECS task logs
aws logs tail /ecs/hfu-amplify --follow
```

## Rollback Plan
If issues occur:
```bash
# Rollback to v20
aws ecs update-service \
  --cluster hfu-hfu-amplify-cluster \
  --service hfu-hfu-amplify-service \
  --task-definition hfu-hfu-amplify-task:51 \
  --force-new-deployment
```

## Future Improvements
1. Implement CI/CD pipeline for automated deployments
2. Add health check endpoints for better monitoring
3. Move to AWS Secrets Manager for all sensitive values
4. Implement proper staging environment
5. Add automated tests for auth and chat functionality