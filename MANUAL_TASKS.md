# MANUAL_TASKS — Operator runbook

Every manual knob is listed once in the **Config table** below. Phase checklists are condensed; full journey sign-off is under **Phase 11**.

---

## 1. Prerequisites

- Docker Desktop (Compose v2)
- Copy env: `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`)
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
| JWT | `JWT_SECRET` | Change before any shared deploy |
| Bootstrap admin | `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | |
| Seed dispatcher | `dispatcher@rescuegrid.dev` / `ChangeMeOps123!` | From `seed_dev` |
| Seed field | `field@rescuegrid.dev` / `ChangeMeOps123!` | |
| LLM | `LLM_API_KEY` (optional) | Empty → rule fallback |
| Email | `EMAIL_*` (optional) | Unused if empty |
| Dedup | `DEDUP_RADIUS_METERS`, `DEDUP_TIME_WINDOW_MINUTES` | |
| Delayed alert | `DELAYED_RESPONSE_THRESHOLD_MINUTES` | |
| CORS | `FRONTEND_ORIGIN=http://localhost:3000` | |
| Frontend hot-reload | `docker-compose.override.yml` | Bind-mount `./frontend` (dev only; CI uses image) |
| Map tiles (Leaflet) | `NEXT_PUBLIC_MAP_TILE_URL` | OSM by default; needs network |
| Dependency audits | CI `\|\| true` | Informational; do not block on transitive CVEs by default |

---

## 3. One-time env secrets

