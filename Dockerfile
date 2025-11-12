# Dockerfile for Production Deployment

FROM node:18-alpine AS base

WORKDIR /app

RUN apk add --no-cache dumb-init

FROM base AS dependencies

COPY package*.json ./

RUN npm ci --only=production && \
    npm cache clean --force

FROM base AS build

COPY package*.json ./

RUN npm ci

COPY server ./server

FROM base AS release

ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY package*.json ./

USER node

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server/index.js"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
