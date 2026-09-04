# Build from the REPO ROOT, not this directory, since this service bundles
# apps/web/src/remotion (see src/index.js's `remotionRoot`) and depends on the
# root npm workspace install:
#
#   docker build -f apps/renderer/Dockerfile -t magicbox-renderer .
#
# Then run with RENDERER_TOKEN, RENDERER_PUBLIC_BASE_URL, MEDIA_ALLOWED_HOSTS
# set, and point Convex's RENDERER_URL at wherever this ends up (Cloud Run,
# Fly.io, Render, etc.) via `npx convex env set RENDERER_URL <url>/api/render`.

FROM node:20-bookworm-slim

# Remotion's headless Chromium needs these; ffmpeg/ffprobe are for the
# declarative /api/compose pipeline (apps/renderer/src/ffmpeg).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpango-1.0-0 libpangocairo-1.0-0 fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Root workspace manifests first (better layer caching), then the two
# workspaces this service actually needs at runtime.
COPY package.json package-lock.json ./
COPY apps/renderer/package.json apps/renderer/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/backend/package.json packages/backend/package.json

RUN npm ci --workspace=magicbox-renderer --workspace=magicbox-web --include-workspace-root

COPY apps/renderer apps/renderer
COPY apps/web apps/web

ENV NODE_ENV=production
WORKDIR /app/apps/renderer
EXPOSE 8005

CMD ["node", "src/index.js"]
