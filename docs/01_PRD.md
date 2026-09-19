# 01 — Product Requirements Document: RescueGrid

**Baseline:** Option 1 — RescueGrid Core (modular monolith), as selected. Enhanced per explicit user request with (a) scalability hardening and (b) a personal-safety/women-safety workflow. Tags used throughout: **[PS]** = stated in Bit N Build'26 PS-9, **[A]** = reasonable assumption, **[E]** = enhancement requested by the user beyond the PS.

---

## 1. Product Overview

- **Product name:** RescueGrid
- **Product vision:** Replace fragmented, manual, multi-channel emergency coordination with one AI-assisted operational picture that classifies, deduplicates, and prioritizes incoming reports and recommends the right response resource, so human coordinators dispatch faster with full situational awareness.
- **Problem:** Emergency information arrives from citizens, sensors, calls, and field teams through disconnected channels, forcing manual cross-referencing, duplicate handling, and guesswork-based resource allocation.
- **Solution:** A unified intake → AI triage (classify/score/dedupe) → resource recommendation → dispatcher confirmation → live monitoring → analytics pipeline, human-in-the-loop at every dispatch decision.
- **Target audience:** Emergency dispatchers/coordinators (primary), field response teams, admin/analysts, citizen reporters.
- **Value proposition:** Cuts time-to-triage and eliminates duplicate incident handling by automating classification and dedup, while keeping a human in control of every dispatch action.

## 2. Objectives (Measurable — demo-scale targets, proposed where PS is silent) [A]

| ID | Objective | Target |
|---|---|---|
| OBJ-01 | Reduce time from report submission to triaged, prioritized queue entry | < 5 seconds (async classification) |
| OBJ-02 | Automatically consolidate duplicate reports of the same real-world incident | ≥ 90% precision on synthetic test set |
| OBJ-03 | Present a resource recommendation for every classified incident | 100% of classified incidents receive ≥1 candidate or explicit "no resource available" state |
| OBJ-04 | Keep dashboard state consistent across connected clients | Propagation ≤ 5s (NFR-001) |
| OBJ-05 | Zero unhandled PII exposure for personal-safety category incidents | 0 instances in security test suite (SEC-011/012) |

## 3. Scope

### In Scope
Multi-channel incident intake (citizen web form, SOS quick-report, simulated sensor/call/field-team endpoints) · AI classification/severity/priority/summary · geospatial+temporal duplicate detection and consolidation · resource inventory + AI-assisted recommendation · dispatcher assignment/override workflow · real-time map+queue dashboard · alerting/escalation engine · notification center (real email, simulated SMS/push) · analytics dashboard · authentication/RBAC · personal-safety category with anonymous reporting, SOS bypass-priority, trusted-contact notify, and PII audit control [E] · horizontal-scalability-ready architecture (async classification queue, WS fan-out via Redis, connection pooling) [E].

### Out of Scope
Real integration with actual 911/112 telephony infrastructure · live video ingestion/analysis · real hospital EHR system integration · legally binding/autonomous dispatch execution without human confirmation · native mobile apps (responsive web only) · continuous live "follow-me" location tracking (flagged as future enhancement) · multi-language UI (future).

## 4. User Types / Roles

| Role | Responsibilities | Permissions | Restrictions | Primary Workflows |
|---|---|---|---|---|
| **Citizen / Reporter** | Submit incident reports, track own report status | Create incident, view own incident(s), trigger SOS | Cannot view others' reports, cannot access dashboard/analytics/resources | F-01, F-02 |
| **Dispatcher / Coordinator** | Triage incoming incidents, confirm/override AI recommendations, assign resources, acknowledge alerts | View all incidents (except restricted PII fields unless assigned), assign resources, merge duplicates, resolve incidents, acknowledge alerts | Cannot manage user accounts or resource inventory master data | F-04–F-11 |
| **Field Team** | Receive assignments, update task status | View assigned incidents only, update assignment status | Cannot view unassigned incidents, cannot reassign | F-08 (status update leg) |
| **Admin / Analyst** | Manage resource inventory, configure alert thresholds, view analytics, manage users | Full read access, resource CRUD, threshold config, user role management | Cannot impersonate dispatcher actions (assign) unless also holds dispatcher role | F-06, F-13 |

