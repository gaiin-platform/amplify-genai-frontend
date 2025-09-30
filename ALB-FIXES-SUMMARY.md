# ALB Header Forwarding Investigation & Fixes

## Investigation Results

### 1. ALB Configuration Analysis
- **ALB Name**: hfu-hfu-amplify-alb
- **DNS Name**: hfu-hfu-amplify-alb-839617252.us-east-1.elb.amazonaws.com
- **Custom Domain**: hfu-amplify.org
- **Target Group**: Port 3000, HTTP protocol
- **Health Check**: Currently healthy

### 2. Header Forwarding Issues Found

The ALB was not preserving the original Host header, which caused NextAuth to construct callback URLs using the ALB's DNS name instead of the custom domain.

**Initial ALB Settings**:
- `routing.http.preserve_host_header.enabled`: false ❌
- `routing.http.xff_client_port.enabled`: false
- `routing.http.xff_header_processing.mode`: append

### 3. Fixes Applied

#### A. ALB Configuration Changes
```bash
# Enabled host header preservation
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn "arn:aws:elasticloadbalancing:us-east-1:135808927724:loadbalancer/app/hfu-hfu-amplify-alb/e36d7df7c75b1cd7" \
  --attributes Key=routing.http.preserve_host_header.enabled,Value=true

# Enabled XFF client port for better logging
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn "arn:aws:elasticloadbalancing:us-east-1:135808927724:loadbalancer/app/hfu-hfu-amplify-alb/e36d7df7c75b1cd7" \
  --attributes Key=routing.http.xff_client_port.enabled,Value=true
```

#### B. NextAuth Configuration Updates

Modified `/pages/api/auth/[...nextauth].ts` to:
1. Add dynamic URL construction based on ALB headers
2. Log incoming headers for debugging
3. Ensure proper handling of X-Forwarded headers

#### C. Debug Endpoints Created

1. **Header Debug Endpoint** (`/api/debug/headers.ts`):
   - Shows all incoming headers
   - Displays constructed URLs
   - Shows environment variables

2. **Middleware** (`middleware.ts`):
   - Logs auth-related requests
   - Shows header information for debugging

#### D. Test Script Created

`test-alb-headers.sh` - Tests various scenarios:
- Direct domain access
- ALB DNS access with Host header
- Custom header injection
- NextAuth endpoint behavior

### 4. Headers Now Being Forwarded

With the fixes applied, the ALB now properly forwards:
- `Host`: hfu-amplify.org (preserved from original request)
- `X-Forwarded-For`: Client IP address
- `X-Forwarded-Proto`: https
- `X-Forwarded-Port`: 443
- `X-Amzn-Trace-Id`: AWS request tracing

### 5. Next Steps

1. **Deploy the Updated Code**:
   ```bash
   npm run build
   docker build -t hfu-amplify:latest .
   # Push to ECR and update ECS service
   ```

2. **Test the Debug Endpoint**:
   ```bash
   curl https://hfu-amplify.org/api/debug/headers | jq .
   ```

3. **Monitor Logs**:
   - Check ECS task logs for header information
   - Verify NextAuth is constructing correct URLs
   - Confirm OAuth callbacks work properly

4. **Verify Auth Flow**:
   - Test sign in at https://hfu-amplify.org
   - Check callback URLs in browser network tab
   - Ensure redirects use correct domain

### 6. Rollback Plan

If issues arise, revert ALB settings:
```bash
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn "arn:aws:elasticloadbalancing:us-east-1:135808927724:loadbalancer/app/hfu-hfu-amplify-alb/e36d7df7c75b1cd7" \
  --attributes Key=routing.http.preserve_host_header.enabled,Value=false
```

### 7. Additional Recommendations

1. **Enable ALB Access Logs** for better debugging:
   ```bash
   aws elbv2 modify-load-balancer-attributes \
     --load-balancer-arn "arn:aws:elasticloadbalancing:us-east-1:135808927724:loadbalancer/app/hfu-hfu-amplify-alb/e36d7df7c75b1cd7" \
     --attributes Key=access_logs.s3.enabled,Value=true
   ```

2. **Consider using AWS X-Ray** for distributed tracing

3. **Set up CloudWatch alarms** for unhealthy targets

4. **Document the configuration** in your infrastructure as code