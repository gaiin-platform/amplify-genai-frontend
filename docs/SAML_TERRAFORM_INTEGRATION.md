# SAML Provider Auto-Configuration via Terraform

## Overview

The SAML provider name is now **automatically configured** in your ECS containers via Terraform. You no longer need to manually set `NEXT_PUBLIC_SAML_PROVIDER_NAME` in AWS Secrets Manager or environment variables.

## How It Works

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Terraform Cognito Module                                        │
│                                                                  │
│  use_saml_idp = true                                            │
│  provider_name = "prod-amplify-saml-provider"                   │
│                                                                  │
│  ↓                                                               │
│                                                                  │
│  aws_cognito_identity_provider.saml[0].provider_name            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Output: saml_provider_name
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Terraform Main (prod/main.tf)                                   │
│                                                                  │
│  module.cognito_pool.saml_provider_name                         │
│         ↓                                                        │
│  module.ecs.saml_provider_name                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Variable: saml_provider_name
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ ECS Task Definition                                             │
│                                                                  │
│  environment = [                                                │
│    {                                                             │
│      name  = "NEXT_PUBLIC_SAML_PROVIDER_NAME"                   │
│      value = "prod-amplify-saml-provider"                       │
│    }                                                             │
│  ]                                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Container Environment Variable
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Next.js Frontend Container                                      │
│                                                                  │
│  process.env.NEXT_PUBLIC_SAML_PROVIDER_NAME                     │
│  = "prod-amplify-saml-provider"                                 │
│                                                                  │
│  → signInWithProvider() uses this value                         │
│  → SAML authentication is automatically preferred               │
└─────────────────────────────────────────────────────────────────┘
```

## Infrastructure Changes

### 1. Cognito Module Output

**File**: `modules/cognito_pool/outputs.tf`

```hcl
output "saml_provider_name" {
  value       = var.use_saml_idp ? aws_cognito_identity_provider.saml[0].provider_name : ""
  description = "The SAML identity provider name, empty if SAML is not configured"
}
```

**Behavior**:
- If `use_saml_idp = true`: Returns the actual provider name (e.g., "prod-amplify-saml-provider")
- If `use_saml_idp = false`: Returns empty string ""

### 2. ECS Module Variable

**File**: `modules/ecs/variables.tf`

```hcl
variable "saml_provider_name" {
  description = "The SAML identity provider name from Cognito (empty if not configured)"
  type        = string
  default     = ""
}
```

### 3. ECS Task Definition

**File**: `modules/ecs/ecs-task-definition.tf`

```hcl
container_definitions = jsonencode([{
  name  = var.container_name
  image = var.ecr_image_repository_url

  environment = [
    {
      name  = "NEXT_PUBLIC_SAML_PROVIDER_NAME"
      value = var.saml_provider_name
    }
  ]

  secrets = [
    # ... existing secrets
  ]
}])
```

### 4. Main Terraform Files

**Files**: `prod/main.tf` and `dev/main.tf`

```hcl
module "ecs" {
  source = "../modules/ecs"
  depends_on = [module.load_balancer, module.cognito_pool]

  # ... other variables

  saml_provider_name = module.cognito_pool.saml_provider_name
}
```

## Deployment

### Initial Setup

When you first deploy with SAML enabled:

```bash
cd /Users/allen/Desktop/CR8/Repos/cr8-nist/amplify-genai-iac/prod

# Plan to see what will be created
terraform plan

# Apply changes
terraform apply
```

**What happens:**
1. Cognito User Pool created with SAML provider
2. SAML provider name captured as output
3. ECS task definition created with `NEXT_PUBLIC_SAML_PROVIDER_NAME` environment variable
4. Container automatically receives the provider name

### Updating SAML Configuration

If you change the SAML provider name or toggle SAML on/off:

```bash
# Terraform detects the change
terraform plan

# Shows:
# ~ environment = [
#     - { name = "NEXT_PUBLIC_SAML_PROVIDER_NAME", value = "old-provider" }
#     + { name = "NEXT_PUBLIC_SAML_PROVIDER_NAME", value = "new-provider" }
#   ]

# Apply the change
terraform apply

# ECS will automatically:
# 1. Create new task definition revision
# 2. Update service to use new revision
# 3. Rolling deployment with new environment variable
```

### Verifying Configuration

After deployment, check the ECS task definition:

```bash
# Get the latest task definition
TASK_DEF=$(aws ecs describe-services \
  --cluster prod-amplifygenai-cluster \
  --services prod-amplifygenai-service-* \
  --query 'services[0].taskDefinition' \
  --output text)

# View the environment variables
aws ecs describe-task-definition \
  --task-definition $TASK_DEF \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`NEXT_PUBLIC_SAML_PROVIDER_NAME`]'

# Expected output:
# [
#     {
#         "name": "NEXT_PUBLIC_SAML_PROVIDER_NAME",
#         "value": "prod-amplify-saml-provider"
#     }
# ]
```

### Checking Container Runtime

SSH into a running container to verify:

```bash
# Get task ARN
TASK_ARN=$(aws ecs list-tasks \
  --cluster prod-amplifygenai-cluster \
  --service-name prod-amplifygenai-service-* \
  --query 'taskArns[0]' \
  --output text)

# Execute command in container
aws ecs execute-command \
  --cluster prod-amplifygenai-cluster \
  --task $TASK_ARN \
  --container prod-amplifygenai-container \
  --interactive \
  --command "/bin/sh"

# Inside container:
$ echo $NEXT_PUBLIC_SAML_PROVIDER_NAME
prod-amplify-saml-provider

