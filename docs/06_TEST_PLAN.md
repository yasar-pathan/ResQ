# 06 — Test Plan: RescueGrid

## Test Strategy Summary

Layered pyramid: unit (fast, isolated business logic) → integration (API+DB+cache) → end-to-end (full user journeys J1–J5) → security (adversarial) → performance (scale targets) → accessibility/responsive → regression (re-run every merge) → deployment/smoke (post-deploy gate).

## Unit Tests (UT)

| ID | Target | Maps to |
|---|---|---|
| UT-01 | Incident creation validation (category/description/coords bounds) | F-01, FR-001 |
| UT-04 | Classification service: LLM JSON schema validation + parsing | F-04, FR-002/003/004 |
| UT-04b | Classification fallback: keyword-heuristic classifier produces valid output with LLM client mocked to fail | F-04, NFR-004 |
| UT-05 | Priority-forcing rule: `category=personal_safety` always yields `priority=critical` regardless of AI output | F-02/F-04, FR-020/021 |
| UT-06 | Dedup scoring function: distance+time+category+text-similarity threshold logic | F-05, FR-005 |
| UT-07 | Resource recommendation ranking (proximity+capability+load scoring, deterministic given seeded data) | F-07, FR-006 |
| UT-08 | Assignment decision recording (`accepted_ai`/`overridden`/`manual`) | F-08, FR-018 |
| UT-09 | Alert rule evaluation (delayed-response threshold, no-duplicate-active-alert logic) | F-10, FR-008/009/010 |
| UT-10 | Resource status transition validation | F-06, FR-019 |
| UT-11 | Notification content builder (email + simulated SMS payload correctness) | F-12, FR-014 |
| UT-12 | JWT issuance/decode, role claim extraction | F-14, FR-015 |
| UT-13 | Incident state-machine transition guard (rejects invalid transitions, e.g. `resolved→reported`) | PRD §7 |
| UT-14 | SOS intake: forces critical priority, works with `is_anonymous=true` | F-02, FR-020/021 |
| UT-15 | Anonymous-mode: reporter_id/contact fields never serialized for `is_anonymous=true` incidents in any response schema | F-02, FR-022 |
| UT-16 | Trusted-contact notification payload excludes full incident description unless explicit opt-in | F-12, FR-023 |

## Integration Tests (IT)

| ID | Target | Maps to |
|---|---|---|
| IT-01 | POST /incidents → row persisted → classification_queue row created → status transitions to `classified` after worker run | F-01/F-04 |
| IT-04 | Classification worker end-to-end against a mocked LLM API (success + timeout + malformed-JSON cases) | F-04, NFR-004 |
| IT-05 | Dedup: seed 3 near-duplicate incidents → confirm auto-merge / possible_duplicate flag per threshold | F-05 |
| IT-06 | Recommendation + assignment: concurrent assignment attempts on same resource → exactly one succeeds (DB partial-unique-index enforced) | F-07/F-08 |
| IT-07 | Resource CRUD → deactivated resource excluded from recommendation query immediately | F-06 |
| IT-08 | Dashboard REST snapshot + WS event consistency after an incident status change | F-09 |
| IT-09 | Alert generation for delayed-response threshold breach; re-running the rule check does not duplicate an active alert | F-10 |
| IT-10 | Analytics aggregate endpoints return correct counts against seeded dataset; personal_safety rows never expose identity fields | F-13, SEC-012 |
| IT-11 | Notification delivery: real email path (sandbox provider) + simulated SMS path both logged with correct status | F-12 |
| IT-12 | SOS with trusted-contact opt-in triggers notification job with correct minimal-disclosure payload | F-02/F-12 |
| IT-13 | PII visibility resolver: assigned dispatcher sees reporter identity; unassigned dispatcher receives `restricted:true`; every read/denial writes an audit_log row | F-14, SEC-011/012 |
| IT-14 | Horizontal-scale simulation: two API instances behind a shared Redis Pub/Sub channel — event published via instance A is received by a WS client connected to instance B | Doc 03 §12 |

## End-to-End Tests (E2E) — full journeys from PRD §6

