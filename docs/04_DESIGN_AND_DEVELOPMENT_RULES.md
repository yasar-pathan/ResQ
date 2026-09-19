# 04 — Design & Development Rules for AI Agents / Developers: RescueGrid

This is the binding engineering rulebook for anyone — human or AI coding agent — implementing RescueGrid. Violations of these rules are treated as defects, not stylistic disagreements.

All project documents live flat under `docs/` (no subdirectories). Agents MUST read and update files there; the repo-root `README.md` is the entrypoint only.

### Agent Compact Mandate

These apply on every turn before any other style preference:

1. **Minimal tokens, maximum output** — Answer with the useful result only. No filler, no restating the ask, no policy dumps, no “I’ll continue / as requested” preambles.
2. **Analyze → plan → implement** — Inspect evidence (code, logs, runtime) first; form a short plan; then ship the **smallest correct fix**. Drive-by refactors and speculative abstractions are defects.
3. **Doc/code drift is a defect** — Oversized diffs, silent documentation lag, and unfinished local-only work that was meant to ship are treated like bugs.

## Section A — Source of Truth Hierarchy

1. Bit N Build'26 Problem Statement PS-9 (original text)
2. `docs/01_PRD.md` (approved)
3. `docs/03_BACKEND_ARCHITECTURE.md` (approved)
4. `docs/02_FRONTEND_DESIGN.md` (approved)
5. This document (`docs/04_DESIGN_AND_DEVELOPMENT_RULES.md`)
6. Existing implementation in the repository
7. Developer/agent assumptions

If two documents conflict (e.g., a route named differently in `01_PRD.md` vs `03_BACKEND_ARCHITECTURE.md`), the agent MUST stop and explicitly report the conflict rather than silently picking one. Requirements tagged **[E]** (user-added enhancements: scalability hardening, personal-safety workflow) carry the same binding weight as **[PS]**-tagged requirements once approved in the PRD — they are not optional polish.

## Section B — Before Writing Code

Before any implementation work, the agent MUST:

1. Read the relevant documents in this `docs/` set (full set when starting a phase; targeted docs when fixing a narrow bug).
2. Inspect repository and runtime evidence — framework/dependency versions, existing routes/models/components, env/Compose config, failing logs, test setup.
3. State the concrete problem (what is broken or missing) before changing code.
4. Identify what is already implemented vs. missing vs. broken; reuse existing code before writing new code.
5. Plan the minimal fix that closes the gap; implement only that; verify.

Never overwrite existing working functionality blindly. Never expand scope into adjacent “while I’m here” cleanups unless the user asked for them.

## Section C — Implementation Strategy

Incremental only. Sequence: Requirement → Architecture → Module design → Implementation → Unit test → Integration test → Flow verification → Regression verification → Documentation update → Checkpoint → Next module. Never attempt to scaffold the entire application (all 14 features) in one uncontrolled operation — follow the phase order in `07_IMPLEMENTATION_ROADMAP.md`.

## Section D — Feature Implementation Protocol

For each Feature (F-01…F-14): (1) read its full spec in `01_PRD.md` §5; (2) identify dependencies on other features (noted per-feature in the PRD); (3) identify affected frontend screens/components from `02_FRONTEND_DESIGN.md`; (4) identify affected backend modules/entities from `03_BACKEND_ARCHITECTURE.md`; (5) identify DB migration needs; (6) implement data layer + migration; (7) implement API endpoint(s); (8) test the API independently (unit + integration, using the relevant IDs from `06_TEST_PLAN.md`); (9) implement frontend; (10) connect frontend to backend; (11) trace the complete user flow manually; (12) test error states listed in PRD §9; (13) test edge cases listed per-feature in PRD §5; (14) run the existing regression suite; (15) verify responsive behavior for any citizen/SOS-facing screen touched; (16) verify security implications against PRD §10 (especially SEC-011/012 for any personal-safety-adjacent code); (17) update any document this change affects. A feature is not complete until all 17 steps are done.

## Section E — Module Boundaries

Each backend module under `app/modules/` owns exactly one domain (per `03_BACKEND_ARCHITECTURE.md` §3) with its own service + repository layer. Cross-module communication happens only through service-layer function calls, never direct cross-module DB access (e.g., the `alerts` module calls `incidents.service.get_incident()`, it never queries the `incidents` table directly). This boundary is what makes the future service-extraction scaling path (§12 of Document 03) actually possible — do not erode it for short-term convenience.

## Section F — Frontend Development Rules

