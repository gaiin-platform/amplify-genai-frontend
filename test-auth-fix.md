# Comprehensive Authentication Fix Testing & Validation Plan

## Overview
This document provides a detailed testing plan to validate the authentication fix for the callback loop issue in the Amplify platform. The fix involves ensuring NextAuth properly handles ALB headers and constructs correct URLs.

## Key Configuration Details
- **Domain**: hfu-amplify.org
- **ALB DNS**: dev-amplifygenai-alb-1330217324.us-east-1.elb.amazonaws.com
- **Cognito Domain**: https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com
- **NextAuth URL**: https://hfu-amplify.org

## 1. Pre-Test Setup

### 1.1 Verify Environment Variables
```bash
# Check production environment variables
cat .env.production | grep -E "NEXTAUTH_URL|COGNITO_|NEXT_PUBLIC"

# Expected values:
# NEXTAUTH_URL=https://hfu-amplify.org
# COGNITO_CLIENT_ID=2rq8ekafegrh5mcd51q80rt0bh
# COGNITO_CLIENT_SECRET=<hidden>
# COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_PgwOR439P
# COGNITO_DOMAIN=https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com
```

### 1.2 Build and Deploy
```bash
# Build the Next.js application
npm run build

# Verify build output
ls -la .next/

# Deploy to ECS (ensure Docker image is updated)
docker build -t amplify-frontend .
docker tag amplify-frontend:latest 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest
docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:latest

# Force ECS service update
aws ecs update-service --cluster dev-amplifygenai-cluster --service dev-amplifygenai-service --force-new-deployment
```

## 2. Authentication Flow Test Script

### 2.1 Create test-auth-flow.sh
```bash
#!/bin/bash

# Configuration
DOMAIN="https://hfu-amplify.org"
ALB_DOMAIN="https://dev-amplifygenai-alb-1330217324.us-east-1.elb.amazonaws.com"
COGNITO_DOMAIN="https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com"
CLIENT_ID="2rq8ekafegrh5mcd51q80rt0bh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Authentication Flow Testing Script ==="
echo "Testing domain: $DOMAIN"
echo "Testing started at: $(date)"
echo ""

# Test 1: Check main page accessibility
echo -e "${YELLOW}Test 1: Main page accessibility${NC}"
response=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN")
if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ Main page accessible (HTTP $response)${NC}"
else
    echo -e "${RED}✗ Main page not accessible (HTTP $response)${NC}"
fi

# Test 2: Check login redirect URL construction
echo -e "\n${YELLOW}Test 2: Login redirect URL construction${NC}"
login_url=$(curl -s "$DOMAIN" | grep -oP 'signIn\([^)]+\)' | head -1)
echo "Login function call found: $login_url"

# Test 3: Verify NextAuth endpoint
echo -e "\n${YELLOW}Test 3: NextAuth endpoint accessibility${NC}"
nextauth_response=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/api/auth/providers")
if [ "$nextauth_response" = "200" ]; then
    echo -e "${GREEN}✓ NextAuth endpoint accessible${NC}"
    curl -s "$DOMAIN/api/auth/providers" | jq .
else
    echo -e "${RED}✗ NextAuth endpoint not accessible (HTTP $nextauth_response)${NC}"
fi

# Test 4: Check callback URL handling
echo -e "\n${YELLOW}Test 4: Callback URL construction${NC}"
callback_url="$DOMAIN/api/auth/callback/cognito"
echo "Expected callback URL: $callback_url"

# Test 5: Verify ALB headers are properly forwarded
echo -e "\n${YELLOW}Test 5: ALB header forwarding${NC}"
curl -s -I -H "X-Forwarded-Proto: https" -H "X-Forwarded-Host: hfu-amplify.org" "$ALB_DOMAIN" | grep -E "^(HTTP|Location|X-)"

echo -e "\n=== Testing completed at: $(date) ==="
```

### 2.2 Make script executable
```bash
chmod +x test-auth-flow.sh
./test-auth-flow.sh
```

## 3. ALB Redirect Rules Testing

