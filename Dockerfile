# syntax=docker/dockerfile:1

# --- build stage -------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install with dev deps so tsc is available, using the lockfile for determinism.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies from the tree we are about to copy forward.
RUN npm prune --omit=dev

# --- runtime stage -----------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Run unprivileged; the node image ships a suitable user.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node

# Credentials are supplied at run time, never baked in:
#   -e HISPASHARE_USERNAME=... -e HISPASHARE_PASSWORD=...
# or --env-file .env. The server throws on the first request without them.
#
# stdio transport: the container talks JSON-RPC over stdin/stdout, so it must be
# run with -i (and without -t) by the MCP client.
ENTRYPOINT ["node", "dist/mcp/server.js"]

LABEL org.opencontainers.image.title="hispashare-mcp" \
      org.opencontainers.image.description="MCP server and typed client for HispaShare film/series metadata and ed2k links" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/JuanmanDev/hispashare-ts-api"
