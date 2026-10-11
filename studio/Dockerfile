# Dev image for `docker compose up` — hot-reload via bind mount + Vite's dev
# server. Not used for production builds. Installs at the workspace root and
# serves the `studio` app.
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

EXPOSE 8300

CMD ["pnpm", "--filter", "studio", "dev", "--host", "0.0.0.0"]
