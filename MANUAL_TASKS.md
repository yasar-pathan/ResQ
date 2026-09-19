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

---

# Phase 5 manual checklist (AI triage)

## 1. Sync environment

Merge from `.env.example`: `CLASSIFIER_POLL_SECONDS`, `CLASSIFIER_MAX_ATTEMPTS`, and optional `LLM_*` keys.

## 2. Rebuild worker

```powershell
docker compose build api worker
docker compose up -d
```

## 3. Verify classification (fallback)

Leave `LLM_API_KEY` empty. POST a new incident, then:

```powershell
docker compose logs -f worker
```

In psql: `classification_queue` → `done`; `incidents` → `classified` with `classification_source=fallback`.

## 4. Optional LLM smoke

Set provider credentials in `.env`, restart worker, submit one incident; confirm `classification_source=llm`.

## 5. Dedup smoke

Submit two `fire` reports at the same coordinates within 30 minutes; second should be `merged` or `possible_duplicate` with `merged_into_id` set.

## 6. Phase gate

```powershell
docker compose run --rm api pytest
```

Confirm tests pass with no real LLM key (NFR-004 fallback gate).

## 7. Next phase

Phase 6: citizen `/report` and `/sos` UI against this API.
