# AWS ECS Fargate Deployment Guide

This guide explains how to configure white labeling environment variables for AWS ECS Fargate deployments.

## Environment Variables in ECS

For ECS Fargate, environment variables are configured in your **ECS Task Definition**. There are several ways to set them:

### Option 1: ECS Task Definition (Console)

1. **Navigate to ECS Console**
   - Go to AWS ECS Console
   - Select your cluster
   - Click on "Task Definitions"
   - Select your task definition or create a new one

2. **Add Environment Variables**
   - Click "Create new revision"
   - Scroll to "Container Definitions"
   - Click on your container name
   - Scroll to "Environment variables"
   - Add the following variables:

   ```
   Key: NEXT_PUBLIC_BRAND_LOGO
   Value: /logos/your-company-logo.svg
   
   Key: NEXT_PUBLIC_BRAND_PRIMARY_COLOR
   Value: #525364
   
   Key: NEXT_PUBLIC_BRAND_HOVER_COLOR
   Value: #3d3e4d
   ```

3. **Update Service**
   - Save the task definition
   - Update your ECS service to use the new task definition revision

### Option 2: ECS Task Definition (JSON)

If you're using JSON to define your task definition:

```json
{
  "family": "your-app-task",
  "containerDefinitions": [
    {
      "name": "your-app-container",
      "image": "your-ecr-repo/your-app:latest",
      "environment": [
        {
          "name": "NEXT_PUBLIC_BRAND_LOGO",
          "value": "/logos/your-company-logo.svg"
        },
        {
          "name": "NEXT_PUBLIC_BRAND_PRIMARY_COLOR",
          "value": "#525364"
        },
        {
          "name": "NEXT_PUBLIC_BRAND_HOVER_COLOR",
          "value": "#3d3e4d"
        },
        {
          "name": "NEXTAUTH_SECRET",
          "value": "your-secret-here"
        },
        {
          "name": "COGNITO_CLIENT_ID",
          "value": "your-cognito-client-id"
        }
      ]
    }
  ]
}
```

### Option 3: AWS CLI

Update your task definition using AWS CLI:

```bash
# Get current task definition
aws ecs describe-task-definition \
  --task-definition your-app-task \
  --query 'taskDefinition' > task-def.json

# Edit task-def.json to add environment variables
# Then register the new revision
aws ecs register-task-definition --cli-input-json file://task-def.json

# Update service to use new revision
aws ecs update-service \
  --cluster your-cluster \
  --service your-service \
  --task-definition your-app-task:NEW_REVISION
```

### Option 4: CloudFormation / CDK

#### CloudFormation Template

```yaml
Resources:
  TaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: your-app-task
      ContainerDefinitions:
        - Name: your-app-container
          Image: !Sub ${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/your-repo:latest
          Environment:
            - Name: NEXT_PUBLIC_BRAND_LOGO
              Value: /logos/your-company-logo.svg
            - Name: NEXT_PUBLIC_BRAND_PRIMARY_COLOR
              Value: "#525364"
            - Name: NEXT_PUBLIC_BRAND_HOVER_COLOR
              Value: "#3d3e4d"
```

#### AWS CDK (TypeScript)

```typescript
import * as ecs from 'aws-cdk-lib/aws-ecs';

const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
  memoryLimitMiB: 512,
  cpu: 256,
});

const container = taskDefinition.addContainer('AppContainer', {
  image: ecs.ContainerImage.fromRegistry('your-image'),
  environment: {
    NEXT_PUBLIC_BRAND_LOGO: '/logos/your-company-logo.svg',
    NEXT_PUBLIC_BRAND_PRIMARY_COLOR: '#525364',
    NEXT_PUBLIC_BRAND_HOVER_COLOR: '#3d3e4d',
  },
});
```

### Option 5: Terraform

```hcl
resource "aws_ecs_task_definition" "app" {
  family                   = "your-app-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"

  container_definitions = jsonencode([
    {
      name  = "your-app-container"
      image = "your-ecr-repo/your-app:latest"
      
      environment = [
        {
          name  = "NEXT_PUBLIC_BRAND_LOGO"
          value = "/logos/your-company-logo.svg"
        },
        {
          name  = "NEXT_PUBLIC_BRAND_PRIMARY_COLOR"
          value = "#525364"
        },
        {
          name  = "NEXT_PUBLIC_BRAND_HOVER_COLOR"
          value = "#3d3e4d"
        }
      ]
    }
  ])
}
```

## Using AWS Systems Manager Parameter Store (Recommended for Secrets)

For sensitive values or values that change frequently, use Parameter Store:

### 1. Store Parameters

```bash
# Store brand configuration in Parameter Store
aws ssm put-parameter \
  --name "/myapp/brand/logo" \
  --value "/logos/company-logo.svg" \
  --type "String"

aws ssm put-parameter \
  --name "/myapp/brand/primary-color" \
  --value "#525364" \
  --type "String"

aws ssm put-parameter \
  --name "/myapp/brand/hover-color" \
  --value "#3d3e4d" \
  --type "String"
```

