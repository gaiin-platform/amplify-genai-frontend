# Dual Provider Verification Guide

## Verifying Both Providers Are Active

After deploying with `use_saml_idp = true`, follow these steps to confirm both SAML and Cognito providers are active and working correctly.

---

## Step 1: Check Terraform Output

```bash
cd /Users/allen/Desktop/CR8/Repos/cr8-nist/amplify-genai-iac/prod

# View the Cognito configuration
terraform output -json | jq '.cognito_user_pool_client_id.value'
# Output: "3j5l6b6ssgbm93e7pauk9tf6g3"

terraform output -json | jq '.saml_provider_name.value'
# Output: "prod-amplify-saml-provider"  (or empty "" if disabled)
```

---

## Step 2: Verify AWS Cognito Configuration

### Option A: AWS CLI

```bash
# Set your pool ID
POOL_ID="us-east-1_rJHan4IQp"
CLIENT_ID="3j5l6b6ssgbm93e7pauk9tf6g3"

# Check supported identity providers
aws cognito-idp describe-user-pool-client \
  --user-pool-id $POOL_ID \
  --client-id $CLIENT_ID \
  --query 'UserPoolClient.SupportedIdentityProviders' \
  --output json
```

**Expected Output (SAML enabled):**
```json
[
    "prod-amplify-saml-provider",
    "COGNITO"
]
```

**Expected Output (SAML disabled):**
```json
[
    "COGNITO"
]
```

### Option B: AWS Console

1. Go to **Amazon Cognito** → **User Pools**
2. Select your user pool: `prod-amplify-genai-user-pool`
3. Go to **App clients** → Select your client
4. Scroll to **Hosted UI settings**
5. Look at **Identity providers**:
   - ✓ `prod-amplify-saml-provider` (checked)
   - ✓ `Cognito user pool` (checked)

---

## Step 3: Test SAML Provider (Normal User Flow)

### What You're Testing
Users should be redirected to SAML IdP by default.

### Test Steps

1. **Open browser** (incognito mode recommended)
2. **Navigate to**: `https://arcqus.cr8.io`
3. **Click "Login"**
4. **Observe redirect**:

**Expected Behavior:**
```
https://arcqus.cr8.io
    ↓ Click Login
https://auth.arcqus.cr8.io/oauth2/authorize?
    client_id=xxx&
    identity_provider=prod-amplify-saml-provider  ← See this!
    ↓ Cognito redirects
https://your-saml-idp.com/login  ← Azure AD, Okta, etc.
```

5. **Check browser console** (F12 → Console):
```
Using SAML provider: prod-amplify-saml-provider
```

### Success Criteria
- ✅ Redirected to your SAML IdP
- ✅ NOT seeing Cognito username/password form
- ✅ Console logs "Using SAML provider"

---

## Step 4: Test Cognito Provider (Admin Backdoor)

### What You're Testing
Admins can bypass SAML using `?forceCognito=true`.

### Test Steps

1. **Open browser** (new incognito window)
2. **Navigate to**: `https://arcqus.cr8.io/?forceCognito=true`
3. **Click "Login"**
4. **Observe redirect**:

**Expected Behavior:**
```
https://arcqus.cr8.io/?forceCognito=true
    ↓ Click Login
https://auth.arcqus.cr8.io/oauth2/authorize?
    client_id=xxx
    (NO identity_provider parameter!)
    ↓ Cognito shows native login
[Username/Password Form]  ← Cognito UI
```

5. **Check browser console**:
```
Admin backdoor activated: Using Cognito native authentication
```

6. **Login** with Cognito credentials:
   - Username: Your Cognito username
   - Password: Your Cognito password

### Success Criteria
- ✅ See Cognito username/password form
- ✅ NOT redirected to SAML IdP
- ✅ Console logs "Admin backdoor activated"
- ✅ Can successfully login with Cognito credentials

---

## Step 5: Verify ECS Environment Variable

### Check Task Definition

```bash
# Get the latest task definition
CLUSTER="prod-amplifygenai-cluster"
SERVICE=$(aws ecs list-services --cluster $CLUSTER --query 'serviceArns[0]' --output text | cut -d'/' -f3)

TASK_DEF=$(aws ecs describe-services \
  --cluster $CLUSTER \
  --services $SERVICE \
  --query 'services[0].taskDefinition' \
  --output text)

# View environment variables
aws ecs describe-task-definition \
  --task-definition $TASK_DEF \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`NEXT_PUBLIC_SAML_PROVIDER_NAME`]' \
  --output json
```

**Expected Output (SAML enabled):**
```json
[
    {
        "name": "NEXT_PUBLIC_SAML_PROVIDER_NAME",
        "value": "prod-amplify-saml-provider"
    }
]
```

**Expected Output (SAML disabled):**
```json
[
    {
        "name": "NEXT_PUBLIC_SAML_PROVIDER_NAME",
        "value": ""
    }
]
```

