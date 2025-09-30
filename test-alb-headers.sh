#!/bin/bash

# Test script to check ALB header forwarding

DOMAIN="hfu-amplify.org"
ALB_DNS="hfu-hfu-amplify-alb-839617252.us-east-1.elb.amazonaws.com"

echo "=== Testing ALB Header Forwarding ==="
echo ""

# Test 1: Direct request to debug endpoint via domain
echo "1. Testing debug endpoint via domain (https://$DOMAIN/api/debug/headers):"
curl -s -H "Accept: application/json" \
     -H "User-Agent: ALB-Test" \
     "https://$DOMAIN/api/debug/headers" | jq '.'

echo ""
echo "2. Testing debug endpoint via ALB DNS (https://$ALB_DNS/api/debug/headers):"
curl -s -k -H "Accept: application/json" \
     -H "User-Agent: ALB-Test" \
     -H "Host: $DOMAIN" \
     "https://$ALB_DNS/api/debug/headers" | jq '.'

echo ""
echo "3. Testing auth endpoint headers via domain:"
curl -s -H "Accept: application/json" \
     -H "User-Agent: ALB-Test" \
     "https://$DOMAIN/api/auth/providers" | jq '.'

echo ""
echo "4. Testing with custom X-Forwarded headers:"
curl -s -H "Accept: application/json" \
     -H "X-Forwarded-Proto: https" \
     -H "X-Forwarded-Host: $DOMAIN" \
     -H "X-Forwarded-For: 1.2.3.4" \
     "https://$DOMAIN/api/debug/headers" | jq '.headers'

echo ""
echo "=== Testing NextAuth Callback URL Construction ==="
echo ""

# Test 5: Check what URL NextAuth constructs
echo "5. Testing NextAuth signin endpoint:"
curl -s -I "https://$DOMAIN/api/auth/signin" | grep -E "(Location|Set-Cookie)"

echo ""
echo "6. Testing NextAuth callback endpoint:"
curl -s -I "https://$DOMAIN/api/auth/callback/cognito" | grep -E "(Location|Set-Cookie)"

echo ""
echo "=== Done ==="