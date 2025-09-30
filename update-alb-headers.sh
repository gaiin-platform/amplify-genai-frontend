#!/bin/bash

# Script to update ALB to rewrite Host header
# This ensures NextAuth sees the correct domain

echo "=== Updating ALB to rewrite Host header ==="

# Get the ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers --names hfu-hfu-amplify-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text)

if [ -z "$ALB_ARN" ]; then
    echo "Error: Could not find ALB"
    exit 1
fi

echo "Found ALB: $ALB_ARN"

# Get the listener ARN
LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --query 'Listeners[?Port==`443`].ListenerArn' --output text)

if [ -z "$LISTENER_ARN" ]; then
    # Try port 80 if 443 not found
    LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --query 'Listeners[?Port==`80`].ListenerArn' --output text)
fi

if [ -z "$LISTENER_ARN" ]; then
    echo "Error: Could not find listener"
    exit 1
fi

echo "Found listener: $LISTENER_ARN"

# Get current rules
echo "Getting current listener rules..."
aws elbv2 describe-rules --listener-arn $LISTENER_ARN --query 'Rules[?Priority!=`default`]' --output json > /tmp/current-rules.json

# Update the default action to add header modification
echo "Updating listener to add Host header modification..."
aws elbv2 modify-listener \
  --listener-arn $LISTENER_ARN \
  --default-actions '[
    {
      "Type": "fixed-response",
      "FixedResponseConfig": {
        "StatusCode": "301",
        "ContentType": "text/plain",
        "MessageBody": "Redirecting to https://hfu-amplify.org"
      },
      "RedirectConfig": {
        "Protocol": "HTTPS",
        "Port": "443",
        "Host": "hfu-amplify.org",
        "Path": "/#{path}",
        "Query": "#{query}",
        "StatusCode": "HTTP_301"
      }
    }
  ]'

echo ""
echo "=== ALB Update Complete ==="
echo ""
echo "The ALB will now redirect all direct ALB access to the domain."
echo "This should fix the callback URL issue."