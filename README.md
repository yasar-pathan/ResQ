# RescueGrid

Emergency response coordination platform (Bit N Build PS-9). Architecture and requirements live in `01_PRD.md` through `07_IMPLEMENTATION_ROADMAP.md`.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Compose v2)

## One-command local stack

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| API health | http://localhost:8000/health |

## Reset database

```bash
docker compose down -v
```

## Phase 0 gate

`docker compose up` boots Postgres+PostGIS, Redis, API (`/health`), worker health, and Next.js with HMR on the `rescuegrid` network.