### Check Running Container

```bash
# Get a running task
TASK_ARN=$(aws ecs list-tasks \
  --cluster $CLUSTER \
  --service-name $SERVICE \
  --query 'taskArns[0]' \
  --output text)

# Execute command in container
aws ecs execute-command \
  --cluster $CLUSTER \
  --task $TASK_ARN \
  --container prod-amplifygenai-container \
  --interactive \
  --command "/bin/sh"

# Inside the container:
$ echo $NEXT_PUBLIC_SAML_PROVIDER_NAME
prod-amplify-saml-provider

$ node -e "console.log(process.env.NEXT_PUBLIC_SAML_PROVIDER_NAME)"
prod-amplify-saml-provider

$ exit
```

---

## Step 6: Network Inspection (Advanced)

### Inspect Authorization Requests

1. **Open browser DevTools** (F12)
2. **Go to Network tab**
3. **Clear network log**
4. **Click "Login"**
5. **Find the authorize request**

### Normal User (SAML)
```http
GET /oauth2/authorize?
  client_id=3j5l6b6ssgbm93e7pauk9tf6g3&
  response_type=code&
  scope=email+openid&
  redirect_uri=https://arcqus.cr8.io/api/auth/callback/cognito&
  identity_provider=prod-amplify-saml-provider  ← Present!

Host: auth.arcqus.cr8.io
```

### Admin Backdoor
```http
GET /oauth2/authorize?
  client_id=3j5l6b6ssgbm93e7pauk9tf6g3&
  response_type=code&
  scope=email+openid&
  redirect_uri=https://arcqus.cr8.io/api/auth/callback/cognito
  (NO identity_provider parameter!)

Host: auth.arcqus.cr8.io
```

---

## Troubleshooting

### Issue: Only SAML Provider Listed

**Symptoms:**
```bash
aws cognito-idp describe-user-pool-client ...
# Returns: ["prod-amplify-saml-provider"]
# Missing: "COGNITO"
```

**Solution:**
Check your Terraform configuration:
```hcl
# Should be:
supported_identity_providers = var.use_saml_idp ?
  concat([aws_cognito_identity_provider.saml[0].provider_name], ["COGNITO"]) :
  ["COGNITO"]

# Not:
supported_identity_providers = [aws_cognito_identity_provider.saml[0].provider_name]
```

**Fix:**
```bash
cd amplify-genai-iac
git pull origin cr8-amplify-install-updated
terraform apply
```

### Issue: Can't Access with ?forceCognito=true

**Symptoms:**
- URL has `?forceCognito=true`
- Still redirects to SAML IdP
- No Cognito login form

**Possible Causes:**
1. Only SAML provider enabled (missing "COGNITO")
2. Browser cached the redirect
3. Cookie/session issue

**Solutions:**
```bash
# 1. Verify both providers are enabled (see Step 2)

# 2. Clear browser cache and cookies
# Chrome: Ctrl+Shift+Delete → Clear cookies

# 3. Try incognito/private window

# 4. Verify frontend code is deployed:
curl https://arcqus.cr8.io/_next/static/chunks/pages/index-*.js | grep "forceCognito"
# Should find the code checking for this parameter
```

### Issue: Empty String in Environment Variable

**Symptoms:**
```bash
# In container:
$ echo $NEXT_PUBLIC_SAML_PROVIDER_NAME
(empty line)
```

**This is EXPECTED when:**
- `use_saml_idp = false`
- Client doesn't use SAML

**This is CORRECT behavior!**
- Frontend checks: `if (samlProviderName)` → false
- Falls back to Cognito native auth
- No action needed

---

## Quick Verification Checklist

Use this checklist after deploying:

### SAML Enabled Configuration
- [ ] Terraform: `use_saml_idp = true`
- [ ] AWS CLI: Both providers listed
- [ ] Browser test: Normal login → SAML IdP
- [ ] Browser test: `?forceCognito=true` → Cognito form
- [ ] Console logs: "Using SAML provider: ..."
- [ ] ECS env var: Has provider name value

### SAML Disabled Configuration
- [ ] Terraform: `use_saml_idp = false`
- [ ] AWS CLI: Only "COGNITO" listed
- [ ] Browser test: All logins → Cognito form
- [ ] Console logs: "No SAML provider configured"
- [ ] ECS env var: Empty string value

---

## Summary

**When `use_saml_idp = true`:**
```
✓ SAML Provider: Active
✓ Cognito Provider: Active (for backdoor)
✓ Normal users: → SAML IdP
✓ Admins (?forceCognito=true): → Cognito login
✓ Both work simultaneously
```

**When `use_saml_idp = false`:**
```
✓ Cognito Provider: Active
✗ SAML Provider: Not created
✓ All users: → Cognito login
✓ Single provider mode
```

Both configurations are **fully supported** and work seamlessly!