1. Set strong `JWT_SECRET` and `BOOTSTRAP_ADMIN_PASSWORD`.
2. Optionally set `LLM_*` / `EMAIL_*`.
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
# Frontend: open http://localhost:3000
docker compose run --rm migrate
docker compose run --rm api python -m app.scripts.seed_dev
```

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

## 7. Phase 6–10 quick verification (condensed)

1. **Citizen:** `/report`, `/sos` (≤2 taps), `/report/{tracking_ref}` status.
2. **Ops:** login dispatcher → `/dashboard` map+queue; WS refresh after new incident.
3. **Assign:** `/incidents/{id}` Accept AI / Manual → field sees `/field/assignments`.
4. **Alerts:** delayed / critical → `/alerts` acknowledge.
5. **Analytics:** `/analytics` KPIs; no reporter identity.
6. **PII:** unassigned dispatcher on personal_safety → `pii.restricted`.
7. **Scale:** optional `--profile replicas`; optional `--profile pooler`.

```powershell
docker compose run --rm api pytest -q
docker compose run --rm frontend sh -c "npm run lint && npm test"
```

---

## 8. Phase 11 Final Verification

Follow `08_IDE_IMPLEMENTATION_PROMPT.md` in full. Minimum:

```powershell
docker compose down
docker compose up -d --build
curl.exe -sf http://localhost:8000/health
curl.exe -sf http://localhost:8081/health
bash scripts/lint-gate.sh
```

Manual: J1–J5 walkthrough; SEC-011/012 live attempt; remove `LLM_API_KEY` and confirm fallback classification; confirm `/register`, `/resources`, `/settings/users` (admin-only), error pages.

### Frontend route matrix

| Path | Citizen | Dispatcher | Field | Admin |
|------|---------|------------|-------|-------|
| `/`, `/report`, `/sos`, `/register` | ✓ | | | |
| `/dashboard`, `/alerts`, `/resources`, `/analytics` | | ✓ | | ✓ |
| `/field/*` | | | ✓ | ✓ |
| `/settings/*` | | | | ✓ |

---

## 8b. Phase 12 — UI polish check

1. Home (`/`) shows RescueGrid logo + full-bleed help-desk hero + Report/SOS CTAs.
2. Login/register show ambulance visual + logo wordmark.
3. Report page shows fire-brigade banner; resources page shows success/operations photo.
4. Operator sidebar uses Lucide icons + white logo mark.
5. SOS button pulses (respects `prefers-reduced-motion`).

---

## 8c. Phase 13 — Mobile access (PWA, no native apps)

**Easy path:** use the **same website** on a phone browser. Optionally **Add to Home Screen** so RescueGrid opens like an app. No Android/iOS store build is required or shipped.

| Step | Android (Chrome) | iOS (Safari) |
|------|------------------|--------------|
| Open | `https://<your-frontend>/` (or `http://localhost:3000` on LAN) | same |
| Install | Menu → **Install app** / Install RescueGrid (when prompted) | **Share** → **Add to Home Screen** |
| Use | Icon launches standalone shell; report + SOS work as on desktop mobile layout | same |

Checklist:

- [ ] Manifest loads: `/manifest.webmanifest`
- [ ] Icons: `/brand/icon-192.png`, `/brand/icon-512.png`, `/brand/apple-touch-icon.png`
- [ ] Complete `/report` and `/sos` on a phone-sized viewport (≤390px)
- [ ] Field `/field/assignments` readable on phone (stacked layout)
- [ ] Dispatchers prefer desktop for map+queue; phone is backup only

**Out of scope:** React Native, Flutter, Capacitor, Play Store, App Store.

---

## 8d. Phase 14 — Ops shell & Leaflet maps

1. Ops header: collapse control, brand, **bell** (active alerts popover) → **View all** opens `/alerts`.
2. Sidebar collapses to icon rail (desktop); hamburger Sheet on phone.
3. Dashboard filters (category / priority / status) update **both** queue and map incidents.
4. Queue rows: Map pin dialog + **Open** button (not plain text).
5. Map uses OpenStreetMap tiles (`NEXT_PUBLIC_MAP_TILE_URL`) — requires outbound network to the tile host.
6. Resources page: legend + status-colored markers (available / assigned / unavailable-inactive).

| Knob | Default |
|------|---------|
| Map tiles | `NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png` |

---

## 9. Cloud deploy checklist (manual — no live deploy in Phase 11 pass)

### Mapping

| Component | Suggested platform | Env mapping |
|-----------|-------------------|-------------|
| Frontend | Vercel | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_WS_URL` (wss), `NEXT_PUBLIC_MAP_TILE_URL` |
| API + worker | Render / Railway | `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `FRONTEND_ORIGIN`, `LLM_*`, bootstrap admin |
| Postgres+PostGIS | Neon (PostGIS ext) | Provide async SQLAlchemy DSN |
| Redis | Upstash | `REDIS_URL` redis/rediss URL |

### Steps (operator)

1. Provision Neon with PostGIS; run migrations (`alembic upgrade head`) from a one-off job or release command.
2. Provision Upstash Redis; set `REDIS_URL`.
3. Deploy API + worker images; set secrets; confirm `/health` and worker `:8081/health` (or platform health path).
4. Deploy frontend to Vercel; set public API/WS URLs to HTTPS/WSS.
5. Set `FRONTEND_ORIGIN` to the Vercel URL; tighten CORS.
6. Rotate `JWT_SECRET` and admin password; disable bootstrap after first admin exists if desired.
7. Smoke: register/login, report, SOS, dashboard WS, one assignment, analytics.
8. Dependency audits (`pip-audit` / `npm audit`) remain informational unless you choose to fail on critical.

---

## 10. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Migrate fails / dirty DB | `docker compose down -v` then `up --build -d` + migrate |
| Frontend missing modules | `docker volume rm rescuegrid_frontend_node_modules` then rebuild |
| Stale frontend build | Remove `frontend/.next`; rebuild image |
| pgbouncer running unwanted | Default compose no longer starts it; `docker compose --profile pooler down` or omit profile |
| WS not updating | Confirm `NEXT_PUBLIC_WS_URL` ends with `/ws/dashboard` |
| 429 on intake | Wait; honor `Retry-After` header |

### Lint before every push

```bash
bash scripts/lint-gate.sh
```
