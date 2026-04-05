# Stage 1: Build UI
FROM oven/bun:1 AS ui-builder
WORKDIR /app
COPY ui/package.json ui/bun.lock ./
RUN bun install --frozen-lockfile
COPY ui/ ./
RUN bun run build

# Stage 2: Build API
FROM node:22-slim AS api-builder
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY api/package.json ./
RUN npm install
COPY api/ ./
RUN npm run build
RUN npm prune --omit=dev

# Stage 3: Production
FROM node:22-slim
WORKDIR /app
COPY --from=api-builder /app/dist ./dist
COPY --from=api-builder /app/node_modules ./node_modules
COPY --from=api-builder /app/package.json ./
COPY --from=ui-builder /app/dist ./public

ENV HOST=0.0.0.0
ENV PORT=48310
EXPOSE 48310

CMD ["node", "dist/main"]