## 5. Functional Requirements

Requirements are grouped into 14 Features (F-01…F-14). Each Feature satisfies one or more FR-IDs (full FR/NFR/SEC ID list is enumerated once here; downstream documents reference these IDs rather than restating them).

**Full Requirement ID Index:**
FR-001 Multi-source intake [PS] · FR-002 AI classification [PS] · FR-003 AI severity estimation [PS] · FR-004 AI priority assignment [PS] · FR-005 Duplicate detection/consolidation [PS] · FR-006 Resource recommendation [PS] · FR-007 Live dashboard [PS] · FR-008 Critical-incident alerts [PS] · FR-009 Delayed-response alerts [PS] · FR-010 Escalation flagging [PS] · FR-011 AI summaries [PS] · FR-012 AI recommendations for teams [PS] · FR-013 Analytics [PS] · FR-014 Notifications [PS] · FR-015 Auth + RBAC [A] · FR-016 Incident status lifecycle [A] · FR-017 Map visualization [A] · FR-018 Dispatcher override [E-team-added] · FR-019 Resource inventory mgmt [A] · FR-020 Personal-safety category [E] · FR-021 SOS quick-report [E] · FR-022 Anonymous reporting mode [E] · FR-023 Trusted-contact notification [E] · FR-024 PII access audit for personal-safety records [E]

---

### F-01 — Citizen Incident Reporting
- **Purpose:** Let a citizen submit a structured emergency report. **Satisfies:** FR-001.
- **Actor:** Citizen (authenticated or guest with contact capture).
- **Preconditions:** None (guest-accessible; account optional).
- **User flow:** Open report form → select category → enter location (map-pick or geolocation) → enter description → optionally attach photo → submit → receive confirmation with tracking reference.
- **Inputs:** category (enum), description (text, 10–2000 chars), location (lat/lng or address), photo (optional, image file ≤5MB), reporter contact (optional if guest).
- **Outputs:** Incident record (status=`reported`), tracking reference ID, confirmation screen.
- **Business logic:** On submit → persist → enqueue for async classification (F-04) → broadcast `incident.created` to dashboard.
- **Validation rules:** category required from fixed enum; description required, min 10 chars; location required (valid coordinate bounds); photo type/size checked.
- **Edge cases:** No location permission granted → fallback to manual address entry; offline submission → client-side queue + retry (proposed, [A]).
- **Failure states:** Submission fails validation → inline field errors; backend unavailable → user-facing retry message, no silent data loss.
- **Success state:** Report visible in dispatcher queue within classification SLA (NFR-002).
- **Dependencies:** F-04 (classification), F-05 (dedup).
- **Acceptance criteria:** A citizen can submit a report with only category+description+location in <60s; a malformed submission is rejected client- and server-side with a specific field error.

### F-02 — SOS Quick Report (Personal Safety) [E]
- **Purpose:** Minimal-friction panic report for personal-safety situations. **Satisfies:** FR-020, FR-021, FR-022.
- **Actor:** Citizen.
- **Preconditions:** Location permission granted or manual pin.
- **User flow:** Tap SOS button → confirm (single tap, no form) → optional 10s audio note → optional "notify trusted contacts" toggle → optional "report anonymously" toggle → submit → immediate confirmation.
- **Inputs:** GPS location (auto), timestamp (auto), optional audio note, is_anonymous flag, trusted_contact list (if opted in, pre-registered or entered inline).
- **Outputs:** Incident record with `category=personal_safety`, `priority=critical` (forced, not AI-derived), `is_anonymous` flag set accordingly.
- **Business logic:** SOS incidents **bypass AI confidence gating** — always created at `critical` priority and routed directly into the dispatcher's top-of-queue, AI classification still runs for summary/context but never downgrades priority. If trusted-contact opt-in: async notification job fires (FR-023).
- **Validation rules:** Location required (hard block if unavailable — show manual-pin fallback, never silently submit without location).
- **Edge cases:** Duplicate rapid SOS taps from same device within 60s → deduplicated client-side; anonymous SOS still requires location for dispatch.
- **Failure states:** Location unavailable → manual pin required before submit is allowed; network failure → local retry with visible "sending" state, never a silent failure.
- **Success state:** Incident appears in dispatcher queue flagged `SOS` and pinned above standard priority sort within NFR-002 latency, independent of classification queue backlog.
- **Dependencies:** F-04 (context only, not gating), F-09 (queue pinning), F-12 (trusted-contact notify).
- **Acceptance criteria:** SOS submission completes in ≤2 user actions; resulting incident is visible to dispatchers at `critical` priority even if the AI classifier is degraded/unavailable (NFR-004 fallback still applies for summary text only, never for priority downgrade).