| ID | Journey | Steps Verified |
|---|---|---|
| E2E-01 | J1 — citizen report → dispatch → resolve | Full path incl. dashboard live update, field-team notification, resolution |
| E2E-02 | J2 — SOS report | One-tap submit → forced-critical → top-of-queue → PII restricted for unassigned dispatcher → assignment → trusted-contact notify |
| E2E-03 | J3 — duplicate consolidation | 3 reports → 1 queue entry → linked source reports visible |
| E2E-04 | J4 — no-resource escalation | Recommendation returns empty → escalation_required alert → admin manual reassignment |
| E2E-05 | J5 — delayed-response detection | Incident left unassigned past threshold → alert fires → acknowledged |
| E2E-06 | Analytics reflects a completed journey | J1 resolution appears correctly in `/analytics/overview` counts |

## UI Tests

Form validation (citizen report, SOS, resource registration) · navigation/route guarding (protected routes redirect correctly, return-path preserved) · responsive breakpoints for `/report`, `/sos`, `/dashboard` at mobile/tablet/desktop widths · SOS confirm-flow completes in ≤2 taps · dashboard queue visually pins SOS/critical entries above standard priority sort.

## Security Tests (SEC)

| ID | Target |
|---|---|
| SEC-01 | Unauthenticated access to any protected route (API-008–024) → 401 |
| SEC-02 | Role-mismatch access (e.g., field_team calling API-017 resource-create) → 403 |
| SEC-03 | Forged/tampered JWT role claim rejected (signature verification) |
| SEC-04 | SQL injection payloads through every text input field → no query execution, standard validation_error returned |
| SEC-05 | Unauthorized dispatcher (not assigned) attempts to read a `personal_safety` incident's reporter identity via API-009 and via `/analytics/hotspots` export → field restricted in both paths |
| SEC-06 | Every successful and denied PII read produces exactly one `audit_log` row |
| SEC-07 | Tracking-ref guessing (sequential/brute-force) on API-007 does not expose another citizen's report content beyond status |
| SEC-08 | File upload: oversized file, disallowed MIME type, and a file with a spoofed extension are all rejected |
| SEC-09 | Rate limit engages on repeated API-005/API-006 calls from one IP beyond threshold |
| SEC-10 | No stack trace, DB error text, or internal path appears in any 5xx response body |

## Performance Tests (PERF)

| ID | Target |
|---|---|
| PERF-01 | Classification worker throughput under simulated 100 concurrent incident submissions — verify async queue prevents write-path latency degradation |
| PERF-02 | WS fan-out latency across 2+ API replicas stays within the 5s propagation target (NFR-001) |
| PERF-03 | Dashboard list/analytics queries stay within response targets (NFR §11) under seeded 500-incident dataset with indexes in place |
| PERF-04 | Dedup spatial query performance with GIST index vs. without (regression guard — index must not be accidentally dropped in a future migration) |

## Accessibility Checks (A11Y)

Keyboard-only completion of: citizen report submission, SOS submission, dispatcher assignment confirmation. Screen-reader announcement verified for a new critical/SOS incident appearing on the live dashboard (ARIA live region). Contrast ratio check (WCAG AA) on all priority/status color tokens. Focus-visible state present on every interactive element in the component library.

## Responsive Tests

Citizen report + SOS screens verified functional and legible at 320px width minimum. Dashboard verified with map/queue toggle behavior at tablet width. Resource/User tables verified as stacked-card layout below 640px per `02_FRONTEND_DESIGN.md` §7.

## Regression Testing

Full UT+IT suite re-run on every merge to main; E2E suite re-run before every deploy; any previously-passing test that fails blocks merge/deploy per Document 04 §J.

## Deployment Verification / Smoke Testing

Post-deploy: `/health` endpoint on both `web` and `worker` processes returns 200 · a synthetic incident submitted via API-005 reaches `classified` status within SLA · WS connection succeeds and receives the synthetic incident's event · migrations report `alembic upgrade head` with no pending revisions · environment variables from `.env.example` all present in the deployed environment (fails loudly if any required var is missing, per Document 03 §11 config validation).