Use the design system tokens in `02_FRONTEND_DESIGN.md` §2 exclusively — no arbitrary hex colors, font sizes, or spacing values introduced ad hoc. Reuse the component list in §4 before creating a new component; a new component is only justified if no existing one (and no reasonable variant of one) covers the need. Every data-driven screen implements the full UX-state set from §6 (initial/loading/success/empty/error/disabled/processing/partially-loaded/unauthorized/expired-session) — a screen with only a happy-path implementation is incomplete, not "done for now." Preserve the priority-pinning behavior for SOS/critical incidents in any component that renders an incident list — this is a safety-relevant UX rule, not a cosmetic one. Keep API-calling logic inside hooks/`lib/api`, never inside `ui/` presentational components. Never hardcode incident/resource data in a component — all such data flows through the typed API client.

## Section G — Backend Development Rules

Validate all external input at the Pydantic schema boundary before it reaches service logic. Every protected endpoint authenticates AND authorizes per the role table in `03_BACKEND_ARCHITECTURE.md` §5 — never trust a role claim without server-side verification, and never infer authorization from frontend route-guarding alone. Use SQLAlchemy parameterized queries exclusively — no raw string-interpolated SQL, ever, with no exceptions for "just this one admin script." Wrap multi-step writes (e.g., assignment creation touching `assignments` + `resources` + `incidents`) in a single DB transaction. Keep business logic in the `service.py` layer, not in route handlers — route handlers only do request/response marshaling and call into services. Handle every external call (LLM, email provider) with an explicit timeout and a defined fallback/failure path — an unhandled external-call exception is a defect. Personal-safety PII access (any `reporter_id`-linked field on a `category=personal_safety` incident) MUST go through the single `resolve_pii_visibility()` function described in Document 03 §7 — no endpoint or query is permitted to fetch or serialize those fields by any other path. This is the most important single rule in this document; treat any code path that bypasses it as a security defect blocking merge.

## Section H — Database Migration Rules

Every schema change ships as: an Alembic migration file + the corresponding updated SQLAlchemy model + any API/service code depending on the change + test coverage for the new shape + a documented migration-verification step (apply to a test DB, confirm no data loss/constraint violation). Never hand-edit a production schema outside the migration pipeline. Migrations affecting `incidents` or `assignments` (the safety-critical tables) require an explicit rollback plan noted in the migration's docstring before merge.

## Section I — API Change Rules

Before changing any endpoint in the §5 contract of `03_BACKEND_ARCHITECTURE.md`: (1) identify frontend consumers via the route usage in `02_FRONTEND_DESIGN.md`; (2) update the API contract table itself; (3) maintain backward compatibility for any endpoint already consumed by a deployed frontend build, unless the change is coordinated as a single atomic deploy; (4) update affected tests in `06_TEST_PLAN.md`; (5) test both success and every documented failure status for the changed endpoint. Never silently change a response shape without updating both the contract document and the frontend's typed client.

## Section J — Testing Strategy

Unit tests cover isolated service-layer logic (dedup scoring, priority-forcing rule, PII-visibility resolver, classification fallback). Integration tests cover API+DB behavior (assignment race-condition handling via the partial unique index, dedup query against seeded incidents, PII field redaction end-to-end). End-to-end tests walk full user journeys J1–J5 from `01_PRD.md` §6. UI tests cover form validation, the SOS confirm flow, and responsive breakpoints for citizen-facing screens. Security tests explicitly attempt: unauthorized PII read on a personal-safety incident, role-escalation via a forged JWT claim, SQL/XSS injection payloads through every text input, access to another user's incident via tracking-ref guessing. Regression tests re-run after every merged feature — no feature is "done" while it silently breaks a previously-passing test.

## Section K — Flow Verification

After each feature, trace at least one full flow end-to-end and confirm every link: user action → frontend event → API request → middleware → route → service → repository → DB → response → (if applicable) WS broadcast → frontend state update → user-visible result. Compiling and unit tests passing is not sufficient evidence of completion — the traced flow is required.

## Section L — Error & Failure-First Development

For every feature, explicitly test: invalid input, missing required input, duplicate submission (idempotency key reuse), unauthorized user, expired JWT, missing resource (404 paths), simulated DB failure, simulated LLM API failure/timeout (must engage fallback classifier, never leave an incident stuck `reported`), malformed LLM JSON response, network failure on the frontend (must show a retry affordance, never a silent dead end), and — specifically for F-02 — location-permission denial (must force the manual-pin fallback, never allow a locationless SOS to silently fail to reach dispatchers).

## Section M — No Mock-by-Accident Rule

