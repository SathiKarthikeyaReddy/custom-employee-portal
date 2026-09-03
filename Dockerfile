# Multi-stage Dockerfile for complete 24/7 standalone deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Build Frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Build Backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./

EXPOSE 4000
ENV NODE_ENV=production
ENV PORT=4000

CMD ["sh", "-c", "node src/config/seed.js && node server.js"]
