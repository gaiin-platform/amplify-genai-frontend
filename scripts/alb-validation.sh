#!/bin/bash

# alb-validation.sh

echo "=== ALB Configuration Validation ==="

# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers --names dev-amplifygenai-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null)

if [ -z "$ALB_ARN" ]; then
    echo "Error: Could not find ALB 'dev-amplifygenai-alb'"
    exit 1
fi

echo "ALB ARN: $ALB_ARN"

# Get ALB listener rules
echo -e "\n1. Checking ALB listeners..."
aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --output table

# Get HTTPS listener ARN
LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --query 'Listeners[?Port==`443`].ListenerArn' --output text)

if [ -z "$LISTENER_ARN" ]; then
    echo "Error: Could not find HTTPS listener"
    exit 1
fi

# Get listener rules
echo -e "\n2. Checking listener rules..."
aws elbv2 describe-rules --listener-arn $LISTENER_ARN --output table

# Check target group
TG_NAME="dev-amplifygenai-tg"
echo -e "\n3. Checking target group: $TG_NAME"
TG_ARN=$(aws elbv2 describe-target-groups --names $TG_NAME --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null)

if [ -z "$TG_ARN" ]; then
    echo "Error: Could not find target group '$TG_NAME'"
    exit 1
fi

# Check target health
echo -e "\n4. Checking target health..."
aws elbv2 describe-target-health --target-group-arn $TG_ARN --output table

# Check ALB DNS
echo -e "\n5. ALB DNS Configuration"
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].DNSName' --output text)
echo "ALB DNS: $ALB_DNS"

# Test ALB connectivity
echo -e "\n6. Testing ALB connectivity..."
curl -I https://$ALB_DNS 2>/dev/null | head -n 5