### 3.1 Test ALB redirect rules with curl
```bash
# Test HTTP to HTTPS redirect
echo "Testing HTTP to HTTPS redirect..."
curl -I http://hfu-amplify.org

# Expected: 301 redirect to https://hfu-amplify.org

# Test direct ALB access
echo "Testing direct ALB access..."
curl -I https://dev-amplifygenai-alb-1330217324.us-east-1.elb.amazonaws.com

# Test with custom headers (simulating ALB forwarding)
echo "Testing with ALB headers..."
curl -I \
  -H "X-Forwarded-Proto: https" \
  -H "X-Forwarded-Host: hfu-amplify.org" \
  -H "X-Forwarded-Port: 443" \
  https://dev-amplifygenai-alb-1330217324.us-east-1.elb.amazonaws.com
```

### 3.2 Create ALB validation script
```bash
#!/bin/bash

# alb-validation.sh

echo "=== ALB Configuration Validation ==="

# Get ALB listener rules
echo -e "\n1. Checking ALB listeners..."
aws elbv2 describe-listeners --load-balancer-arn $(aws elbv2 describe-load-balancers --names dev-amplifygenai-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Get listener rules
echo -e "\n2. Checking listener rules..."
LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $(aws elbv2 describe-load-balancers --names dev-amplifygenai-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text) --query 'Listeners[?Port==`443`].ListenerArn' --output text)
aws elbv2 describe-rules --listener-arn $LISTENER_ARN

# Check target health
echo -e "\n3. Checking target health..."
TG_ARN=$(aws elbv2 describe-target-groups --names dev-amplifygenai-tg --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 describe-target-health --target-group-arn $TG_ARN
```

## 4. Callback Loop Detection Script

### 4.1 Create monitoring script for callback loops
```bash
#!/bin/bash

# monitor-callback-loop.sh

DOMAIN="https://hfu-amplify.org"
LOG_FILE="auth-flow-monitor.log"
MAX_REDIRECTS=10

echo "=== Monitoring Authentication Callback Loop ==="
echo "Monitoring started at: $(date)" | tee -a $LOG_FILE

# Function to follow redirects manually
follow_redirects() {
    local url=$1
    local count=0
    local visited_urls=()
    
    echo -e "\nStarting redirect chain from: $url" | tee -a $LOG_FILE
    
    while [ $count -lt $MAX_REDIRECTS ]; do
        # Check if we've seen this URL before (loop detection)
        for visited in "${visited_urls[@]}"; do
            if [ "$visited" = "$url" ]; then
                echo -e "❌ CALLBACK LOOP DETECTED!" | tee -a $LOG_FILE
                echo "URL appeared twice: $url" | tee -a $LOG_FILE
                return 1
            fi
        done
        
        visited_urls+=("$url")
        
        # Get headers
        response=$(curl -s -I -L --max-redirs 0 "$url")
        status=$(echo "$response" | grep -E "^HTTP" | tail -1 | awk '{print $2}')
        location=$(echo "$response" | grep -i "^Location:" | sed 's/Location: //i' | tr -d '\r')
        
        echo "[$count] $url -> HTTP $status" | tee -a $LOG_FILE
        
        if [ -n "$location" ]; then
            # Handle relative URLs
            if [[ "$location" =~ ^/ ]]; then
                location="${DOMAIN}${location}"
            fi
            url="$location"
            ((count++))
        else
            echo "Redirect chain completed successfully" | tee -a $LOG_FILE
            return 0
        fi
    done
    
    echo "❌ Max redirects ($MAX_REDIRECTS) exceeded!" | tee -a $LOG_FILE
    return 1
}

# Test the signin flow
echo -e "\n--- Testing Sign In Flow ---" | tee -a $LOG_FILE
signin_url="${DOMAIN}/api/auth/signin?callbackUrl=${DOMAIN}"
follow_redirects "$signin_url"

# Test the callback flow
echo -e "\n--- Testing Callback Flow ---" | tee -a $LOG_FILE
callback_url="${DOMAIN}/api/auth/callback/cognito?code=test&state=test"
follow_redirects "$callback_url"

echo -e "\nMonitoring completed at: $(date)" | tee -a $LOG_FILE
```

### 4.2 Make monitoring script executable
```bash
chmod +x monitor-callback-loop.sh
./monitor-callback-loop.sh
```

