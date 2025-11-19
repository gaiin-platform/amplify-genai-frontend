# White Labeling Build Guide

## Important: Build-Time vs Runtime Variables

**Critical:** Next.js `NEXT_PUBLIC_*` environment variables are embedded into the JavaScript bundle at **build time**, not runtime. This means:

- ✅ Variables must be set **when building** the Docker image
- ❌ Setting them in ECS Task Definition alone won't work
- ✅ You need to rebuild the image for each brand configuration

## Building with Custom Branding

### Option 1: Docker Build Arguments (Recommended)

Build your Docker image with custom branding using `--build-arg`:

```bash
docker build \
  --build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/nc-state.svg \
  --build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000 \
  --build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000 \
  -t your-app:nc-state \
  .
```

### Option 2: Environment File

Create a `.env.build` file:

```bash
NEXT_PUBLIC_BRAND_LOGO=/logos/nc-state.svg
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000
NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000
```

Then build:

```bash
docker build --env-file .env.build -t your-app:nc-state .
```

### Option 3: CI/CD Pipeline

#### GitHub Actions

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: your-repo

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build \
            --build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/nc-state.svg \
            --build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000 \
            --build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000 \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:latest \
            .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster your-cluster \
            --service your-service \
            --force-new-deployment
```

#### GitLab CI

```yaml
build:
  stage: build
  script:
    - docker build 
        --build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/nc-state.svg
        --build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000
        --build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000
        -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```

## Multi-Brand Strategy

If you need to support multiple brands, you have several options:

### Strategy 1: Separate Images per Brand

Build separate images for each brand:

```bash
# NC State brand
docker build \
  --build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/nc-state.svg \
  --build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000 \
  -t your-app:nc-state .

# Duke brand
docker build \
  --build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/duke.svg \
  --build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#003087 \
  -t your-app:duke .

# UNC brand
docker build \
  --build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/unc.svg \
  --build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#7BAFD4 \
  -t your-app:unc .
```

Push each to ECR with different tags:

```bash
docker tag your-app:nc-state ${ECR_REGISTRY}/your-app:nc-state
docker push ${ECR_REGISTRY}/your-app:nc-state

docker tag your-app:duke ${ECR_REGISTRY}/your-app:duke
docker push ${ECR_REGISTRY}/your-app:duke

docker tag your-app:unc ${ECR_REGISTRY}/your-app:unc
docker push ${ECR_REGISTRY}/your-app:unc
```

Then create separate ECS services or task definitions for each brand.

### Strategy 2: Build Script

Create a `build-brands.sh` script:

```bash
#!/bin/bash

# Array of brand configurations
declare -A brands=(
  ["nc-state"]="/logos/nc-state.svg #CC0000 #990000"
  ["duke"]="/logos/duke.svg #003087 #00205B"
  ["unc"]="/logos/unc.svg #7BAFD4 #56A0D3"
)

# ECR configuration
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ECR_REPOSITORY="your-app"

# Login to ECR
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Build and push each brand
for brand in "${!brands[@]}"; do
  IFS=' ' read -r logo primary hover <<< "${brands[$brand]}"
  
  echo "Building $brand..."
  docker build \
    --build-arg NEXT_PUBLIC_BRAND_LOGO="$logo" \
    --build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR="$primary" \
    --build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR="$hover" \
    -t ${ECR_REGISTRY}/${ECR_REPOSITORY}:${brand} \
    .
  
  echo "Pushing $brand..."
  docker push ${ECR_REGISTRY}/${ECR_REPOSITORY}:${brand}
done

