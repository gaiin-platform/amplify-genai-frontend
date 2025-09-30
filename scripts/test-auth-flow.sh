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