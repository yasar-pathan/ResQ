# MANUAL_TASKS — Operator runbook

Remaining operator knobs only. Completed phase walkthroughs live in history via git; delivery record is `FINAL_IMPLEMENTATION_REPORT.md`. Agent session loop: `04_DESIGN_AND_DEVELOPMENT_RULES.md` §T.

---

## 1. Prerequisites

- Docker Desktop (Compose v2)
- Copy env: `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`)
- First time on a machine: `git pull` (or clone), then bring the stack up
- Git Bash or WSL recommended for `bash scripts/lint-gate.sh`

---

## 2. Config table (all knobs)

| Knob | Default / location | Notes |
|------|-------------------|--------|
| API HTTP | `http://localhost:8000` | Compose `api` |
| Worker health | `http://localhost:8081/health` | |
| Frontend | `http://localhost:3000` | |
| Postgres host port | `5432` | User/db/password from `.env` |
| Redis host port | `6379` | |
| PgBouncer host port | `6432` | Only with `--profile pooler` |
| API replica | `http://localhost:8001` | Only with `--profile replicas` |
| WS URL | `NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/dashboard` | |
| API browser base | `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` | |
| Map tiles (Leaflet) | `NEXT_PUBLIC_MAP_TILE_URL` | OSM by default; needs network |
| JWT | `JWT_SECRET` | Change before any shared deploy |
| Bootstrap admin | `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | |
| Seed dispatcher | `dispatcher@rescuegrid.dev` / `ChangeMeOps123!` | From `seed_dev` |
| Seed field | `field@rescuegrid.dev` / `ChangeMeOps123!` | |
| LLM chat | `LLM_API_KEY`, `LLM_API_BASE_URL`, `LLM_MODEL` | OpenAI-compatible `/chat/completions`; empty → fallback |
| LLM embeddings | `LLM_EMBEDDING_MODEL` | Optional dedup boost via `/embeddings`; empty → SequenceMatcher only |
| Email | `EMAIL_*` (optional) | Unused if empty |
| Dedup | `DEDUP_RADIUS_METERS`, `DEDUP_TIME_WINDOW_MINUTES` | |
| Delayed alert | `DELAYED_RESPONSE_THRESHOLD_MINUTES` | |
| CORS | `FRONTEND_ORIGIN=http://localhost:3000` | |
| Frontend hot-reload | `docker-compose.override.yml` | Bind-mount `./frontend` (dev only; CI uses image) |
| Next build cache | volume `frontend_next` → `/app/.next` | Wipe if CSS/JS 404 |
| Report photo uploads | API `POST /media/upload` → `/uploads/*` | Local disk (`backend/uploads/`); not S3 |
| Dependency audits | CI `\|\| true` | Informational; do not block on transitive CVEs by default |

---

## 3. One-time env secrets

1. Set strong `JWT_SECRET` and `BOOTSTRAP_ADMIN_PASSWORD`.
2. Optionally set OpenAI-compatible `LLM_*` and `LLM_EMBEDDING_MODEL`; restart `worker` after changes.
3. Never commit `.env`.

---

## 4. Default stack up / health

```powershell
docker compose down
docker compose up -d --build
```

Default services: **postgres, redis, migrate, api, worker, frontend** (no pgbouncer, no api2).

```powershell
curl.exe -sf http://localhost:8000/health
curl.exe -sf http://localhost:8081/health
# Frontend: open http://localhost:3000/login (confirm styles load)
docker compose run --rm migrate
docker compose run --rm api python -m app.scripts.seed_dev
```

Seed marker: `SEED00000002`.

---

## 5. Seed accounts & passwords

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@rescuegrid.dev` (or `BOOTSTRAP_ADMIN_EMAIL`) | value of `BOOTSTRAP_ADMIN_PASSWORD` in `.env` |
| Dispatcher | `dispatcher@rescuegrid.dev` | `ChangeMeOps123!` |
| Field | `field@rescuegrid.dev` | `ChangeMeOps123!` |
| Citizen | self-serve via `/register` | min 8 chars, letter + digit |

---

## 6. Optional profiles

```powershell
# Connection pooler (PgBouncer on host :6432)
docker compose --profile pooler up -d

# Second API replica on :8001
docker compose --profile replicas up -d
```

Only point `DATABASE_URL` at `DATABASE_URL_POOLED` after validating asyncpg + PostGIS with your pool mode.

---

## 7. Post-rebuild smoke

After any Docker rebuild or frontend cache wipe:

1. `curl.exe -sf http://localhost:8000/health` and `http://localhost:8081/health`
2. Open `http://localhost:3000/login` — page must be **styled** (not unstyled HTML)
3. Optional: login as dispatcher → `/incidents/log` (call intake); `docker compose run --rm api python -m app.scripts.simulate_sensor_intake` for sensor source

Historical Phase 11 sign-off checklist (if needed): `08_IDE_IMPLEMENTATION_PROMPT.md`.

---

## 8. Cloud deploy checklist (operator-owned)

### Mapping

| Component | Suggested platform | Env mapping |
|-----------|-------------------|-------------|
| Frontend | Vercel | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_WS_URL` (wss), `NEXT_PUBLIC_MAP_TILE_URL` |
| API + worker | Render / Railway | `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `FRONTEND_ORIGIN`, `LLM_*`, bootstrap admin |
| Postgres+PostGIS | Neon (PostGIS ext) | Provide async SQLAlchemy DSN |
| Redis | Upstash | `REDIS_URL` redis/rediss URL |

### Steps

1. Provision Neon with PostGIS; run migrations (`alembic upgrade head`) from a one-off job or release command.
2. Provision Upstash Redis; set `REDIS_URL`.
3. Deploy API + worker images; set secrets; confirm `/health` and worker health.
4. Deploy frontend to Vercel; set public API/WS URLs to HTTPS/WSS.
5. Set `FRONTEND_ORIGIN` to the Vercel URL; tighten CORS.
6. Rotate `JWT_SECRET` and admin password; disable bootstrap after first admin exists if desired.
7. Smoke: register/login, report, SOS, dashboard WS, one assignment, analytics.
8. Dependency audits (`pip-audit` / `npm audit`) remain informational unless you choose to fail on critical.

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Migrate fails / dirty DB | `docker compose down -v` then `up --build -d` + migrate + seed |
| Frontend missing modules | `docker volume rm rescuegrid_frontend_node_modules` then rebuild |
| Unstyled pages / CSS or chunk 404 | `docker compose stop frontend`; `docker volume rm rescuegrid_frontend_next`; `docker compose up -d --force-recreate frontend` |
| Stale host `.next` | Prefer the Docker volume; do not mix host `.next` with Linux container |
| pgbouncer running unwanted | Omit `--profile pooler`; `docker compose --profile pooler down` |
| WS not updating | Confirm `NEXT_PUBLIC_WS_URL` ends with `/ws/dashboard` |
| 429 on intake | Wait; honor `Retry-After` header |

### Lint before every push

```bash
bash scripts/lint-gate.sh
```