## 5. Browser Network Tab Inspection Guide

### 5.1 What to look for in Chrome DevTools

1. **Open Chrome DevTools** (F12 or right-click → Inspect)
2. **Go to Network tab**
3. **Check "Preserve log"** to keep history across redirects
4. **Clear existing logs**
5. **Click the login button**

### 5.2 Expected correct flow:
```
1. GET https://hfu-amplify.org/api/auth/signin
   Status: 302
   Location: https://hfu-amplify.org/api/auth/signin/cognito

2. GET https://hfu-amplify.org/api/auth/signin/cognito  
   Status: 302
   Location: https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com/oauth2/authorize?...

3. GET https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com/oauth2/authorize?...
   Status: 200 (Cognito login page)

4. POST https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com/login
   Status: 302
   Location: https://hfu-amplify.org/api/auth/callback/cognito?code=...&state=...

5. GET https://hfu-amplify.org/api/auth/callback/cognito?code=...&state=...
   Status: 302
   Location: https://hfu-amplify.org (or callbackUrl parameter)

6. GET https://hfu-amplify.org
   Status: 200 (Authenticated homepage)
```

### 5.3 Signs of callback loop:
- Same URL appears multiple times
- `/api/auth/callback/cognito` redirects back to signin
- URLs contain ALB domain instead of custom domain
- More than 10 redirects in the chain
- Browser shows "Too many redirects" error

## 6. QA Validation Checklist

### 6.1 Pre-deployment checks
- [ ] Environment variables are correctly set in .env.production
- [ ] NEXTAUTH_URL is set to https://hfu-amplify.org (not ALB URL)
- [ ] Docker image is built with latest code
- [ ] ECS service has been updated with new image

### 6.2 Authentication flow checks
- [ ] Login button is visible on homepage
- [ ] Clicking login redirects to Cognito (not infinite loop)
- [ ] Cognito login page shows correct redirect_uri
- [ ] After login, user returns to hfu-amplify.org (not ALB URL)
- [ ] User session is established (name shown in UI)
- [ ] Logout works correctly

### 6.3 Header validation checks
- [ ] NextAuth logs show correct X-Forwarded headers
- [ ] Constructed URL in logs matches https://hfu-amplify.org
- [ ] No ALB URLs appear in authentication flow
- [ ] Callback URL uses custom domain

### 6.4 Error handling checks
- [ ] Invalid credentials show appropriate error
- [ ] Session timeout redirects to login
- [ ] Direct access to protected routes redirects to login
- [ ] No infinite redirect loops occur

### 6.5 Performance checks
- [ ] Login completes within 5 seconds
- [ ] No unnecessary redirects in flow
- [ ] Session refresh works without re-login

## 7. Debugging Commands

### 7.1 Check ECS logs
```bash
# Get task ARN
TASK_ARN=$(aws ecs list-tasks --cluster dev-amplifygenai-cluster --service-name dev-amplifygenai-service --query 'taskArns[0]' --output text)

# View logs
aws logs tail /ecs/dev-amplifygenai --follow --filter-pattern "NextAuth"
```

### 7.2 Test NextAuth debug endpoint
```bash
# Get debug info
curl https://hfu-amplify.org/api/auth/session
curl https://hfu-amplify.org/api/auth/providers
curl https://hfu-amplify.org/api/auth/csrf
```

### 7.3 Validate DNS resolution
```bash
# Check DNS
dig hfu-amplify.org
nslookup hfu-amplify.org

# Check SSL certificate
openssl s_client -connect hfu-amplify.org:443 -servername hfu-amplify.org
```

## 8. Automated Test Suite

