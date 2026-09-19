# syntax=docker/dockerfile:1

FROM node:22-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

EXPOSE 3000

# Clear stale Next.js chunks on start (directory may be a Docker volume mount)
CMD ["sh", "-c", "mkdir -p .next && find .next -mindepth 1 -delete 2>/dev/null; npm run dev -- -H 0.0.0.0 -p 3000"]
