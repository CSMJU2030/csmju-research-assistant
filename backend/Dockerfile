FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend ./backend
COPY frontend/package.json ./frontend/package.json
RUN pnpm install --frozen-lockfile
RUN pnpm --filter backend build
ENV NODE_ENV=production
WORKDIR /app/backend
EXPOSE 4002
CMD ["node", "dist/src/main.js"]
