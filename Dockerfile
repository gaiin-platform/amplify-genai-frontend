FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copy dependency files
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN npm ci

# Development dependencies
FROM base AS dev-deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN npm ci --include=dev

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables
ARG NEXTAUTH_SECRET=build-time-secret
ARG NEXTAUTH_URL=http://localhost:3000
ARG NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito
ARG NEXT_PUBLIC_AUTH_ENABLED=true
ARG NEXT_PUBLIC_ENABLE_STREAMING=true
ARG NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_APP_NAME="HFU Amplify"
ARG NEXT_PUBLIC_APP_VERSION="1.0.28"

ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=$NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER
ENV NEXT_PUBLIC_AUTH_ENABLED=$NEXT_PUBLIC_AUTH_ENABLED
ENV NEXT_PUBLIC_ENABLE_STREAMING=$NEXT_PUBLIC_ENABLE_STREAMING
ENV NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=$NEXT_PUBLIC_LLM_ROUTER_ENDPOINT
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV NEXT_TELEMETRY_DISABLED=1

# Create comprehensive .env.production for build
RUN echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" > .env.production && \
    echo "NEXTAUTH_URL=$NEXTAUTH_URL" >> .env.production && \
    echo "NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=$NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER" >> .env.production && \
    echo "NEXT_PUBLIC_AUTH_ENABLED=$NEXT_PUBLIC_AUTH_ENABLED" >> .env.production && \
    echo "NEXT_PUBLIC_ENABLE_STREAMING=$NEXT_PUBLIC_ENABLE_STREAMING" >> .env.production && \
    echo "NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=$NEXT_PUBLIC_LLM_ROUTER_ENDPOINT" >> .env.production && \
    echo "NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL" >> .env.production && \
    echo "NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME" >> .env.production && \
    echo "NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION" >> .env.production

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create runtime .env.production with comprehensive variables
RUN echo "# NextAuth Configuration" > .env.production && \
    echo "NEXTAUTH_SECRET=k0hQgPid73ExcDT/6G1T5PBtkW4wISYvAAV4fpL3sO4=" >> .env.production && \
    echo "NEXTAUTH_URL=https://hfu-amplify.org" >> .env.production && \
    echo "" >> .env.production && \
    echo "# Cognito Configuration" >> .env.production && \
    echo "COGNITO_CLIENT_ID=2rq8ekafegrh5mcd51q80rt0bh" >> .env.production && \
    echo "COGNITO_CLIENT_SECRET=p2np9r5nt5mptnc74gv65q7siigo8a0rim211ai1nqmqvl7ssuk" >> .env.production && \
    echo "COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_PgwOR439P" >> .env.production && \
    echo "COGNITO_DOMAIN=https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com" >> .env.production && \
    echo "" >> .env.production && \
    echo "# API Endpoints" >> .env.production && \
    echo "CHAT_ENDPOINT=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod/amplify/chat" >> .env.production && \
    echo "API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod" >> .env.production && \
    echo "NEXT_PUBLIC_API_BASE_URL=https://qfgrhljoh0.execute-api.us-east-1.amazonaws.com/prod" >> .env.production && \
    echo "" >> .env.production && \
    echo "# LLM Router endpoint" >> .env.production && \
    echo "NEXT_PUBLIC_LLM_ROUTER_ENDPOINT=https://hdviynn2m4.execute-api.us-east-1.amazonaws.com/prod/proxy/llm" >> .env.production && \
    echo "" >> .env.production && \
    echo "# Authentication Provider Configuration" >> .env.production && \
    echo "NEXT_PUBLIC_DEFAULT_AUTH_PROVIDER=cognito" >> .env.production && \
    echo "NEXT_PUBLIC_AUTH_ENABLED=true" >> .env.production && \
    echo "" >> .env.production && \
    echo "# Feature Flags" >> .env.production && \
    echo "NEXT_PUBLIC_ENABLE_STREAMING=true" >> .env.production && \
    echo "NEXT_PUBLIC_ENABLE_CANVAS_INTEGRATION=false" >> .env.production && \
    echo "" >> .env.production && \
    echo "# Application Configuration" >> .env.production && \
    echo "NEXT_PUBLIC_APP_NAME=\"HFU Amplify\"" >> .env.production && \
    echo "NEXT_PUBLIC_APP_VERSION=\"1.0.28\"" >> .env.production

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]

# Add internal URL for container communication
ENV NEXTAUTH_URL_INTERNAL=http://localhost:3000
