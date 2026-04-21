# ---- Base Node ----
FROM --platform=linux/amd64 node:20-slim AS base
WORKDIR /app
COPY package*.json ./

# Update and upgrade packages to ensure patching
RUN apt-get update && apt-get upgrade -y && \
    groupadd -r appgroup && useradd -r -g appgroup appuser && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ---- Dependencies ----
FROM base AS dependencies

# Install dependencies as root first
RUN npm ci

# ---- Build ----
FROM dependencies AS build
COPY . .

# Build as root (production stage will use non-root user)
RUN npm run build

# ---- Production ----
FROM --platform=linux/amd64 node:20-slim AS production

# Update and upgrade packages to ensure patching in the production stage
RUN apt-get update && apt-get upgrade -y && \
    groupadd -r appgroup && useradd -r -g appgroup appuser && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy node_modules from the "dependencies" stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy build output from the "build" stage
COPY --chown=appuser:appgroup --from=build /app/.next ./.next
# Remove baked-in .env files — runtime env vars from ECS take precedence
RUN rm -f .next/standalone/.env .next/standalone/.env.local 2>/dev/null || true
COPY --chown=appuser:appgroup --from=build /app/public ./public
COPY --chown=appuser:appgroup --from=build /app/package*.json ./
COPY --chown=appuser:appgroup --from=build /app/next.config.js ./next.config.js
COPY --chown=appuser:appgroup --from=build /app/next-i18next.config.js ./next-i18next.config.js

# Switch to appuser for runtime
USER appuser

EXPOSE 3000
CMD ["npm", "start"]