### F-03 — Sensor / Call / Field-Team Intake
- **Purpose:** Accept simulated non-citizen channels. **Satisfies:** FR-001.
- **Actor:** System integration (simulated sensor script), Dispatcher (manual call-entry form), Field Team (mobile-web report).
- **User flow:** Authenticated API call or dispatcher-facing "log a call" form → same validation/pipeline as F-01, tagged with `source`.
- **Inputs/Outputs:** Same schema as F-01 plus `source` enum (`sensor|call|field_team`).
- **Business logic:** Sensor feed source is rate-limited and schema-validated against a fixed synthetic payload contract.
- **Edge cases:** Malformed sensor payload → rejected with logged error, does not crash ingestion pipeline.
- **Acceptance criteria:** A simulated sensor payload and a dispatcher-logged call both produce a standard Incident record indistinguishable downstream except for `source`.

### F-04 — AI Incident Classification, Severity & Priority Scoring
- **Purpose:** Automatically classify type, estimate severity, assign priority, generate a summary. **Satisfies:** FR-002, FR-003, FR-004, FR-011.
- **Actor:** System (async worker triggered on incident creation).
- **Preconditions:** Incident persisted with status=`reported`.
- **Flow:** Dequeue → build LLM prompt (category hint + description + location context) → request structured JSON output (category, severity 1–5, priority, 2–3 sentence summary, confidence) → persist → status→`classified` → broadcast update.
- **Inputs:** Incident description, category hint, location.
- **Outputs:** severity (1–5), priority (`low|medium|high|critical`), ai_summary, ai_confidence (0–1).
- **Business logic:** If `category=personal_safety`, priority is forced `critical` regardless of model output (see F-02). Low-confidence output (<0.5) is flagged for mandatory dispatcher review rather than auto-trusted.
- **Validation rules:** LLM output validated against strict JSON schema before persistence; invalid/malformed output triggers fallback.
- **Failure states:** LLM API timeout/error/rate-limit → **rule-based fallback classifier** (keyword+category heuristic table) produces a conservative severity/priority so the incident is never stuck unclassified (NFR-004).
- **Success state:** Incident reaches status=`classified` with all AI fields populated within NFR-002.
- **Dependencies:** F-01/F-02/F-03 (source), feeds F-05, F-07, F-09.
- **Acceptance criteria:** Every incident reaches `classified` status within target latency even under simulated LLM outage (fallback verified in test).

### F-05 — Duplicate / Related Incident Detection & Consolidation
- **Purpose:** Prevent the same real-world event from being handled as multiple incidents. **Satisfies:** FR-005.
- **Actor:** System (runs on each newly classified incident against recent open incidents).
- **Flow:** New classified incident → geospatial query (PostGIS `ST_DWithin`, configurable radius) against open incidents in same category within a rolling time window → candidate match scored (distance + time proximity + category match + text-similarity) → above threshold → auto-merge; borderline → flagged `possible_duplicate` for dispatcher confirmation; below → stays independent.
- **Inputs:** New incident location/time/category/description; open incident set.
- **Outputs:** `merged_into_id` set on child incidents; parent incident's report count incremented; dispatcher-visible merge history.
- **Business logic:** Auto-merge threshold and radius/time-window are admin-configurable (default: 150m / 30min / same category, [A]).
- **Edge cases:** Two genuinely distinct incidents in same location/time (e.g., unrelated fire and road accident at an intersection) → category mismatch prevents false merge.
- **Failure states:** Dedup query failure does not block incident from entering the queue — it simply stays un-deduplicated pending retry.
- **Success state:** Dispatcher queue shows one consolidated entry per real-world event with a visible "3 reports" counter.
- **Dependencies:** F-04 (needs classified category).
- **Acceptance criteria:** Submitting 3 reports for the same synthetic event within radius/window yields 1 queue entry with 3 linked source reports; a dispatcher can un-merge if incorrect.

