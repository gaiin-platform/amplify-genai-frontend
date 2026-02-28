# SAML-First Authentication with Cognito Backdoor

This document explains the SAML-first authentication strategy implemented in this application.

## Overview

The application supports **dual authentication modes**:
1. **SAML SSO** (Primary) - Preferred when configured
2. **Cognito Native Auth** (Fallback/Admin Backdoor) - Always available

When both are enabled, SAML is automatically prioritized, but administrators can bypass SAML using a special URL parameter.

## Architecture

### Infrastructure Layer (Terraform)

The Cognito User Pool is configured to support both identity providers simultaneously:

```hcl
# modules/cognito_pool/cognito_pool.tf
supported_identity_providers = var.use_saml_idp ?
  concat([aws_cognito_identity_provider.saml[0].provider_name], ["COGNITO"]) :
  ["COGNITO"]
```

This allows:
- Regular users to authenticate via SAML
- Admin users to authenticate via Cognito directly
- Seamless fallback if SAML is unavailable

### Frontend Layer

The frontend implements provider detection and selection:

```typescript
// utils/auth/signin.ts
export async function signInWithProvider(options: SignInOptions = {})
```

**Authentication Flow:**
1. Check URL for `forceCognito=true` parameter
2. If present → Use Cognito native auth (admin backdoor)
3. If absent and SAML configured → Redirect to SAML IdP
4. If SAML not configured → Use Cognito native auth

## Configuration

### 1. Infrastructure Setup

Deploy your infrastructure with SAML enabled:

```bash
cd /Users/allen/Desktop/CR8/Repos/cr8-nist/amplify-genai-iac
terraform apply
```

The Cognito module should have:
```hcl
use_saml_idp = true
provider_name = "your-amplify-saml-provider"  # Must contain "amplify"
```

### 2. Frontend Environment Variables

Add to `.env.local`:

```bash
# Required - Basic Cognito Configuration
COGNITO_CLIENT_ID=your_client_id
COGNITO_CLIENT_SECRET=your_client_secret
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_YourPoolId
COGNITO_DOMAIN=https://your-domain.auth.us-east-1.amazoncognito.com

# Optional - SAML Provider
# If set, SAML will be preferred over Cognito native auth
NEXT_PUBLIC_SAML_PROVIDER_NAME=amplify-saml-provider

# Required - NextAuth
NEXTAUTH_SECRET=your_secret_key
NEXTAUTH_URL=https://your-app.com
```

### 3. SAML Provider Name Convention