### 8.1 Create comprehensive test script
```bash
#!/bin/bash

# comprehensive-auth-test.sh

DOMAIN="https://hfu-amplify.org"
RESULTS_FILE="auth-test-results-$(date +%Y%m%d-%H%M%S).log"

echo "=== Comprehensive Authentication Test Suite ===" | tee $RESULTS_FILE
echo "Test started: $(date)" | tee -a $RESULTS_FILE
echo "" | tee -a $RESULTS_FILE

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    local expected_result=$3
    
    echo -n "Testing: $test_name... " | tee -a $RESULTS_FILE
    
    result=$(eval $test_command)
    
    if [ "$result" = "$expected_result" ]; then
        echo "✅ PASSED" | tee -a $RESULTS_FILE
        ((TESTS_PASSED++))
    else
        echo "❌ FAILED (Expected: $expected_result, Got: $result)" | tee -a $RESULTS_FILE
        ((TESTS_FAILED++))
    fi
}

# Run tests
run_test "Homepage accessibility" "curl -s -o /dev/null -w '%{http_code}' $DOMAIN" "200"
run_test "NextAuth providers endpoint" "curl -s -o /dev/null -w '%{http_code}' $DOMAIN/api/auth/providers" "200"
run_test "NextAuth CSRF endpoint" "curl -s -o /dev/null -w '%{http_code}' $DOMAIN/api/auth/csrf" "200"
run_test "HTTP to HTTPS redirect" "curl -s -o /dev/null -w '%{http_code}' http://hfu-amplify.org" "301"
run_test "Session endpoint (unauthenticated)" "curl -s $DOMAIN/api/auth/session | jq -r '.user // empty' | wc -c" "0"

# Summary
echo "" | tee -a $RESULTS_FILE
echo "=== Test Summary ===" | tee -a $RESULTS_FILE
echo "Tests Passed: $TESTS_PASSED" | tee -a $RESULTS_FILE
echo "Tests Failed: $TESTS_FAILED" | tee -a $RESULTS_FILE
echo "Test completed: $(date)" | tee -a $RESULTS_FILE

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n✅ All tests passed!" | tee -a $RESULTS_FILE
    exit 0
else
    echo -e "\n❌ Some tests failed!" | tee -a $RESULTS_FILE
    exit 1
fi
```

### 8.2 Make test suite executable
```bash
chmod +x comprehensive-auth-test.sh
./comprehensive-auth-test.sh
```

## 9. Manual Testing Procedure

### 9.1 Step-by-step manual test
1. Open incognito/private browser window
2. Navigate to https://hfu-amplify.org
3. Open Developer Tools → Network tab
4. Check "Preserve log"
5. Click "Login" button
6. Verify redirect to Cognito login page
7. Check URL contains correct redirect_uri
8. Enter test credentials
9. Submit login form
10. Verify redirect back to hfu-amplify.org
11. Check user is logged in (name displayed)
12. Test logout functionality
13. Verify session is cleared

### 9.2 Cross-browser testing
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers (iOS Safari, Chrome Android)

## 10. Post-Deployment Monitoring

### 10.1 CloudWatch Alarms
```bash
# Create alarm for authentication errors
aws cloudwatch put-metric-alarm \
  --alarm-name "amplify-auth-errors" \
  --alarm-description "Alert on authentication errors" \
  --metric-name "4XXError" \
  --namespace "AWS/ApplicationELB" \
  --statistic "Sum" \
  --period 300 \
  --threshold 10 \
  --comparison-operator "GreaterThanThreshold" \
  --evaluation-periods 1
```

### 10.2 Log monitoring queries
```bash
# Check for callback loops in logs
aws logs filter-log-events \
  --log-group-name "/ecs/dev-amplifygenai" \
  --filter-pattern "[timestamp, request_id, level=ERROR, message, ...rest]" \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

## 11. Rollback Plan

If issues are detected:

1. **Immediate rollback**:
   ```bash
   # Rollback to previous ECS task definition
   aws ecs update-service \
     --cluster dev-amplifygenai-cluster \
     --service dev-amplifygenai-service \
     --task-definition dev-amplifygenai-task:PREVIOUS_REVISION
   ```

2. **Verify rollback**:
   ```bash
   # Check service status
   aws ecs describe-services \
     --cluster dev-amplifygenai-cluster \
     --services dev-amplifygenai-service
   ```

3. **Document issues** for debugging

## Summary

This comprehensive testing plan ensures that:
1. The authentication fix properly handles ALB headers
2. URLs are correctly constructed using the custom domain
3. No callback loops occur
4. The user experience is seamless
5. Any issues can be quickly identified and resolved

Execute all tests in order and document results. Only proceed to production if all tests pass.