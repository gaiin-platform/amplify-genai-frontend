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

# Accept white label build arguments (merged from main)
ARG NEXT_PUBLIC_CUSTOM_LOGO
ARG NEXT_PUBLIC_DEFAULT_THEME
ARG NEXT_PUBLIC_BRAND_NAME
# Accept launch-UX build arguments
ARG NEXT_PUBLIC_MAINTENANCE_MODE
ARG NEXT_PUBLIC_FULL_LAUNCH
ARG NEXT_PUBLIC_STATUS_PAGE_URL

# Set as environment variables for Next.js build
ENV NEXT_PUBLIC_CUSTOM_LOGO=${NEXT_PUBLIC_CUSTOM_LOGO}
ENV NEXT_PUBLIC_DEFAULT_THEME=${NEXT_PUBLIC_DEFAULT_THEME}
ENV NEXT_PUBLIC_BRAND_NAME=${NEXT_PUBLIC_BRAND_NAME}
ENV NEXT_PUBLIC_MAINTENANCE_MODE=${NEXT_PUBLIC_MAINTENANCE_MODE}
ENV NEXT_PUBLIC_FULL_LAUNCH=${NEXT_PUBLIC_FULL_LAUNCH}
ENV NEXT_PUBLIC_STATUS_PAGE_URL=${NEXT_PUBLIC_STATUS_PAGE_URL}

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

# Set NODE_ENV to production
ENV NODE_ENV=production

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
