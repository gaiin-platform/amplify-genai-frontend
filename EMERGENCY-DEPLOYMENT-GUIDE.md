# 🚨 EMERGENCY DEPLOYMENT GUIDE - AMPLIFY

## Current Status
- **ALB**: ✅ HEALTHY (1 target active)
- **ECS Service**: Running with `demo-working` image
- **Target**: 172.1.5.238 (healthy)
- **URL**: https://hfu-amplify.org

## Deployment Scripts Created

### 1. `./emergency-deploy.sh`
Forces deployment using the working demo image with all required configurations:
- Uses the proven `demo-working` image
- Includes all environment variables
- Sets TRUST_HOST=true for ALB compatibility
- Configures health checks
- Monitors deployment progress

### 2. `./rollback-deploy.sh`
Rolls back to the previous task definition if deployment fails:
- Shows task definition history
- Confirms before rollback
- Monitors rollback progress
- Checks ALB health after rollback

### 3. `./build-and-push-v24.sh`
Builds and pushes a new v24-amd64 image with all fixes:
- Includes all required build arguments
- Tests locally (optional)
- Pushes to ECR with proper tags

## Quick Deployment Steps

### Option 1: Deploy Using Working Image (RECOMMENDED)
```bash
./emergency-deploy.sh
```

### Option 2: Build and Deploy New Image
```bash
# First build and push
./build-and-push-v24.sh

# Then update emergency-deploy.sh line 16:
# Change: WORKING_IMAGE="${ECR_REPO}:demo-working"
# To: WORKING_IMAGE="${ECR_REPO}:v24-amd64"

# Deploy
./emergency-deploy.sh
```

### Option 3: Rollback if Issues
```bash
./rollback-deploy.sh
```

## Critical Environment Variables
The deployment includes these essential configurations:
- `TRUST_HOST=true` - Required for ALB header preservation
- `NEXTAUTH_URL=https://hfu-amplify.org`
- `NEXT_PUBLIC_API_URL=https://api.hfu-amplify.org`
- `NODE_ENV=production`
- `HOSTNAME=0.0.0.0`
- `PORT=3000`

## Monitoring Commands

Check service status:
```bash
aws ecs describe-services --cluster hfu-hfu-amplify-cluster --services hfu-hfu-amplify-service --query 'services[0].[status,runningCount,desiredCount]' --output table
```

Check ALB health:
```bash
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:135808927724:targetgroup/hfu-hfu-amplify-tg-3000/575fe13dc051395c --output table
```

View logs:
```bash
aws logs tail /ecs/hfu-amplify --follow
```

## Troubleshooting

### If deployment fails:
1. Check CloudWatch logs for errors
2. Verify ALB target health
3. Use rollback script if needed
4. Check task definition environment variables

### Common issues:
- **502 Bad Gateway**: Usually means container isn't responding on port 3000
- **Unhealthy targets**: Check health check endpoint (/api/health)
- **Container crashes**: Review CloudWatch logs for startup errors

## Next Steps After Successful Deployment

1. **Test the application**:
   - Visit https://hfu-amplify.org
   - Test authentication flow
   - Verify API connectivity

2. **Monitor performance**:
   - Watch CloudWatch metrics
   - Check ALB request counts
   - Monitor error rates

3. **Complete remaining features**:
   - Deploy backend services
   - Configure Cognito
   - Enable Canvas integration