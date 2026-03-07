# Multi-stage build for LeadSphere Pro

# Stage 1: Build backend
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/src ./src
COPY backend/tsconfig.json ./
COPY backend/prisma ./prisma
RUN npm run build

# Stage 2: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend . .
RUN npm run build

# Stage 3: Production runtime
FROM node:22-alpine
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy backend from builder
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package*.json ./backend/

# Copy frontend from builder
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/

# Copy prisma schema
COPY backend/prisma ./backend/prisma

# Create startup script
RUN echo '#!/bin/sh\ncd /app/backend && npm run db:push && node dist/index.js' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 3000 3001

ENTRYPOINT ["/sbin/dumb-init", "--"]
CMD ["/app/start.sh"]