### F-06 — Resource Inventory Management
- **Purpose:** Maintain the set of dispatchable teams/vehicles/equipment/facilities. **Satisfies:** FR-019.
- **Actor:** Admin (CRUD), System (status updates on assignment).
- **Flow:** Admin registers resource (type, name, location, capacity/attributes, status) → resource available for recommendation matching.
- **Inputs:** type, name, location, capabilities (JSON — e.g., `{"handles":["fire","medical"]}`), status.
- **Business logic:** Resource status transitions: `available → assigned → available` (or `unavailable` for maintenance/off-duty, admin-set).
- **Validation rules:** Location required for proximity matching; capability tags validated against known incident categories.
- **Acceptance criteria:** Admin can add/edit/deactivate a resource; deactivated resources are excluded from recommendations immediately.

### F-07 — AI Resource Recommendation
- **Purpose:** Suggest the best-fit resource(s) for a classified incident with an explanation. **Satisfies:** FR-006, FR-012.
- **Actor:** System, triggered after F-04 completes (or on-demand refresh by dispatcher).
- **Flow:** Classified incident → query available resources matching category capability → score by (proximity via PostGIS distance, capability match, current load) → return ranked top-3 with a one-line reason per candidate.
- **Inputs:** Incident category/severity/location; resource pool.
- **Outputs:** Ranked candidate list with `recommendation_reason` (e.g., "Nearest available fire unit, 2.1km, matches category").
- **Business logic:** Greedy per-incident scoring (Option 1 scope — not the cross-incident global optimizer of Option 2). Personal-safety incidents restrict candidates to appropriately trained/authorized responder types [E, configurable].
- **Failure states:** No matching available resource → explicit "no resource available" state surfaced to dispatcher (never a silent empty response) → triggers escalation alert (F-10).
- **Success state:** Dispatcher sees ≥1 ranked candidate with reason for every classified incident that has a matching resource type.
- **Dependencies:** F-04, F-06.
- **Acceptance criteria:** For a seeded incident+resource set, recommendation ranking is reproducible and reason text is non-empty for every candidate.

### F-08 — Dispatcher Assignment & Override
- **Purpose:** Human confirms, overrides, or rejects AI resource recommendation and assigns. **Satisfies:** FR-018.
- **Actor:** Dispatcher.
- **Flow:** Open incident → view recommendation → accept top candidate, pick alternate, or manually select any available resource → confirm assignment → resource status→`assigned`, incident status→`assigned` → field team notified (F-12).
- **Inputs:** incident_id, resource_id, dispatcher decision (`accepted_ai|overridden|manual`).
- **Business logic:** Every assignment records whether it followed the AI recommendation, enabling later accuracy analytics (F-13).
- **Validation rules:** Cannot assign an already-`assigned`/`unavailable` resource (optimistic lock / status re-check at confirm time).
- **Edge cases:** Two dispatchers act on the same incident concurrently → second action receives a conflict error and refreshed state.
- **Failure states:** Assignment write conflict → clear "resource just taken, refreshing" message, not a silent overwrite.
- **Success state:** Field team receives assignment; incident visible as `assigned` on dashboard.
- **Acceptance criteria:** Assignment is atomic — a resource cannot end up double-assigned under concurrent access (tested in IT-suite).

### F-09 — Live Operations Dashboard (Map + Queue)
- **Purpose:** Real-time unified view of active incidents, severity, assigned teams, response status. **Satisfies:** FR-007, FR-017.
- **Actor:** Dispatcher, Admin.
- **Flow:** Login → dashboard loads current state (REST) → subscribes to WebSocket channel → live updates patch state without reload.
- **Components:** Map (incident pins colored by priority/category, resource pins), prioritized incident queue (SOS/critical pinned top), incident detail panel (classification, summary, recommendation, assignment controls), status filters.
- **Business logic:** Queue sort order: `personal_safety` + `critical` first regardless of arrival time, then priority desc, then oldest-first.
- **Failure states:** WebSocket disconnect → visible "reconnecting" indicator + automatic reconnect + REST resync on reconnect (never silently stale).
- **Success state:** A new incident or status change appears on all connected dashboards within NFR-001.
- **Acceptance criteria:** Two simultaneously connected dispatcher sessions see the same state change within propagation target; personal-safety PII fields are hidden from any dispatcher not assigned to that incident (SEC-011).

