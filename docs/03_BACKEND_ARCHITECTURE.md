# 03 — Backend Architecture Document: RescueGrid

## 1. Architecture Overview

**Pattern:** Modular monolith (single deployable FastAPI service, internally organized by domain module) — per Option 1 selection. Scalability is achieved through horizontal replication of this stateless service, not through premature service decomposition (see §12 for the concrete scaling levers).

**Service boundaries (internal modules, not separate deployables):** `auth`, `incidents`, `classification`, `dedup`, `resources`, `assignments`, `alerts`, `notifications`, `analytics`, `audit`.

**Request lifecycle (synchronous path):**
Client → API Gateway (FastAPI app, single entrypoint) → CORS/Rate-limit middleware → Auth middleware (JWT decode + role attach) → Route handler → Pydantic validation → Service-layer business logic → Repository layer (SQLAlchemy) → PostgreSQL/PostGIS → Response (standard envelope) → (side-effect) WebSocket broadcast to subscribed dashboard clients.

**Asynchronous path (scalability-critical — [E], added for "ensure it is scalable"):**
Incident creation commits immediately with status=`reported` → a lightweight job row is enqueued in a `classification_queue` table (simple DB-backed queue for Option 1's scope; migration-ready to Redis/RQ if load requires) → a background worker process (separate process, same codebase, run via `python -m app.workers.classifier`) polls/consumes → calls LLM (or fallback) → persists classification → publishes update via Redis Pub/Sub → WebSocket gateway pushes to connected dashboards. This decouples the citizen-facing write path from LLM latency entirely — the single most important scalability lever for this system, since intake volume must never be bottlenecked by AI response time.

**External integrations:** LLM API (classification/summary), transactional email API (real notification delivery), simulated SMS/push (logged, not a real integration — explicitly not fabricated as if real, per the no-fake-integrations rule).

## 2. Technology Stack

| Layer | Choice | Justification |
|---|---|---|
| Language/Framework | Python 3.12 + FastAPI | Async-native, strong typing via Pydantic, fast to build REST+WS in one framework, mature ecosystem for GIS (GeoPandas/Shapely available if needed) |
| Database | PostgreSQL 16 + PostGIS extension | Native geospatial types/indexes required for dedup proximity queries and resource-distance scoring — this is a hard requirement, not a preference |
| ORM | SQLAlchemy 2.0 (async) + GeoAlchemy2 | Mature async ORM with first-class PostGIS type support |
| Migrations | Alembic | Standard SQLAlchemy migration tool |
| Auth | JWT (access + refresh), `passlib`/argon2 for hashing | Stateless, horizontally-scalable-friendly (no server-side session store required) |
| Cache / Pub-Sub | Redis | Dashboard aggregate caching (NFR performance targets) + WebSocket fan-out across replicas (scalability requirement) |
| Background worker | Same codebase, separate process entrypoint, DB-backed queue table (Option 1) | Avoids adding a message-broker dependency at MVP scale while still decoupling classification from the write path; documented upgrade path to Redis Streams/Celery if throughput demands it |
| Real-time | FastAPI native WebSocket endpoint + Redis Pub/Sub backplane for multi-instance fan-out | Enables WS to work correctly once the API is horizontally scaled (see §12) |
| AI/ML | External LLM API, structured JSON-mode output; deterministic rule-based fallback classifier (keyword/category heuristic table) | Meets FR-002/003/004/011 with a documented, testable fallback (NFR-004) — no custom model training required or justified at this scope |
| File storage | Local disk (dev) / S3-compatible object storage (prod) for incident photos/audio notes | Standard, low-cost, signed-URL access pattern for security |
| Notifications | Transactional email API (real, e.g. Resend/SendGrid-class provider); SMS/push simulated + persisted + UI-labeled as simulated | No fabricated telephony integration (per no-fake-integrations rule); real channel demonstrates the pattern end-to-end |
| Deployment | Docker container, Render/Railway (backend + worker as two processes from one image), Vercel (frontend), Neon/Supabase (Postgres+PostGIS managed) | Low-cost, PostGIS-supported managed Postgres is the binding constraint on provider choice |
| Monitoring/Logging | Structured JSON logging (correlation ID per request), platform-native log aggregation (Render/Railway dashboards) | Sufficient for hackathon/demo scale; documented upgrade path to a dedicated APM if this goes to production |

## 3. Project / Folder Structure

```
backend/
  app/
    main.py                  # FastAPI app instantiation, middleware registration
    config.py                 # env-driven settings (pydantic-settings)
    db/
      session.py              # async engine/session factory
      base.py                  # declarative base
    models/                   # SQLAlchemy models (one file per entity)
    schemas/                  # Pydantic request/response schemas
    modules/
      auth/         (router.py, service.py, dependencies.py)
      incidents/    (router.py, service.py, repository.py)
      classification/ (service.py, llm_client.py, fallback.py, prompts.py)
      dedup/        (service.py, spatial_queries.py)
      resources/    (router.py, service.py, repository.py)
      assignments/  (router.py, service.py)
      alerts/       (router.py, service.py, rules.py)
      notifications/(service.py, email_client.py, sms_simulator.py)
      analytics/    (router.py, service.py, queries.py)
      audit/        (service.py)
    workers/
      classifier_worker.py     # polls classification_queue
      alert_rule_worker.py     # scheduled alert-rule evaluation
    ws/
      gateway.py                # WebSocket endpoint + Redis subscriber
    middleware/
      auth.py, rate_limit.py, error_handler.py, cors.py
    core/
      security.py (JWT, password hashing)
      exceptions.py (typed API errors, see §8)
    tests/
      unit/ integration/ e2e/
  alembic/
    versions/
  .env.example
  Dockerfile
  requirements.txt
```

## 4. Database Design

All tables include `id (UUID, PK)`, `created_at`, `updated_at` (timestamptz, default now()) unless noted. Soft deletion is used only where audit history matters (`resources`, `users`); incidents are never hard-deleted (append-only status transitions preserve the audit trail required by SEC-012).

### `users`
| Field | Type | Null | Default | Unique | Index | Notes |
|---|---|---|---|---|---|---|
| id | UUID | N | gen | — | PK | |
| name | varchar(120) | N | — | — | — | |
| email | varchar(255) | N | — | Y | Y | |
| password_hash | varchar(255) | N | — | — | — | argon2 hash |
| role | enum(citizen,dispatcher,field_team,admin) | N | 'citizen' | — | Y | |
| phone | varchar(20) | Y | — | — | — | |
| is_active | boolean | N | true | — | — | soft-suspend |
| created_at/updated_at | timestamptz | N | now() | — | — | |

### `incidents`
| Field | Type | Null | Default | Unique | Index | FK |
|---|---|---|---|---|---|---|
| id | UUID | N | gen | — | PK | |
| tracking_ref | varchar(12) | N | gen | Y | Y | citizen-facing short code |
| reporter_id | UUID | Y | — | — | Y | → users.id (null if anonymous/guest) |
| is_anonymous | boolean | N | false | — | — | [E] |
| category | enum(fire,flood,industrial_accident,road_incident,medical,personal_safety,other) | N | — | — | Y | |
| description | text | N | — | — | — | |
| location | geography(Point,4326) | N | — | — | GIST | PostGIS — required for dedup/proximity |
| address_text | varchar(500) | Y | — | — | — | |
| source | enum(citizen_web,sos,sensor,call,field_team) | N | — | — | Y | |
| severity | smallint | Y | — | — | — | 1–5, AI or fallback assigned |
| priority | enum(low,medium,high,critical) | Y | — | — | Y | forced 'critical' for personal_safety |
| ai_summary | text | Y | — | — | — | |
| ai_confidence | numeric(3,2) | Y | — | — | — | 0.00–1.00 |
| classification_source | enum(llm,fallback) | Y | — | — | — | NFR-004 traceability |
| status | enum(reported,classified,possible_duplicate,merged,assigned,in_progress,resolved,closed) | N | 'reported' | — | Y | |
| merged_into_id | UUID | Y | — | — | Y | self-FK → incidents.id |
| resolved_at | timestamptz | Y | — | — | — | |
| created_at/updated_at | timestamptz | N | now() | — | Y (created_at) | for time-window dedup queries |

### `incident_media`
id (PK) · incident_id (FK→incidents, cascade delete) · type enum(photo,audio) · storage_url varchar(500) · uploaded_at timestamptz.

### `resources`
id (PK) · type enum(team,vehicle,equipment,facility) · name varchar(120) · location geography(Point,4326) GIST-indexed · capabilities jsonb (e.g. `{"handles":["fire","medical"]}`) · status enum(available,assigned,unavailable) indexed · is_active boolean default true (soft delete) · created_at/updated_at.

### `assignments`
id (PK) · incident_id (FK→incidents, indexed) · resource_id (FK→resources, indexed) · assigned_by_user_id (FK→users) · ai_recommended boolean · recommendation_reason text · decision enum(accepted_ai,overridden,manual) · status enum(proposed,confirmed,en_route,on_scene,completed,cancelled) indexed · assigned_at timestamptz · created_at/updated_at.
Constraint: partial unique index ensuring a `resource_id` has at most one row with `status NOT IN ('completed','cancelled')` — enforces the "no double-assignment" acceptance criterion (F-08) at the DB level, not just application logic.

### `alerts`
id (PK) · incident_id (FK→incidents, nullable, indexed) · type enum(critical_incident,delayed_response,escalation_required) · message text · status enum(active,acknowledged,resolved) indexed · acknowledged_by_user_id (FK→users, nullable) · created_at/updated_at.

### `notifications`
id (PK) · target_type enum(user,trusted_contact) · target_ref varchar(255) (user_id or contact phone/email) · channel enum(email,sms_simulated,push_simulated) · content text · status enum(queued,sent,delivered,failed,failed_permanent) indexed · related_incident_id (FK→incidents, nullable) · created_at/updated_at.

### `trusted_contacts` [E]
id (PK) · incident_id (FK→incidents, cascade delete) · name varchar(120) · contact varchar(255) · notified_at timestamptz (nullable).

### `audit_log` [E — SEC-012]
id (PK) · actor_user_id (FK→users, indexed) · action varchar(100) (e.g. `pii.read`, `assignment.override`, `auth.login`) · entity_type varchar(50) · entity_id UUID · metadata jsonb · created_at (indexed). Append-only, no update/delete allowed at application layer.

### `classification_queue` [E — scalability]
id (PK) · incident_id (FK→incidents) · status enum(pending,processing,done,failed) indexed · attempts smallint default 0 · created_at/updated_at. Backs the async worker described in §1; simple, dependency-free, upgrade path to Redis Streams documented in §12.

**ER relationship summary:** `users 1—N incidents` (reporter, nullable) · `incidents 1—N incident_media` · `incidents 1—N assignments N—1 resources` (many-to-many via assignments) · `incidents 1—N alerts` · `incidents 1—N trusted_contacts` · `incidents 1—N notifications` (via related_incident_id) · `incidents 1—1 incidents` (self-referencing merge via merged_into_id) · `users 1—N audit_log` (actor) · `incidents 1—N classification_queue` entries.

No unnecessary tables were created: analytics are computed via aggregate queries over existing tables (no separate reporting/snapshot table at this scale — documented as a future addition if query cost requires pre-aggregation).

## 5. API Contract

**Standard response envelope:**
```json
{ "success": true, "data": {}, "message": "...", "error": null }
```
Errors use `"success": false, "data": null, "error": {"code": "validation_error", "details": {...}}`.

| API-ID | Method | Route | Purpose | Auth | Roles | Key Request | Success | Errors |
|---|---|---|---|---|---|---|---|---|
| API-001 | POST | /auth/register | Create account | No | Public | name,email,password,role(citizen only self-serve; others admin-created) | 201 | 400 validation, 409 email exists |
| API-002 | POST | /auth/login | Login | No | Public | email,password | 200 (access+refresh tokens) | 401 invalid creds |
| API-003 | POST | /auth/refresh | Refresh token | Refresh token | All | refresh_token | 200 | 401 expired/invalid |
| API-004 | POST | /auth/logout | Invalidate refresh token | Yes | All | — | 204 | 401 |
| API-005 | POST | /incidents | Citizen report | Optional (guest allowed) | Citizen | category,description,location,photo?,idempotency_key | 201 | 400 validation, 429 rate-limit |
| API-006 | POST | /incidents/sos | SOS quick report | Optional | Citizen | location,audio?,is_anonymous,trusted_contacts? | 201 | 400 (location missing → hard block) |
| API-007 | GET | /incidents/:trackingRef/status | Citizen tracking | No | Public | — | 200 (status only, no internal fields) | 404 |
| API-008 | GET | /incidents | List/filter incidents | Yes | Dispatcher,Admin | category,priority,status,page,limit,sort | 200 (paginated) | 401,403 |
| API-009 | GET | /incidents/:id | Incident detail | Yes | Dispatcher,Admin,FieldTeam(assigned only) | — | 200 (PII fields redacted unless authorized — SEC-011) | 401,403,404 |
| API-010 | PATCH | /incidents/:id/status | Update status | Yes | Dispatcher,Admin,FieldTeam(assigned) | status | 200 | 400 invalid transition,403,404,409 |
| API-011 | POST | /incidents/:id/merge | Manually merge duplicate | Yes | Dispatcher,Admin | target_incident_id | 200 | 403,404,409 already merged |
| API-012 | POST | /incidents/:id/unmerge | Reverse an incorrect merge | Yes | Dispatcher,Admin | — | 200 | 403,404 |
| API-013 | GET | /incidents/:id/recommendations | Get resource recommendations | Yes | Dispatcher,Admin | — | 200 (ranked list, may be empty w/ reason) | 403,404 |
| API-014 | POST | /incidents/:id/assign | Confirm assignment | Yes | Dispatcher,Admin | resource_id,decision | 201 | 400,403,404,409 resource unavailable |
| API-015 | PATCH | /assignments/:id/status | Update assignment status | Yes | FieldTeam(own),Dispatcher,Admin | status | 200 | 400,403,404 |
| API-016 | GET | /resources | List resources | Yes | Dispatcher,Admin | type,status,page,limit | 200 | 401,403 |
| API-017 | POST | /resources | Register resource | Yes | Admin | type,name,location,capabilities | 201 | 400,403 |
| API-018 | PATCH | /resources/:id | Update/deactivate resource | Yes | Admin | fields to update | 200 | 400,403,404 |
| API-019 | GET | /alerts | List alerts | Yes | Dispatcher,Admin | status,type,page,limit | 200 | 401,403 |
| API-020 | PATCH | /alerts/:id/acknowledge | Acknowledge alert | Yes | Dispatcher,Admin | — | 200 | 403,404,409 already acknowledged |
| API-021 | GET | /analytics/overview | KPI summary | Yes | Dispatcher,Admin | date_from,date_to | 200 | 401,403 |
| API-022 | GET | /analytics/incidents-by-category | Category breakdown | Yes | Dispatcher,Admin | date_from,date_to | 200 | 401,403 |
| API-023 | GET | /analytics/response-delays | Delay metrics | Yes | Dispatcher,Admin | date_from,date_to | 200 | 401,403 |
| API-024 | GET | /analytics/hotspots | Geographic frequency | Yes | Dispatcher,Admin | date_from,date_to | 200 (aggregated/anonymized — SEC-012) | 401,403 |
| API-025 | GET | /notifications | List own notifications | Yes | All roles | page,limit | 200 | 401 |
| API-026 | WS | /ws/dashboard | Live incident/alert/assignment stream | Yes (token in handshake) | Dispatcher,Admin | — | stream events | 401 on handshake reject |

**Pagination:** `page`/`limit` query params on all list endpoints, `limit` capped at 100, response includes `{total, page, limit}` alongside `data`. **Filtering/sorting:** documented per-endpoint via query params above; default sort is priority-desc then created_at-asc, mirroring F-09's queue logic. **Idempotency:** API-005/006 require a client-generated `idempotency_key`; a duplicate key within a 5-minute window returns the original created incident rather than creating a second one (prevents double-submit under retry/timeout per PRD §9).

## 6. Authentication & Authorization

**Registration:** citizens self-register (optional — guest reporting still allowed for API-005/006); dispatcher/field_team/admin accounts are admin-created only (no self-serve escalation). **Login:** email+password → argon2 verify → JWT access token (15min TTL) + refresh token (7d TTL, stored hashed server-side for revocation on logout). **Session/token lifecycle:** access token carries `sub, role, exp`; refresh rotation on use (old refresh token invalidated when a new one is issued) to limit replay risk. **Password recovery:** out of MVP scope — flagged [A] as a fast-follow, not silently omitted. **Role permissions:** enforced via a FastAPI dependency (`require_role(...)`) on every protected route per the table in §5; **field-level** authorization for personal-safety PII is enforced inside the `incidents` service layer, not just at the route level — checked against `assignments.assigned_by_user_id`/current active assignment plus `admin` role, and every grant/denial is written to `audit_log` (SEC-012). **Token/session expiration:** access token expiry triggers a 401 the frontend interceptor handles (PRD §9, Frontend §6); refresh token expiry forces full re-login. **Refresh strategy:** silent refresh via API-003 on 401, single retry, then hard logout.

## 7. Business Logic (representative flows)

**Incident creation (F-01/F-02/F-03):** Input → Validation (Pydantic schema + custom category/coord validators) → Authorization (public for citizen/SOS, JWT-checked for sensor/call/field_team sources) → Business rule: SOS source forces `priority=critical` immediately, bypassing the queue-dependent AI path for priority (though classification still runs async for summary/context) → Persistence (incident row + media rows in a transaction) → enqueue classification job → Audit (source+actor logged) → Response (tracking_ref + 201).

**Assignment confirmation (F-08):** Input (resource_id, decision) → Validation → Authorization (dispatcher/admin) → Business rule: re-check resource.status=='available' inside the same DB transaction (row-level lock) before insert, relying on the partial-unique-index constraint as a hard backstop → Persistence (assignment row, resource.status→assigned, incident.status→assigned) → External call (notification to field team) → Result → Audit event → Response + WS broadcast.

**PII field access (SEC-011/012):** Every read path for `incidents.reporter_id`-linked identity fields on a `personal_safety` incident passes through a single `resolve_pii_visibility()` service function → checks caller role/assignment → if authorized, field returned AND `audit_log` row written (`pii.read`) → if not authorized, field explicitly nulled with a `restricted: true` marker (never silently omitted, so the frontend can render "Restricted" rather than looking broken).

## 8. API Error Architecture

| Error code | HTTP Status | Client behavior |
|---|---|---|
| validation_error | 400 | Show field-level errors |
| authentication_error | 401 | Trigger refresh-then-logout flow |
| authorization_error | 403 | Show "access restricted" panel |
| not_found | 404 | Show not-found state |
| conflict | 409 | Show "state changed, refreshing" + refetch |
| rate_limit | 429 | Show retry-after message |
| external_service_error | 502 | Show degraded-mode notice (e.g., "AI summary temporarily unavailable, using standard triage") |
| internal_server_error | 500 | Generic error panel, correlation ID shown for support reference, no stack trace |

## 9. Security Architecture

Input sanitization at the Pydantic schema layer (strict types, length bounds, enum constraints) before any business logic runs. Authentication/authorization per §6. Secrets exclusively via environment variables, loaded through `pydantic-settings`, never logged (log redaction filter on keys matching `*_key`, `*_secret`, `*_token`, `password`). Rate limiting (SlowAPI or equivalent) on public intake endpoints (API-005/006) keyed by IP, tuned to allow legitimate SOS bursts while blocking automated flooding. CORS restricted to the deployed frontend origin only. SQL injection prevented structurally via SQLAlchemy parameterized queries — no raw string SQL anywhere in the codebase (enforced as a code-review rule in Document 04). XSS prevented by never rendering unescaped user content server-side (API is JSON-only; escaping responsibility documented to the frontend for render-time). File upload controls: content-type allowlist, size cap, files stored outside any executable path, served via time-limited signed URLs, not direct public paths. Secure HTTP headers (HSTS, X-Content-Type-Options, X-Frame-Options) set via middleware. Logging/auditability per SEC-012. Dependency security: `pip-audit` run in CI before deploy (Document 04, Section O).

## 10. Database / API Performance

**Indexing:** GIST index on `incidents.location` and `resources.location` (mandatory for dedup/recommendation query performance) · B-tree indexes on all FK columns and frequently-filtered enums (`status`, `priority`, `category`) · composite index on `(status, priority, created_at)` backing the dashboard queue query directly. **Pagination:** enforced server-side on every list endpoint (§5). **Query optimization:** dedup candidate query scoped by both spatial radius AND a time-window `created_at` filter before the distance calculation, avoiding a full-table geospatial scan. **Caching:** Redis caches `/analytics/*` aggregate responses (30–60s TTL) and the resource-availability lookup used by the recommendation engine (short TTL, invalidated on any assignment write). **Connection handling:** SQLAlchemy async engine with pooled connections; PgBouncer in front of Postgres in production for connection-count headroom under horizontal API scaling (§12). **Background jobs:** classification and alert-rule evaluation run as separate worker processes, never inline in a request handler. **Large file handling:** photo/audio uploads streamed directly to object storage, never buffered fully in the API process memory. **Rate limits:** per §9.

## 11. Environment Configuration

Environments: `development` (local Docker Compose, local Postgres+PostGIS), `testing` (ephemeral DB per CI run, LLM calls mocked), `staging` (managed Postgres, real LLM with low quota, simulated notifications only), `production` (managed Postgres w/ PgBouncer, real LLM, real email, simulated SMS/push clearly labeled).

`.env.example`:
```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/rescuegrid
REDIS_URL=redis://host:6379/0
JWT_SECRET=
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=7
LLM_API_KEY=
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
LLM_EMBEDDING_MODEL=text-embedding-3-small
EMAIL_API_KEY=
EMAIL_FROM_ADDRESS=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
FRONTEND_ORIGIN=
DEDUP_RADIUS_METERS=150
DEDUP_TIME_WINDOW_MINUTES=30
DELAYED_RESPONSE_THRESHOLD_MINUTES=15
ENVIRONMENT=development
```
No real credentials committed; `.env` is git-ignored.

## 12. Deployment Architecture

**Frontend hosting:** Vercel (Next.js). **Backend hosting:** single container image, deployed as two processes on Render/Railway — `web` (FastAPI/Uvicorn) and `worker` (classifier + alert-rule loop) — scaled independently. **Database hosting:** Neon or Supabase (managed Postgres with PostGIS enabled). **Cache/Pub-Sub:** Upstash Redis (free tier sufficient at demo scale). **Storage:** S3-compatible bucket (e.g., Cloudflare R2 or AWS S3 free tier). **Domain/HTTPS:** platform-managed TLS on both Vercel and Render/Railway. **Environment configuration:** managed via each platform's secret/env store, mirroring `.env.example`. **Migrations:** Alembic migrations run as a pre-deploy step (`alembic upgrade head`) in the deployment pipeline, never manually against production. **Build process:** Docker multi-stage build (deps → app) for backend; standard Next.js build for frontend. **Deployment flow:** push to main → CI runs tests → build image → migrate → deploy `web` and `worker`. **Rollback strategy:** redeploy previous image tag; migrations are additive/backward-compatible where feasible (Document 04 §I) to avoid destructive rollback scenarios. **Monitoring:** platform log dashboards + `/health` endpoint checked by platform uptime monitor for both `web` and `worker` processes.

### Scalability Path (explicit, per user requirement)
1. **Stateless API replicas:** the `web` process holds no in-memory session state (JWT is stateless) → horizontally replicate behind the platform's load balancer with zero code change.
2. **WebSocket fan-out:** each API replica publishes dashboard events to Redis Pub/Sub instead of holding an in-process broadcast list; every replica's WS gateway subscribes to the same channel — so a dispatcher connected to replica A still receives an event created via replica B.
3. **Async classification queue:** decouples write-path throughput from LLM latency entirely (§1); documented upgrade from the DB-backed `classification_queue` table to Redis Streams if intake volume exceeds what polling can sustain.
4. **Connection pooling:** PgBouncer absorbs the connection-count growth from multiple API/worker replicas against a single Postgres instance.
5. **Read-heavy offload:** `/analytics/*` and dashboard list queries are cache-fronted (Redis) so replica growth doesn't linearly grow DB load.
6. **Clear extraction seams:** because modules under `app/modules/` are already domain-isolated with their own service/repository layers and communicate only through defined interfaces (no cross-module direct DB access), any module (e.g., `classification`) can be extracted into its own deployable service later without a rewrite — this is the incremental path toward an Option-2-shaped architecture if real production load ever justifies it, without having built that complexity prematurely.
