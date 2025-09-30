# ALB Header Configuration for NextAuth

## Problem
NextAuth was constructing incorrect callback URLs when running behind an AWS Application Load Balancer (ALB), using the ALB's DNS name instead of the custom domain.

## Root Cause
The ALB was not preserving the original Host header, causing NextAuth to receive the ALB's internal hostname instead of the actual domain name.

## Solution

### 1. ALB Configuration Changes

The following ALB attributes were modified:

```bash
# Enable host header preservation
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn "arn:aws:elasticloadbalancing:us-east-1:135808927724:loadbalancer/app/hfu-hfu-amplify-alb/e36d7df7c75b1cd7" \
  --attributes Key=routing.http.preserve_host_header.enabled,Value=true

# Enable XFF client port (optional, for better logging)
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn "arn:aws:elasticloadbalancing:us-east-1:135808927724:loadbalancer/app/hfu-hfu-amplify-alb/e36d7df7c75b1cd7" \
  --attributes Key=routing.http.xff_client_port.enabled,Value=true
```

### 2. NextAuth Configuration Updates

Updated `/pages/api/auth/[...nextauth].ts` to:
- Add a helper function to construct the correct URL from ALB headers
- Log incoming headers for debugging
- Dynamically set NEXTAUTH_URL if needed
- Ensure `trustHost: true` is set

### 3. Headers Forwarded by ALB

With the correct configuration, the ALB now forwards:
- `Host`: Original domain (hfu-amplify.org)
- `X-Forwarded-For`: Client IP address
- `X-Forwarded-Proto`: Protocol (http/https)
- `X-Forwarded-Port`: Port number
- `X-Amzn-Trace-Id`: AWS trace ID for debugging

### 4. Testing

Use the debug endpoint to verify headers:
```bash
curl https://hfu-amplify.org/api/debug/headers
```

Run the test script:
```bash
./test-alb-headers.sh
```

### 5. Environment Variables

Ensure these are set in production:
```env
NEXTAUTH_URL=https://hfu-amplify.org
NEXTAUTH_SECRET=<your-secret>
```

## Troubleshooting

If NextAuth still uses incorrect URLs:
1. Check ALB listener rules are forwarding to the correct target group
2. Verify the health check is passing
3. Check container logs for header information
4. Ensure no proxy or CDN is modifying headers
5. Verify DNS is pointing to the ALB

## Additional Notes

- The ALB uses host-based routing to forward requests
- SSL termination happens at the ALB level
- The backend containers receive HTTP traffic on port 3000
- NextAuth needs to construct URLs based on the original request, not the internal ALB communication