### F-10 — Alerts & Escalation Engine
- **Purpose:** Surface critical incidents, delayed responses, and cases needing escalation. **Satisfies:** FR-008, FR-009, FR-010.
- **Actor:** System (rule evaluation), Dispatcher/Admin (acknowledge/escalate).
- **Flow:** Background rule check (scheduled, e.g., every 30s) evaluates: any `critical`/`personal_safety` incident unassigned > threshold minutes → `delayed_response` alert; incident with no resource match (F-07 failure) → `escalation_required` alert; any newly-classified `critical` incident → `critical_incident` alert.
- **Inputs:** Current incident/assignment state, admin-configured thresholds.
- **Outputs:** Alert record, dashboard banner/toast, notification (F-12).
- **Business logic:** Alerts are not auto-dismissed by system state change alone — require explicit dispatcher/admin acknowledgment, preserving an audit trail.
- **Failure states:** Alert delivery failure logged, does not block underlying incident processing.
- **Acceptance criteria:** An incident left unassigned past threshold produces exactly one active `delayed_response` alert (not duplicated on repeated rule ticks).

### F-11 — AI Emergency Summaries & Recommendations Display
- **Purpose:** Present the AI-generated situational summary and resource reasoning to dispatchers/field teams for fast comprehension. **Satisfies:** FR-011, FR-012 (display layer; generation covered in F-04/F-07).
- **Actor:** Dispatcher, Field Team.
- **Flow:** Incident detail view surfaces `ai_summary` and each recommendation's `recommendation_reason` inline; field team assignment notification includes the summary.
- **Business logic:** Summary is clearly labeled "AI-generated" and editable by dispatcher before it's included in any outbound notification (trust/accountability).
- **Acceptance criteria:** Field-team notification for an assignment always includes a non-empty summary field or explicit "summary unavailable" fallback text.

### F-12 — Notifications Center
- **Purpose:** Deliver timely updates to personnel/authorities/trusted contacts. **Satisfies:** FR-014, FR-023.
- **Actor:** System.
- **Flow:** Triggering event (assignment created, alert raised, SOS with trusted-contact opt-in, status change) → notification job → deliver via configured channel.
- **Channels:** Email — real delivery via a transactional email API. SMS/push — simulated (persisted + visibly logged as "would be sent to +91XXXXXXXXXX") since no production telephony/SMS gateway is integrated; clearly labeled as simulated in the UI, never presented as a real delivery guarantee.
- **Business logic:** Trusted-contact SOS notification includes only reporter-consented information (location + "this person may need help") — never full incident description unless the reporter explicitly opted to share more [E].
- **Failure states:** Delivery failure logged and retried once; permanent failure surfaced to the triggering dispatcher, not silently dropped.
- **Acceptance criteria:** Every assignment produces a logged notification record with delivery status; SOS trusted-contact path is independently testable.

### F-13 — Analytics & Reporting
- **Purpose:** Surface incident types, response delays, resource shortages, frequently affected areas. **Satisfies:** FR-013.
- **Actor:** Admin, Dispatcher (read-only view).
- **Flow:** Dashboard tab queries aggregate endpoints (incident counts by category/time, avg time-to-assign, avg time-to-resolve, resource utilization, geographic frequency heatmap, AI-recommendation acceptance rate).
- **Business logic:** All personal-safety incidents are aggregated/anonymized in analytics views — never shown with reporter identity, only counts/locations at a generalized granularity [E, SEC-012].
- **Acceptance criteria:** Analytics reflect only resolved/closed-window data consistently (documented refresh cadence), and personal-safety records never surface identifying fields in any analytics query.

