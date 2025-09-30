#!/bin/bash
# Simple build script that works

echo "Building Docker image with platform flag..."

# Build with platform flag
docker build \
  --platform=linux/amd64 \
  -t amplify:chat-working \
  -f- . << 'EOF'
FROM --platform=linux/amd64 node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build with env vars
ENV NODE_ENV=production
ENV NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://x18hnd6yh6.execute-api.us-east-1.amazonaws.com/prod/proxy/llm

RUN npm run build

# Production dependencies only
RUN npm prune --production

EXPOSE 3000

CMD ["npm", "start"]
EOF

echo "Tagging image..."
docker tag amplify:chat-working 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:chat-working

echo "Done! Push with:"
echo "docker push 135808927724.dkr.ecr.us-east-1.amazonaws.com/dev-amplifygenai-repo:chat-working"