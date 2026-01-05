# ---- Base Node ----
    FROM --platform=linux/amd64 node:lts-alpine3.20 AS base
    WORKDIR /app
    COPY package*.json ./
    
    # Update and upgrade packages to ensure patching
    RUN apk update && apk upgrade && \
        addgroup -S appgroup && adduser -S appuser -G appgroup && \
        chown -R appuser:appgroup /app
    
    # ---- Dependencies ----
    FROM base AS dependencies
    USER appuser
    
    # Install dependencies and update packages
    RUN npm ci
    
    # ---- Build ----
    FROM dependencies AS build
    
    # Accept white label build arguments
    ARG NEXT_PUBLIC_CUSTOM_LOGO
    ARG NEXT_PUBLIC_DEFAULT_THEME
    ARG NEXT_PUBLIC_BRAND_NAME
    
    # Set as environment variables for Next.js build
    ENV NEXT_PUBLIC_CUSTOM_LOGO=${NEXT_PUBLIC_CUSTOM_LOGO}
    ENV NEXT_PUBLIC_DEFAULT_THEME=${NEXT_PUBLIC_DEFAULT_THEME}
    ENV NEXT_PUBLIC_BRAND_NAME=${NEXT_PUBLIC_BRAND_NAME}
    
    COPY --chown=appuser:appgroup . .
    RUN npm run build
    
    # ---- Production ----
    FROM --platform=linux/amd64 node:lts-alpine3.20 AS production
    
    # Update and upgrade packages to ensure patching in the production stage
    RUN apk update && apk upgrade && \
        addgroup -S appgroup && adduser -S appuser -G appgroup
    
    WORKDIR /app
    
    # Copy node_modules from the "dependencies" stage
    COPY --from=dependencies /app/node_modules ./node_modules
    
    # Copy build output from the "build" stage
    COPY --chown=appuser:appgroup --from=build /app/.next ./.next
    COPY --chown=appuser:appgroup --from=build /app/public ./public
    COPY --chown=appuser:appgroup --from=build /app/package*.json ./
    COPY --chown=appuser:appgroup --from=build /app/next.config.js ./next.config.js
    COPY --chown=appuser:appgroup --from=build /app/next-i18next.config.js ./next-i18next.config.js
    
    # Use the new "appuser"
    USER appuser
    
    # Set NODE_ENV to production
    ENV NODE_ENV=production
    
    # Create a writable volume for temporary files
    VOLUME /tmp
    
    # Expose the port the app will run on
    EXPOSE 3000
    
    # Start the application
    CMD ["npm", "start"]
    