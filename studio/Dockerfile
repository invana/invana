# Dev image for `docker compose up` — hot-reload via bind mount + Vite's dev
# server. Not used for production builds.
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

EXPOSE 8300

CMD ["pnpm", "dev", "--host", "0.0.0.0"]
