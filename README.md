# RescueGrid

Emergency response coordination platform (Bit N Build PS-9). Architecture and requirements live in `01_PRD.md` through `07_IMPLEMENTATION_ROADMAP.md`.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Compose v2)
- On Windows: enable file sharing for the project drive so frontend volume mounts work for hot reload

## One-command local stack

From the repository root:

```bash
cp .env.example .env
docker compose up --build
```

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API      | http://localhost:8000 |
| API health | http://localhost:8000/health |
| Worker health | http://localhost:8081/health |

All services run on the Docker network `rescuegrid` (`postgres`, `redis`, `api`, `worker`, `frontend`).

### Environment URLs

- **Inside containers** (`api`, `worker`, `migrate`): use `DATABASE_URL` / `REDIS_URL` with hostnames `postgres` and `redis` (see `.env.example`).
- **Browser** (Next.js client): `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WS_URL` must use **localhost** and published ports (`8000`), not `http://api:8000`.

### Reset database

```bash
docker compose down -v
```

### Run tests locally (API)

```bash
cd backend
pip install -r requirements.txt
pytest
```

Or inside Compose after the stack is up:

```bash
docker compose run --rm api pytest
```

### Authentication (Phase 2)

API routes use the standard JSON envelope (`success`, `data`, `message`, `error`) except `GET /health` and `POST /auth/logout` (204).

| Endpoint | Description |
|----------|-------------|
| `POST /auth/register` | Public citizen signup; admins may create other roles with Bearer token |
| `POST /auth/login` | Returns access + refresh tokens; writes `auth.login` to `audit_log` |
| `POST /auth/refresh` | Rotates refresh token |
| `POST /auth/logout` | Revokes refresh tokens (requires access JWT) |
| `GET /auth/me` | Current user profile |

Optional dev bootstrap (empty database only): set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in `.env` when `ENVIRONMENT=development`.

Refresh tokens are stored hashed in `refresh_tokens` (server-side revocation/rotation).

### Core data and intake (Phase 3–4)

Apply migrations and optional dev seed:

```bash
docker compose run --rm migrate
docker compose run --rm api python -m app.scripts.seed_dev
```

| Endpoint | Description |
|----------|-------------|
| `POST /incidents` | Public intake (optional JWT); requires `idempotency_key`, `location`, `category`, `description`, `source` |
| `GET /incidents/{tracking_ref}/status` | Public status by tracking reference |
| `GET /incidents` | Dispatcher/admin list with filters |
| `GET /incidents/{id}` | Detail with PII stub for restricted categories |
| `PATCH /incidents/{id}/status` | Status updates (role-gated) |
| `GET /resources` | Dispatcher/admin list (`active_only` default true) |
| `POST /resources` | Admin create |
| `PATCH /resources/{id}` | Admin update / soft deactivate (`is_active`) |

Example intake (guest):

```bash
curl -s -X POST http://localhost:8000/incidents \
  -H "Content-Type: application/json" \
  -d '{"category":"fire","description":"Smoke reported","location":{"latitude":12.9716,"longitude":77.5946},"source":"citizen_web","idempotency_key":"demo-key-12345678"}'
```

Manual verification steps: see [MANUAL_TASKS.md](MANUAL_TASKS.md).

**Note:** Dedicated SOS route (API-006) is Phase 6; use `POST /incidents` with `source` for the four intake channels in Phase 4.

### AI triage worker (Phase 5)

The `worker` service polls `classification_queue`, classifies incidents (LLM when `LLM_API_KEY` is set, otherwise rule-based fallback), runs PostGIS dedup, and publishes updates to Redis channel `rescuegrid:incidents`.

```bash
docker compose build api worker
docker compose up -d
docker compose logs -f worker
```

Optional LLM (OpenAI-compatible): set `LLM_API_KEY`, `LLM_API_BASE_URL`, and `LLM_MODEL` in `.env`. Tuning: `CLASSIFIER_POLL_SECONDS`, `CLASSIFIER_MAX_ATTEMPTS`, `DEDUP_RADIUS_METERS`, `DEDUP_TIME_WINDOW_MINUTES`.

After `POST /incidents`, expect `classification_queue.status=done` and `incidents.status=classified` (or `merged` / `possible_duplicate` when dedup matches).

### Phase 0 limitations

- LLM, email, and object storage keys are optional until later roadmap phases.
- SMS/push notifications are simulated in product scope (not wired in Phase 0).
- `08_IDE_IMPLEMENTATION_PROMPT.md` is not in this repo yet; use `07_IMPLEMENTATION_ROADMAP.md` Phase 0 gate for local verification.

## Project layout

- `backend/` — FastAPI (`api`) and background `worker` (same image, different commands)
- `frontend/` — Next.js App Router
- `docker-compose.yml` — single-network dev execution environment