### 2. Reference in Task Definition

```json
{
  "containerDefinitions": [
    {
      "name": "your-app-container",
      "secrets": [
        {
          "name": "NEXT_PUBLIC_BRAND_LOGO",
          "valueFrom": "arn:aws:ssm:region:account-id:parameter/myapp/brand/logo"
        },
        {
          "name": "NEXT_PUBLIC_BRAND_PRIMARY_COLOR",
          "valueFrom": "arn:aws:ssm:region:account-id:parameter/myapp/brand/primary-color"
        },
        {
          "name": "NEXT_PUBLIC_BRAND_HOVER_COLOR",
          "valueFrom": "arn:aws:ssm:region:account-id:parameter/myapp/brand/hover-color"
        }
      ]
    }
  ]
}
```

### 3. IAM Permissions

Your ECS task execution role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameters",
        "ssm:GetParameter"
      ],
      "Resource": [
        "arn:aws:ssm:region:account-id:parameter/myapp/brand/*"
      ]
    }
  ]
}
```

## Deployment Workflow

### Step 1: Build and Push Docker Image

```bash
# Build the image
docker build -t your-app:latest .

# Tag for ECR
docker tag your-app:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/your-repo:latest

# Login to ECR
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Push to ECR
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/your-repo:latest
```

### Step 2: Update Task Definition with Environment Variables

Use one of the methods above to add the white labeling environment variables.

### Step 3: Deploy New Task Definition

```bash
# Update the service to use the new task definition
aws ecs update-service \
  --cluster your-cluster \
  --service your-service \
  --force-new-deployment
```

## Logo File Deployment

Your logo file needs to be included in the Docker image. It's already configured in the Dockerfile:

```dockerfile
# This line copies the entire public folder including logos
COPY --chown=appuser:appgroup --from=build /app/public ./public
```

### To add your custom logo:

1. Place your logo file in `public/logos/` (e.g., `public/logos/company-logo.svg`)
2. Rebuild your Docker image
3. Push to ECR
4. Set the environment variable to point to it: `NEXT_PUBLIC_BRAND_LOGO=/logos/company-logo.svg`

## Environment-Specific Configurations

You can have different configurations per environment:

### Development Task Definition
```json
{
  "environment": [
    {
      "name": "NEXT_PUBLIC_BRAND_LOGO",
      "value": "/logos/dev-logo.svg"
    },
    {
      "name": "NEXT_PUBLIC_BRAND_PRIMARY_COLOR",
      "value": "#3b82f6"
    }
  ]
}
```

### Production Task Definition
```json
{
  "environment": [
    {
      "name": "NEXT_PUBLIC_BRAND_LOGO",
      "value": "/logos/prod-logo.svg"
    },
    {
      "name": "NEXT_PUBLIC_BRAND_PRIMARY_COLOR",
      "value": "#525364"
    }
  ]
}
```

## Verification

After deployment, verify the configuration:

1. **Check Task Environment Variables**
   ```bash
   aws ecs describe-tasks \
     --cluster your-cluster \
     --tasks task-id \
     --query 'tasks[0].containers[0].environment'
   ```

2. **Check Container Logs**
   ```bash
   aws logs tail /ecs/your-app-task --follow
   ```

3. **Test the Application**
   - Navigate to your application URL
   - Check that the login screen shows your logo
   - Verify button colors match your brand

## Troubleshooting

### Logo Not Displaying

1. **Verify file exists in container:**
   ```bash
   # Get a shell in the running container
   aws ecs execute-command \
     --cluster your-cluster \
     --task task-id \
     --container your-container \
     --interactive \
     --command "/bin/sh"
   
   # Then check
   ls -la /app/public/logos/
   ```

2. **Check environment variable:**
   ```bash
   echo $NEXT_PUBLIC_BRAND_LOGO
   ```

3. **Verify the image was rebuilt** after adding the logo file

### Colors Not Applying

1. Ensure environment variables start with `NEXT_PUBLIC_`
2. Verify hex colors include the `#` symbol
3. Check that the task definition was updated and service redeployed

### Changes Not Visible

1. Force a new deployment:
   ```bash
   aws ecs update-service \
     --cluster your-cluster \
     --service your-service \
     --force-new-deployment
   ```

2. Clear browser cache
3. Check CloudWatch logs for errors

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to ECS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: your-repo
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster your-cluster \
            --service your-service \
            --force-new-deployment
```

## Best Practices

1. **Use Parameter Store** for values that change frequently
2. **Version your task definitions** to enable easy rollbacks
3. **Test in staging** before deploying to production
4. **Use separate task definitions** for different environments
5. **Monitor CloudWatch logs** during deployment
6. **Document your brand colors** in your team wiki

## Support

For more information:
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [ECS Task Definition Parameters](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html)
- White Labeling Guide: `docs/WHITE_LABELING.md`
