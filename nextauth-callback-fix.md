# NextAuth Callback URL Fix

## Problem
The NextAuth callback was using the ALB hostname (https://hfu-hfu-amplify-alb-839617252.us-east-1.elb.amazonaws.com) instead of the configured domain (https://hfu-amplify.org), causing a login redirect loop.

## Root Cause
When `signIn('cognito')` is called without specifying a `callbackUrl`, NextAuth automatically determines the callback URL from the request headers. Since the application is accessed through an ALB, the `Host` header contains the ALB hostname instead of the custom domain.

## Solution Implemented

### 1. Frontend Changes
Updated the `signIn` calls to explicitly specify the callback URL:

**File: `/pages/api/home/home.tsx`**
```typescript
// Before:
onClick={() => signIn('cognito')}

// After:
onClick={() => signIn('cognito', { callbackUrl: window.location.origin })}
```

**File: `/pages/assistants/[assistantSlug].tsx`**
```typescript
// Before:
onClick={() => signIn('cognito')}

// After:
onClick={() => signIn('cognito', { callbackUrl: window.location.origin })}
```

### 2. NextAuth Configuration Enhancement
Added a `redirect` callback in the NextAuth configuration to handle ALB URLs:

**File: `/pages/api/auth/[...nextauth].ts`**
```typescript
callbacks: {
    async redirect({ url, baseUrl }: any) {
        // Ensure we always redirect to the configured domain
        const configuredUrl = process.env.NEXTAUTH_URL || baseUrl;
        
        // If the url is relative, append it to our configured domain
        if (url.startsWith("/")) {
            return `${configuredUrl}${url}`;
        }
        
        // If the url is for the ALB, replace it with our configured domain
        if (url.includes("elb.amazonaws.com") && configuredUrl) {
            const urlObj = new URL(url);
            const configuredUrlObj = new URL(configuredUrl);
            urlObj.protocol = configuredUrlObj.protocol;
            urlObj.host = configuredUrlObj.host;
            urlObj.hostname = configuredUrlObj.hostname;
            urlObj.port = configuredUrlObj.port;
            return urlObj.toString();
        }
        
        // Allow callback URLs on the same origin
        const urlObj = new URL(url);
        const configuredUrlObj = new URL(configuredUrl);
        if (urlObj.origin === configuredUrlObj.origin) {
            return url;
        }
        
        return configuredUrl;
    },
    // ... other callbacks
}
```

## Benefits
1. **Explicit callback URL**: The frontend now explicitly sets the callback URL to the current origin, preventing NextAuth from inferring it from headers
2. **ALB URL handling**: The redirect callback ensures that any ALB URLs are automatically replaced with the configured domain
3. **Fallback protection**: Even if the frontend doesn't specify a callback URL, the redirect callback will handle it correctly

## Deployment Steps
1. Build the Docker image with these changes
2. Push to ECR
3. Force a new deployment in ECS to pick up the changes

## Testing
After deployment, verify:
1. Click the login button
2. Should redirect to Cognito login page
3. After successful authentication, should redirect back to https://hfu-amplify.org (not the ALB URL)
4. No more redirect loops