### F-14 — Authentication & Role-Based Access Control
- **Purpose:** Secure login and enforce role permissions. **Satisfies:** FR-015, FR-024.
- **Actor:** All roles.
- **Flow:** Register/login → JWT issued (access + refresh) → role embedded in token → middleware enforces route-level and field-level (PII) access per role.
- **Business logic:** Field-level authorization: personal-safety incident PII (reporter identity, contact, trusted contacts) visible only to the currently-assigned dispatcher and admin; every read of such a field is written to `AuditLog` (FR-024).
- **Acceptance criteria:** A dispatcher not assigned to a personal-safety incident cannot retrieve reporter identity via any endpoint, including analytics/export paths; every successful PII read is audit-logged with actor+timestamp.

---

## 6. Complete User Journeys

**J1 — Citizen reports a flood, gets triaged, resource dispatched:**
Entry (report form) → no auth required → submit (F-01) → async classification (F-04) → dedup check (F-05) → appears in dispatcher queue (F-09) → dispatcher opens, sees AI summary + severity + recommendation (F-11/F-07) → confirms assignment (F-08) → field team notified (F-12) → field team updates status en route/on-scene/resolved → dashboard reflects live status (F-09) → incident closed → feeds analytics (F-13).

**J2 — SOS personal-safety report:**
Entry (SOS button, one tap) → optional anonymous toggle → optional trusted-contact opt-in → submit (F-02) → incident forced-critical, pinned top of queue immediately (bypasses classification wait) → dispatcher sees flagged SOS entry with only authorized PII visible (F-14) → assigns nearest appropriate resource (F-07/F-08) → trusted contacts notified if opted-in (F-12) → resolution → analytics show anonymized count only (F-13).

**J3 — Duplicate consolidation during a mass event:**
Entry → multiple citizens report the same fire within minutes → each independently classified (F-04) → geospatial+time dedup merges reports 2 and 3 into report 1 (F-05) → dispatcher queue shows one entry "3 reports" → single assignment covers the consolidated incident → all original reporters' tracking references show linked/resolved status.

**J4 — No-resource escalation:**
Entry → incident classified critical → resource recommendation finds zero available matching resource (F-07) → `escalation_required` alert raised (F-10) → admin/on-call notified (F-12) → admin manually reassigns from an adjacent resource pool or marks external escalation → incident proceeds.

**J5 — Delayed response detection:**
Entry → incident classified high-priority → remains unassigned past configured threshold → `delayed_response` alert (F-10) → dashboard banner + notification to on-duty dispatcher/admin → acknowledged and actioned.

## 7. State Definitions

| Entity | States |
|---|---|
| **Incident** | `reported → classified → (possible_duplicate \| merged) → assigned → in_progress → resolved → closed` |
| **Assignment** | `proposed → confirmed → en_route → on_scene → completed → cancelled` |
| **Resource** | `available → assigned → available` \| `unavailable` (admin-set, any time) |
| **Alert** | `active → acknowledged → resolved` |
| **Notification** | `queued → sent → delivered` \| `failed → retried → failed_permanent` |
| **User** | `active → suspended` (admin-controlled) |

## 8. Validation Rules

Category: must be one of fixed enum (`fire|flood|industrial_accident|road_incident|medical|personal_safety|other`). Description: 10–2000 chars, HTML-stripped. Location: lat ∈ [-90,90], lng ∈ [-180,180], required. Photo: JPEG/PNG only, ≤5MB. Email: RFC-compliant format. Password: ≥8 chars, at least 1 letter + 1 number (proposed [A]). Phone (trusted contact): E.164 format validated. Severity: integer 1–5. Priority: fixed enum. All list endpoints: page ≥1, limit ≤100.

## 9. Error Handling Requirements

| Scenario | Required Behavior |
|---|---|
| Invalid input | 400 with field-level error map, no partial persistence |
| API failure (external LLM) | Fallback classifier engages (NFR-004); incident never stuck unclassified |
| Database failure | 503 with generic message, no stack trace exposed, error logged with correlation ID |
| Auth failure | 401, no distinction between "wrong password" and "no such user" in message text |
| Authorization failure | 403, action logged |
| Timeout | Client shows retry affordance; server-side idempotency key prevents duplicate incident creation on client retry |
| Unavailable service (notification provider) | Logged as `failed`, does not block core incident workflow |
| Malformed data (bad LLM JSON) | Rejected by schema validator, fallback classifier used |
| Duplicate operation (double-submit) | Idempotency key on incident creation prevents duplicate records |
| Empty states | Every list view defines an explicit empty-state message (dashboard, analytics, resource list) |
| Partial failure (dedup succeeds, notification fails) | Each step commits independently; failures isolated and logged, do not roll back unrelated successful steps |
| Unexpected errors | Generic 500 to client, full detail only in server logs |

