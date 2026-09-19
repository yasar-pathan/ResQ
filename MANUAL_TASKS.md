# Phase 3–4 manual checklist

Complete these on your machine after pulling Phase 3–4 changes.

## 1. Sync environment

- Merge any new keys from `.env.example` into your local `.env`.
- Keep `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` for admin login, seed, and tests.

## 2. Apply schema

```powershell
docker compose up -d
docker compose run --rm migrate
```

If migrate fails on a dirty or experimental database:

```powershell
docker compose down -v
docker compose up --build -d
docker compose run --rm migrate
```

## 3. Seed development data

```powershell
docker compose run --rm api python -m app.scripts.seed_dev
```

Inspect data (optional):

```powershell
docker compose exec postgres psql -U rescuegrid -d rescuegrid
```

Confirm tables, GIST indexes on `incidents.location` / `resources.location`, and sample rows.

## 4. API smoke (Phase 4 gate)

Login:

```powershell
curl -s -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@rescuegrid.dev\",\"password\":\"ChangeMeAdmin123!\"}"
```

Create a resource (admin JWT):

```powershell
curl -s -X POST http://localhost:8000/resources -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d "{\"type\":\"team\",\"name\":\"Smoke Team\",\"location\":{\"latitude\":12.97,\"longitude\":77.59},\"capabilities\":{}}"
```

Create incidents (guest) with `idempotency_key` and each `source`: `citizen_web`, `sensor`, `call`, `field_team`:

```powershell
curl -s -X POST http://localhost:8000/incidents -H "Content-Type: application/json" -d "{\"category\":\"fire\",\"description\":\"Smoke\",\"location\":{\"latitude\":12.9716,\"longitude\":77.5946},\"source\":\"citizen_web\",\"idempotency_key\":\"smoke-key-00000001\"}"
```

Repeat the same `idempotency_key` within 5 minutes → same incident id.

Public tracking:

```powershell
curl -s http://localhost:8000/incidents/<TRACKING_REF>/status
```

Dispatcher JWT: `GET /incidents`, `GET /incidents/{uuid}`.

## 5. Phase gate sign-off

- **Phase 3:** `alembic upgrade head` clean; seed runs; ER matches Doc 03 §4.
- **Phase 4:** One `POST /incidents` → `incidents` row + `classification_queue` with `pending` (worker not required).

## 6. Security before demo

- Change `BOOTSTRAP_ADMIN_PASSWORD` and `JWT_SECRET` from defaults.
- Do not commit `.env`.

## 7. Deferred

- **API-006 SOS** dedicated route is Phase 6; four intake sources use `POST /incidents` with `source` until then.
