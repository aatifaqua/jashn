# syntax=docker/dockerfile:1
# One image serves the API and the built web app from one origin (STATIC_DIR), so the app needs
# no CORS in production. The build stage has the dev tools; the runtime stage has only the
# production dependencies and runs as the unprivileged "node" user.

FROM node:22.23-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY web web
# "/" makes the app call the API on its own origin, and keeps connect-src at 'self'.
ENV VITE_API_BASE=/
RUN npm run build -w web

FROM node:22.23-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    STATIC_DIR=web/dist
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY packages/core/src packages/core/src
COPY server/src server/src
COPY --from=build /app/web/dist web/dist
USER node
EXPOSE 8787
# Shell form, so the probe follows a PORT overridden at run time.
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1
# Node 22.18+ strips TypeScript types natively, so the server runs from source without a build.
CMD ["node", "server/src/index.ts"]