echo "All brands built and pushed!"
```

Make it executable and run:

```bash
chmod +x build-brands.sh
./build-brands.sh
```

### Strategy 3: Makefile

Create a `Makefile`:

```makefile
AWS_ACCOUNT_ID := 123456789012
AWS_REGION := us-east-1
ECR_REGISTRY := $(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com
ECR_REPOSITORY := your-app

.PHONY: build-nc-state build-duke build-unc push-all

build-nc-state:
	docker build \
		--build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/nc-state.svg \
		--build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000 \
		--build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000 \
		-t $(ECR_REGISTRY)/$(ECR_REPOSITORY):nc-state .

build-duke:
	docker build \
		--build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/duke.svg \
		--build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#003087 \
		--build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#00205B \
		-t $(ECR_REGISTRY)/$(ECR_REPOSITORY):duke .

build-unc:
	docker build \
		--build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/unc.svg \
		--build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#7BAFD4 \
		--build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#56A0D3 \
		-t $(ECR_REGISTRY)/$(ECR_REPOSITORY):unc .

push-all: build-nc-state build-duke build-unc
	docker push $(ECR_REGISTRY)/$(ECR_REPOSITORY):nc-state
	docker push $(ECR_REGISTRY)/$(ECR_REPOSITORY):duke
	docker push $(ECR_REGISTRY)/$(ECR_REPOSITORY):unc

ecr-login:
	aws ecr get-login-password --region $(AWS_REGION) | \
		docker login --username AWS --password-stdin $(ECR_REGISTRY)
```

Usage:

```bash
make ecr-login
make build-nc-state
make push-all
```

## Local Development

For local development, use `.env.local`:

```bash
# .env.local
NEXT_PUBLIC_BRAND_LOGO=/logos/nc-state.svg
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000
NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000
```

Then run:

```bash
npm run dev
```

The variables will be picked up automatically.

## Verification

After building, verify the variables are embedded:

```bash
# Run the container
docker run -p 3000:3000 your-app:nc-state

# Check the browser console or view source
# The variables should be visible in the JavaScript bundle
```

Or inspect the built files:

```bash
# Extract the .next folder from the image
docker create --name temp your-app:nc-state
docker cp temp:/app/.next ./inspect-next
docker rm temp

# Search for your logo path
grep -r "nc-state.svg" ./inspect-next
```

## Troubleshooting

### Logo Still Shows Default

**Problem:** After setting build args, logo still shows default.

**Solution:**
1. Ensure you're using `--build-arg` when building
2. Verify the logo file exists in `public/logos/`
3. Clear Docker build cache: `docker build --no-cache ...`
4. Check the image was actually rebuilt and pushed to ECR
5. Verify ECS is using the new image (check task definition revision)

### Colors Not Applying

**Problem:** Colors don't match the build arguments.

**Solution:**
1. Verify hex colors include the `#` symbol in build args
2. Clear browser cache
3. Check browser console for any errors
4. Verify the build completed successfully

### Wrong Brand Showing

**Problem:** Deployed the wrong brand to an environment.

**Solution:**
1. Check which image tag your ECS service is using
2. Update the task definition to use the correct image tag
3. Force a new deployment: `aws ecs update-service --force-new-deployment`

## Best Practices

1. **Tag images by brand**: Use descriptive tags like `nc-state`, `duke`, etc.
2. **Version your brands**: Consider tags like `nc-state-v1.2.3`
3. **Document brand configs**: Keep a record of each brand's colors and logos
4. **Automate builds**: Use CI/CD to build all brands automatically
5. **Test before deploying**: Always test the image locally first
6. **Use separate ECR repos**: Consider separate repos for each brand if needed

## Example: Complete Deployment Flow

```bash
# 1. Add your logo file
cp ~/nc-state-logo.svg public/logos/nc-state.svg

# 2. Build with branding
docker build \
  --build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/nc-state.svg \
  --build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000 \
  --build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000 \
  -t your-app:nc-state \
  .

# 3. Tag for ECR
docker tag your-app:nc-state \
  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/your-app:nc-state

# 4. Login to ECR
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin \
  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# 5. Push to ECR
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/your-app:nc-state

# 6. Update ECS task definition to use the new image
# (via Console, CLI, or IaC)

# 7. Deploy to ECS
aws ecs update-service \
  --cluster your-cluster \
  --service your-service \
  --force-new-deployment
```

## Related Documentation

- Main White Labeling Guide: `docs/WHITE_LABELING.md`
- AWS ECS Deployment: `docs/DEPLOYMENT_AWS_ECS.md`
- Quick Start: `WHITELABEL_QUICKSTART.md`