$ node -e "console.log(process.env.NEXT_PUBLIC_SAML_PROVIDER_NAME)"
prod-amplify-saml-provider
```

## Configuration Scenarios

### Scenario 1: SAML Enabled (Production)

**Terraform Config** (`prod.tfvars`):
```hcl
use_saml_idp = true
provider_name = "amplify-saml-provider"
```

**Result**:
- `NEXT_PUBLIC_SAML_PROVIDER_NAME = "prod-amplify-saml-provider"`
- Frontend automatically uses SAML for authentication
- Admin backdoor still available via `?forceCognito=true`

### Scenario 2: SAML Disabled (Development)

**Terraform Config** (`dev.tfvars`):
```hcl
use_saml_idp = false
```

**Result**:
- `NEXT_PUBLIC_SAML_PROVIDER_NAME = ""` (empty string)
- Frontend uses Cognito native authentication
- No SAML redirection

### Scenario 3: Changing SAML Provider

**Before**:
```hcl
provider_name = "old-saml-provider"
```

**After**:
```hcl
provider_name = "new-saml-provider"
```

**Deployment**:
```bash
terraform apply
# ECS tasks will be redeployed with new provider name
# Zero downtime with rolling deployment
```

## Benefits

### ✅ Automatic Configuration
- No manual environment variable management
- Provider name always matches Cognito configuration
- Impossible to have mismatched settings

### ✅ Infrastructure as Code
- SAML provider defined once in Terraform
- Automatically propagates to all dependent resources
- Version controlled and auditable

### ✅ Environment Consistency
- Same configuration mechanism for dev and prod
- Easy to toggle SAML on/off per environment
- No secret management required for this value

### ✅ Simplified Deployment
- One `terraform apply` configures everything
- ECS automatically picks up changes
- No manual container restarts needed

## Comparison: Before vs After

### Before (Manual Configuration)

```bash
# Step 1: Deploy Cognito with SAML
cd amplify-genai-iac
terraform apply

# Step 2: Get the provider name
aws cognito-idp describe-user-pool --user-pool-id ...

# Step 3: Manually update Secrets Manager
aws secretsmanager update-secret \
  --secret-id prod-amplify-app-vars \
  --secret-string '{"NEXT_PUBLIC_SAML_PROVIDER_NAME":"prod-amplify-saml-provider"}'

# Step 4: Force ECS task restart
aws ecs update-service \
  --cluster prod-amplifygenai-cluster \
  --service prod-amplifygenai-service \
  --force-new-deployment

# Step 5: Wait for deployment
# Step 6: Verify it worked
```

**Problems**:
- 6 manual steps
- Easy to make mistakes (typos, wrong provider name)
- Secrets Manager not version controlled
- Hard to keep dev/prod in sync

### After (Automatic Configuration)

```bash
# One step:
cd amplify-genai-iac/prod
terraform apply

# That's it!
# - Cognito configured with SAML
# - Provider name automatically propagated
# - ECS containers receive correct value
# - Everything happens in one atomic operation
```

**Benefits**:
- 1 step vs 6 steps
- No manual secret management
- Everything version controlled
- Impossible to have configuration drift

## Troubleshooting

### Issue: Environment Variable Not Set

**Check Terraform output:**
```bash
terraform output -json | jq '.cognito_pool.value.saml_provider_name'
```

**If empty**:
- Verify `use_saml_idp = true` in tfvars
- Check SAML provider is created: `terraform state list | grep saml`

### Issue: Old Value in Container

**Force new task deployment:**
```bash
# Latest task definition should have new value
aws ecs describe-task-definition --task-definition prod-gen-ai-app-task

# Force service to use latest
aws ecs update-service \
  --cluster prod-amplifygenai-cluster \
  --service prod-amplifygenai-service-* \
  --force-new-deployment
```

### Issue: Wrong Provider Name

**Verify Cognito configuration:**
```bash
aws cognito-idp list-identity-providers \
  --user-pool-id YOUR_POOL_ID \
  --query 'Providers[*].ProviderName'
```

**If mismatch**, update Terraform:
```hcl
# In prod.tfvars
provider_name = "correct-provider-name"
```

Then `terraform apply` will fix it automatically.

## Security Considerations

### Why Environment Variable vs Secret?

**Environment Variable** (chosen approach):
- ✅ Provider name is not sensitive information
- ✅ Visible in task definition (easier debugging)
- ✅ No additional IAM permissions needed
- ✅ Faster container startup (no secret fetching)

**Secret** (unnecessary complexity):
- ❌ Provider name isn't secret
- ❌ Requires Secrets Manager permissions
- ❌ Adds latency on container startup
- ❌ More complex to manage

**Actual Secrets** (still in Secrets Manager):
- `COGNITO_CLIENT_SECRET` ✓ (secret)
- `NEXTAUTH_SECRET` ✓ (secret)
- `OPENAI_API_KEY` ✓ (secret)
- `NEXT_PUBLIC_SAML_PROVIDER_NAME` ✗ (public info)

## Related Documentation

- **SAML Authentication Overview**: `SAML_AUTHENTICATION.md`
- **Quick Setup Guide**: `SAML_SETUP_QUICK_START.md`
- **Frontend Integration**: `utils/auth/signin.ts`

## Summary

With these Terraform changes:
1. **No manual configuration needed** - Everything automatic
2. **Infrastructure as Code** - SAML config version controlled
3. **Atomic deployments** - One apply updates everything
4. **Environment parity** - Easy to replicate across environments
5. **Admin backdoor works** - `?forceCognito=true` still available

Your frontend will automatically receive the SAML provider name from Terraform, enabling SAML-first authentication without any manual environment variable management!
