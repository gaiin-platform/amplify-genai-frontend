# ---- Base Node ----
    FROM node:19-alpine AS base
    WORKDIR /app
    COPY package*.json ./
    
    # Create a new user "appuser" and give ownership of the "/app" directory
    RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
        chown -R appuser:appgroup /app
    
    # ---- Dependencies ----
    FROM base AS dependencies
    USER appuser
    RUN npm ci
    
    # ---- Build ----
    FROM dependencies AS build
    COPY --chown=appuser:appgroup . .
    RUN npm run build
    
    # ---- Production ----
    FROM node:19-alpine AS production
    # Recreate the "appuser" and "appgroup" in the production stage
    RUN addgroup -S appgroup && adduser -S appuser -G appgroup
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
    
    # Expose the port the app will run on
    EXPOSE 3000
    
    # Start the application
    CMD ["npm", "start"]