The SAML provider name **should contain "amplify"** to be recognized as a managed SAML provider:
- ✅ `amplify-saml-provider`
- ✅ `my-amplify-idp`
- ✅ `AmplifySSO`
- ❌ `company-sso` (won't be detected as managed)

## Usage

### Normal User Login

Users simply click the "Login" button and will be automatically redirected to:
- **SAML IdP** (if configured)
- **Cognito native login** (if SAML not configured)

```typescript
// In your component
import { signInWithProvider } from '@/utils/auth/signin';

<button onClick={() => signInWithProvider()}>
  Login
</button>
```

### Admin Backdoor Access

Administrators can bypass SAML and access Cognito directly using either method:

#### Method 1: URL Parameter
Add `?forceCognito=true` to any URL:
```
https://your-app.com/?forceCognito=true
https://your-app.com/assistants/my-assistant?forceCognito=true
```

#### Method 2: Programmatic
```typescript
import { signInWithProvider } from '@/utils/auth/signin';

signInWithProvider({ forceCognito: true });
```

#### Method 3: Generate Backdoor URL
```typescript
import { getAdminBackdoorUrl } from '@/utils/auth/signin';

const backdoorUrl = getAdminBackdoorUrl();
// Returns: https://your-app.com/?forceCognito=true
```

## How It Works

### Provider Selection Logic

```typescript
// 1. Check for admin backdoor
const forceFromUrl = urlParams.get('forceCognito') === 'true';
if (forceFromUrl) {
  // Use Cognito native auth - no identity_provider parameter
  return signIn('cognito', { callbackUrl });
}

// 2. Check for SAML configuration
const samlProviderName = process.env.NEXT_PUBLIC_SAML_PROVIDER_NAME;
if (samlProviderName) {
  // Use SAML - Cognito will redirect to SAML IdP
  return signIn('cognito', {
    callbackUrl,
    identity_provider: samlProviderName
  });
}

// 3. Fallback to Cognito native auth
return signIn('cognito', { callbackUrl });
```

### Cognito Hosted UI Behavior

When you call Cognito's authorize endpoint:

**Without `identity_provider` parameter:**
```
https://your-domain.auth.us-east-1.amazoncognito.com/oauth2/authorize?
  client_id=xxx&
  response_type=code&
  redirect_uri=xxx
```
→ Shows Cognito native login form

**With `identity_provider` parameter:**
```
https://your-domain.auth.us-east-1.amazoncognito.com/oauth2/authorize?
  client_id=xxx&
  response_type=code&
  redirect_uri=xxx&
  identity_provider=amplify-saml-provider
```
→ Immediately redirects to SAML IdP

## Testing

### Test SAML Authentication
1. Visit your app: `https://your-app.com`
2. Click "Login"
3. Should redirect to SAML IdP (e.g., Azure AD, Okta)
4. After successful SAML auth, redirects back to your app

### Test Admin Backdoor
1. Visit: `https://your-app.com/?forceCognito=true`
2. Click "Login"
3. Should show Cognito native login form
4. Login with Cognito username/password

### Verify Both Providers Work
```bash
# Check Cognito configuration
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-1_YourPoolId \
  --client-id YourClientId \
  --query 'UserPoolClient.SupportedIdentityProviders'

# Should output: ["amplify-saml-provider", "COGNITO"]
```

## Troubleshooting

### Issue: SAML Not Being Used
**Symptom:** Always seeing Cognito login form, not SAML IdP

**Solutions:**
1. Check `NEXT_PUBLIC_SAML_PROVIDER_NAME` is set in `.env.local`
2. Verify provider name matches Cognito configuration
3. Check browser console for logs: "Using SAML provider: xxx"
4. Ensure provider name contains "amplify"

### Issue: Admin Backdoor Not Working
**Symptom:** `?forceCognito=true` still shows SAML IdP

**Solutions:**
1. Ensure Cognito User Pool has both providers enabled
2. Check Terraform output: `supported_identity_providers = ["saml-provider", "COGNITO"]`
3. Clear browser cookies and try again
4. Check browser console for "Admin backdoor activated" message

### Issue: Users Can't Access App
**Symptom:** Authentication fails completely

**Solutions:**
1. Verify SAML configuration in IdP (Azure AD/Okta/etc)
2. Check callback URLs are correct in Cognito
3. Test with admin backdoor: `?forceCognito=true`
4. Review CloudWatch logs for Cognito errors

## Security Considerations

### Admin Backdoor Security
- The `forceCognito` parameter is **client-side only**
- It doesn't bypass any authentication requirements
- Users still need valid Cognito credentials
- This is safe for production use

### Best Practices
1. **Document the backdoor URL** for your admin team
2. **Test regularly** to ensure it works in emergencies
3. **Monitor Cognito logs** for unusual direct logins
4. **Use MFA** for Cognito admin accounts
5. **Rotate secrets regularly** in Secrets Manager

## Migration Strategy

### From Cognito-Only to SAML

1. **Phase 1: Deploy Infrastructure**
   ```bash
   # Enable SAML in Terraform
   use_saml_idp = true
   provider_name = "amplify-saml-provider"
   terraform apply
   ```

2. **Phase 2: Configure SAML IdP**
   - Add your app to Azure AD/Okta/etc
   - Configure attribute mapping
   - Test with a single user

3. **Phase 3: Update Frontend**
   ```bash
   # Add to .env.local
   NEXT_PUBLIC_SAML_PROVIDER_NAME=amplify-saml-provider

   # Deploy frontend
   npm run build
   docker build && docker push
   ```

4. **Phase 4: Gradual Rollout**
   - Start with pilot users
   - Monitor for issues
   - Keep admin backdoor available: `?forceCognito=true`
   - Full rollout when stable

### Rollback Plan
If SAML causes issues, users can still access via:
1. Admin backdoor URL: `?forceCognito=true`
2. Remove `NEXT_PUBLIC_SAML_PROVIDER_NAME` from environment
3. Redeploy frontend (falls back to Cognito)

## Code References

### Key Files
- `modules/cognito_pool/cognito_pool.tf` - Infrastructure configuration
- `utils/auth/signin.ts` - Frontend provider selection logic
- `utils/auth/providerDetection.ts` - Provider detection utilities
- `pages/api/auth/[...nextauth].js` - NextAuth configuration

### Key Functions
- `signInWithProvider()` - Main sign-in function with SAML priority
- `selectProvider()` - Determines which provider to use
- `getAdminBackdoorUrl()` - Generates backdoor URL for admins
- `isAdminBackdoor()` - Checks if currently in backdoor mode

## Support

For issues or questions:
1. Check CloudWatch Logs: `/aws/cognito/userpool/your-pool-id`
2. Review browser console for client-side errors
3. Test with admin backdoor to isolate SAML issues
4. Contact your DevOps team for Terraform/infrastructure issues