## 10. Security Requirements

SEC-001 JWT-based auth, short-lived access token + refresh token. SEC-002 Role-based authorization middleware on every protected route. SEC-003 Passwords hashed with bcrypt/argon2, never logged. SEC-004 Input validation + parameterized queries (ORM) on all endpoints — no raw SQL string interpolation. SEC-005 XSS: output-encode all user-supplied text rendered in frontend; sanitize description/summary fields. SEC-006 CSRF: not applicable to token-bearer API (stateless), CORS restricted to known frontend origin. SEC-007 Rate limiting on public intake endpoints (citizen report, SOS) to prevent abuse/flooding. SEC-008 Secrets (LLM API key, DB creds, JWT secret) via environment variables only, never committed. SEC-009 File upload: type/size validated server-side, stored outside web-root/served via signed URL, not executable. SEC-010 API responses never include stack traces or internal paths. SEC-011 **Field-level PII protection**: personal-safety reporter identity/contact/trusted-contacts visible only to assigned dispatcher + admin [E]. SEC-012 **Audit logging** of every PII field read on personal-safety records, plus all auth events and assignment actions [E].

## 11. Performance Requirements (proposed targets — [A] unless noted)

| Area | Target |
|---|---|
| API response (simple CRUD) | <300ms p95 |
| Classification latency (async) | <5s p95, LLM outage → fallback <1s |
| Dashboard update propagation | <5s (NFR-001) |
| Incident list pagination | Server-side, page size ≤50 default |
| Concurrency (demo scale) | 100–500 concurrent active incidents, 20 concurrent dispatcher sessions |
| Caching | Resource-availability + analytics aggregates cached (Redis), TTL 30–60s |
| Asset optimization | Frontend images/photos compressed on upload |

## 12. Accessibility Requirements

Full keyboard navigation for all dispatcher-critical actions (assign, acknowledge, resolve). WCAG AA contrast on all text/status colors (color never the sole signal for priority — icon/label paired with color). All form fields labeled, associated via `<label for>`/ARIA. Visible focus states on all interactive elements. Semantic landmark structure (`nav`, `main`, `aside` for map/queue split). Screen-reader announcements for live dashboard updates (ARIA live region on new critical/SOS incident). Responsive down to mobile width for the citizen report/SOS flow specifically (highest-priority mobile use case).

## 13. Analytics / Observability

**Events logged:** incident.created, incident.classified, incident.merged, incident.assigned, incident.status_changed, alert.raised, alert.acknowledged, notification.sent/failed, auth.login/failed, pii.accessed (personal_safety). **Metrics:** time-to-classify, time-to-assign, time-to-resolve, dedup match rate, AI-recommendation acceptance rate, alert count by type, resource utilization %. **Error tracking:** structured server-side logs with correlation ID per request; LLM fallback engagement rate tracked as a health signal. **Audit events:** all SEC-012 items, all assignment overrides (FR-018) with before/after resource.

## 14. Acceptance Criteria (Module Level)

Intake: all four sources (F-01/F-02/F-03) produce a valid Incident record passing schema validation. Triage: 100% of incidents reach `classified` within SLA including under simulated LLM outage. Dedup: synthetic duplicate set achieves ≥90% consolidation precision. Resource: every classified incident with a category-matching available resource receives ≥1 ranked recommendation. Dashboard: two concurrent sessions converge within propagation target. Alerts: no duplicate active alerts for the same condition. Security: PII-restricted fields never appear in an unauthorized response (verified via automated security test, SEC-011).

## 15. Definition of Done

A feature is complete only when: implementation matches its FR spec above; unit + integration tests pass; the complete end-to-end flow (frontend action → API → DB → response → dashboard update) has been manually traced at least once; error/edge cases in this document are handled, not just the happy path; responsive behavior verified for citizen-facing screens; security implications reviewed against Section 10; relevant documentation (this PRD, API contract, traceability matrix) updated to match the actual implementation.
