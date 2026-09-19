# RescueGrid

Emergency response coordination platform (Bit N Build PS-9). Architecture and requirements live in [`docs/01_PRD.md`](docs/01_PRD.md) through [`docs/07_IMPLEMENTATION_ROADMAP.md`](docs/07_IMPLEMENTATION_ROADMAP.md).

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

Manual verification steps: see [docs/MANUAL_TASKS.md](docs/MANUAL_TASKS.md).

### Citizen UI and SOS (Phase 6)

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Citizen home (Report / SOS) |
| http://localhost:3000/report | Structured incident report |
| http://localhost:3000/sos | SOS quick report (≤2 taps) |
| http://localhost:3000/report/{tracking_ref} | Public status tracker |

```bash
curl -s -X POST http://localhost:8000/incidents/sos \
  -H "Content-Type: application/json" \
  -d '{"location":{"latitude":12.9716,"longitude":77.5946},"idempotency_key":"sos-demo-00000001","is_anonymous":true}'
```

`POST /incidents/sos` creates `source=sos`, `category=personal_safety`, `priority=critical`. Trusted contacts receive a minimal-disclosure simulated SMS when provided (Phase 8).

### Dispatch, dashboard & alerts (Phases 7–8)

| URL | Purpose |
|-----|---------|
| http://localhost:3000/login | Operator / field sign-in |
| http://localhost:3000/dashboard | Live ops queue + map + WS |
| http://localhost:3000/incidents/{id} | Recommendations + assign |
| http://localhost:3000/alerts | Alerts center |
| http://localhost:3000/field/assignments | Field team assignments |
| http://localhost:3000/analytics | Aggregate KPIs (no PII) |
| http://localhost:3000/settings/users | Admin user management |

Seed operators (after `seed_dev`): `dispatcher@rescuegrid.dev` / `ChangeMeOps123!`, `field@rescuegrid.dev` / `ChangeMeOps123!`.

```bash
# Login
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dispatcher@rescuegrid.dev","password":"ChangeMeOps123!"}'

# Recommendations + assign (replace TOKEN and IDs)
curl -s http://localhost:8000/incidents/INCIDENT_UUID/recommendations -H "Authorization: Bearer TOKEN"
curl -s -X POST http://localhost:8000/incidents/INCIDENT_UUID/assign \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"resource_id":"RESOURCE_UUID","decision":"accepted_ai"}'
```

Live dashboard: WebSocket `ws://localhost:8000/ws/dashboard?token=ACCESS_TOKEN` (dispatcher/admin). Redis channel `rescuegrid:incidents` fans out classification, assignment, and alert events. Alert worker evaluates critical / delayed-response / escalation rules every 30s (`DELAYED_RESPONSE_THRESHOLD_MINUTES`).

Incident APIs return `ai_summary` / `classification_source`. Personal-safety reporter identity is restricted unless admin or actively assigned (`pii.restricted` + `audit_log`). Analytics: `GET /analytics/overview|incidents-by-category|response-delays|hotspots`.

### Scale & security (Phases 9–10)

- PgBouncer service on port `6432` (optional pooled URL in `.env.example` as `DATABASE_URL_POOLED`; migrate stays on direct Postgres).
- Second API replica: `docker compose --profile replicas up -d api2` (port `8001`) sharing Redis for WS fan-out.
- Secure headers middleware; public intake remains `60/minute`.
- Pre-push lint: `bash scripts/lint-gate.sh` (ruff + eslint + pytest).

### Branding & mobile (Phases 12–13)

- Logo and photography live under `frontend/public/brand/` and `frontend/public/media/`.
- Citizen home is a full-bleed hero; auth pages use a split visual layout.
- **Phone access without an app store:** open the site in the mobile browser, or **Add to Home Screen** (PWA). See [docs/MANUAL_TASKS.md](docs/MANUAL_TASKS.md). No native Android/iOS builds.

### AI triage worker (Phase 5)

The `worker` service polls `classification_queue`, classifies incidents (LLM when `LLM_API_KEY` is set, otherwise rule-based fallback), runs PostGIS dedup, and publishes updates to Redis channel `rescuegrid:incidents`.

```bash
docker compose build api worker
docker compose up -d
docker compose logs -f worker
```

Optional LLM (OpenAI-compatible): set `LLM_API_KEY`, `LLM_API_BASE_URL`, and `LLM_MODEL` in `.env`. Optional dedup embeddings: `LLM_EMBEDDING_MODEL`. Tuning: `CLASSIFIER_POLL_SECONDS`, `CLASSIFIER_MAX_ATTEMPTS`, `DEDUP_RADIUS_METERS`, `DEDUP_TIME_WINDOW_MINUTES`.

After `POST /incidents`, expect `classification_queue.status=done` and `incidents.status=classified` (or `merged` / `possible_duplicate` when dedup matches).

### Phase 0 limitations

- LLM, email, and object storage keys are optional until later roadmap phases.
- SMS/push notifications are simulated in product scope (not wired in Phase 0).
- [`docs/08_IDE_IMPLEMENTATION_PROMPT.md`](docs/08_IDE_IMPLEMENTATION_PROMPT.md) holds the Final Verification checklist (Doc 04 §S).
- Operator runbook: [`docs/MANUAL_TASKS.md`](docs/MANUAL_TASKS.md). Final report: [`docs/FINAL_IMPLEMENTATION_REPORT.md`](docs/FINAL_IMPLEMENTATION_REPORT.md).

## Project layout

- `docs/` — PRD, architecture, design rules, roadmap, operator runbook, implementation report (flat; no subfolders)
- `backend/` — FastAPI (`api`) and background `worker` (same image, different commands)
- `frontend/` — Next.js App Router
- `docker-compose.yml` — single-network dev execution environment