Any placeholder, temporary hardcoded data, or demo-only logic (e.g., a stubbed LLM response used during early frontend development, a hardcoded resource list before F-06 is built) must be marked `# TODO`, `# MOCK`, or `# DEMO_ONLY` in code comments and tracked in the roadmap's phase checklist. Before final delivery, every such marker must be resolved or explicitly documented as a known limitation in the final implementation report — never allowed to silently ship as real logic. The SMS/push "simulated" notification channel is a permanent, intentionally-labeled simulation (not a temporary mock) — it must remain visibly labeled as simulated in the UI at all times, per Document 03 §2, and is exempt from this "must be resolved before delivery" rule specifically because it's documented as a deliberate scope boundary, not an accidental shortcut.

## Section N — Security-First Rules

Never expose secrets, commit API keys/passwords/credentials, hardcode any credential, trust frontend-computed authorization for a protected action, log a JWT/password/raw credential value, expose an internal stack trace or DB error detail to an end user, or disable a security control (rate limiting, auth middleware, PII redaction) to make local development more convenient — use environment-gated relaxed settings for local dev instead, never a code-level bypass that could ship.

## Section O — Dependency Rules

Before adding any new package: confirm the functionality isn't already covered by an existing dependency in the stack defined in `03_BACKEND_ARCHITECTURE.md` §2 / `02_FRONTEND_DESIGN.md` §9; check it's actively maintained; run `pip-audit`/`npm audit` before merge; prefer the smallest well-supported option. Do not add a message broker, a second database, or a new AI provider beyond what's specified without updating Document 03 and explaining the deviation per Section A.

## Section P — Performance Rules

Avoid: N+1 queries (use SQLAlchemy eager-loading for incident+media, assignment+resource joins), unbounded list queries (every list endpoint is paginated per contract), unnecessary re-renders (React Query cache keys scoped correctly, WS-driven invalidation rather than polling), oversized image uploads (client-side compression before upload), and synchronous LLM calls on any request path a citizen or dispatcher is actively waiting on beyond the classification worker's own async design.

## Section Q — Git / Change Management

Small, logical commits; one feature or one fix per commit/checkpoint; commit messages describe the actual change (`feat: implement SOS quick-report intake (F-02)`, not `updates`). Do not mix feature work, dependency bumps, and formatting changes in a single commit unless genuinely unavoidable. Every checkpoint leaves the project in a runnable, test-passing state.

After a complete change set is verified (lint/tests green, docs synced when required): **commit with a relevant message and push to the remote** unless the user explicitly forbids push. Finished work left only on the local machine is incomplete delivery. Never commit `.env`, API keys, or credentials.

## Section R — Documentation Synchronization

Any change to an API shape, DB schema, UX state, configuration, or architectural decision requires the corresponding update in the relevant document(s) from this set **and** an entry in `FINAL_IMPLEMENTATION_REPORT.md` when a refactor or config shipped — in the same change/PR. Documentation describing a system that no longer exists is treated as a defect equal in severity to a code bug. All docs stay flat under `docs/` (no nested doc folders).

## Section S — Final Verification

Before declaring RescueGrid complete, verify against `07_IMPLEMENTATION_ROADMAP.md`'s Phase 11 gate and the Final Verification checklist embedded in `08_IDE_IMPLEMENTATION_PROMPT.md`. This includes explicit manual walk-throughs of journeys J1–J5, confirmation that SEC-011/012 hold under an actual unauthorized-access test attempt (not just code review), and confirmation that the LLM-outage fallback path has been exercised at least once with the real API key removed.

## Section T — Standard Session Workflow

Every agent session follows this loop. Skip a step only when it clearly does not apply (e.g., docs-only change needs no Docker rebuild).

| Step | When | Action |
|------|------|--------|
| 1. Sync | First time on a machine, or after others pushed | `git pull` (or clone). If no `.env`, copy `.env.example` → `.env`. |
| 2. Bring stack up | Fresh setup or after Compose/Dockerfile/dep changes | `docker compose up -d --build` (recreate affected services). |
| 3. Analyze | Before coding | Evidence first (code + logs). State problem → plan → minimal fix (see Compact Mandate + §B). |
| 4. Implement | During work | Smallest correct change; no drive-by scope. |
| 5. Verify | Before claiming done | `bash scripts/lint-gate.sh` (or container equivalents: ruff, frontend lint/test, pytest). Fix failures. |
| 6. Docker hygiene | CSS/JS 404s or stale Next chunks | Wipe volume `rescuegrid_frontend_next`, recreate `frontend`. Dockerfile clears `.next` on start; the named volume can still go stale. |
| 7. Document | Any refactor/config/UX delivery | Append/organize in `FINAL_IMPLEMENTATION_REPORT.md`; keep `MANUAL_TASKS.md` to remaining operator work only. |
| 8. Ship | After the whole change set | Commit with an appropriate message → **push to origin** (unless user forbids push). |

Operator knobs and cloud steps: `MANUAL_TASKS.md`. Living delivery record: `FINAL_IMPLEMENTATION_REPORT.md`.
