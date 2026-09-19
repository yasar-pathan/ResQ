# 05 — Requirement Traceability Matrix: RescueGrid

Legend: **[PS]** PS-9 text · **[A]** assumption · **[E]** user-requested enhancement (scalability / personal-safety). Frontend routes per `02_FRONTEND_DESIGN.md` §3; API-IDs per `03_BACKEND_ARCHITECTURE.md` §5; Test-IDs per `06_TEST_PLAN.md`.

| PS-9 Requirement | Tag | PRD Req (Feature/ID) | Frontend | Backend/API | DB Entity | Test ID(s) | Acceptance Criterion |
|---|---|---|---|---|---|---|---|
| Collect incidents from citizen reports, sensors, calls, field teams | [PS] | F-01, F-03 (FR-001) | `/report` | API-005 | incidents, incident_media | UT-01, IT-01, E2E-01 | PRD §5 F-01 |
| AI classification of incidents | [PS] | F-04 (FR-002) | Incident Detail | API-009 (classification fields), worker | incidents.category | UT-04, IT-04 | PRD §5 F-04 |
| Severity estimation | [PS] | F-04 (FR-003) | Incident Detail | worker | incidents.severity | UT-04, IT-04 | PRD §5 F-04 |
| Priority levels | [PS] | F-04 (FR-004) | Incident Detail, Queue | worker | incidents.priority | UT-04, UT-05, IT-04 | PRD §5 F-04 |
| Duplicate/related report consolidation | [PS] | F-05 (FR-005) | Incident Detail (merge history) | API-011, API-012 | incidents.merged_into_id | UT-06, IT-05, E2E-03 | PRD §5 F-05 |
| Resource recommendation (teams, vehicles, equipment, facilities) | [PS] | F-07 (FR-006) | Incident Detail (recommendation list) | API-013 | resources, assignments | UT-07, IT-06 | PRD §5 F-07 |
| Real-time dashboard: active emergencies, severity, assigned teams, status | [PS] | F-09 (FR-007, FR-017) | `/dashboard` | API-008, WS API-026 | incidents, assignments | IT-08, E2E-01/02 | PRD §5 F-09 |
| Alerts: critical incidents | [PS] | F-10 (FR-008) | `/alerts`, AlertBanner | API-019, worker | alerts | UT-09, IT-09 | PRD §5 F-10 |
| Alerts: delayed responses | [PS] | F-10 (FR-009) | `/alerts` | worker (alert_rule_worker) | alerts | UT-09, IT-09, E2E-05 | PRD §5 F-10 |
| Escalation for cases requiring it | [PS] | F-10 (FR-010) | `/alerts` | worker | alerts | UT-09, E2E-04 | PRD §5 F-10 |
| AI-generated emergency summaries | [PS] | F-04, F-11 (FR-011) | AISummaryPanel | worker | incidents.ai_summary | UT-04, IT-04 | PRD §5 F-11 |
| AI-generated recommendations for response teams | [PS] | F-07, F-11 (FR-012) | Recommendation cards | API-013 | assignments.recommendation_reason | UT-07 | PRD §5 F-11 |
| Analytics: types, delays, shortages, affected areas | [PS] | F-13 (FR-013) | `/analytics` | API-021–024 | (aggregate queries) | IT-10, E2E-06 | PRD §5 F-13 |
| Notifications to personnel/authorities | [PS] | F-12 (FR-014) | Notification bell | API-025, notifications service | notifications | UT-11, IT-11 | PRD §5 F-12 |
| — (implied: secure multi-role access) | [A] | F-14 (FR-015) | `/login`, route guards | API-001–004 | users | UT-12, SEC-01/02 | PRD §5 F-14 |
| — (implied: track incident lifecycle) | [A] | F-01–F-09 (FR-016) | Status pills across screens | API-010 | incidents.status | UT-13, IT-01 | PRD §7 |
| — (implied by dashboard + suggested maps stack) | [A] | F-09 (FR-017) | Map component | API-008 | incidents.location, resources.location | E2E-01 | PRD §5 F-09 |
| — (trust/accountability need) | [E] | F-08 (FR-018) | Recommendation accept/override UI | API-014 | assignments.decision | UT-08, IT-06 | PRD §5 F-08 |
| — (implied substrate for resource recommendation) | [A] | F-06 (FR-019) | `/resources` | API-016–018 | resources | UT-10, IT-07 | PRD §5 F-06 |
| — (user-requested: personal safety) | [E] | F-02 (FR-020) | `/sos` | API-006 | incidents.category='personal_safety' | UT-14, E2E-02 | PRD §5 F-02 |
| — (user-requested: personal safety) | [E] | F-02 (FR-021) | SOSButton | API-006 | incidents.priority forced | UT-14, E2E-02 | PRD §5 F-02 |
| — (user-requested: personal safety) | [E] | F-02 (FR-022) | SOS anonymous toggle | API-006 | incidents.is_anonymous | UT-15, SEC-05 | PRD §5 F-02 |
| — (user-requested: personal safety) | [E] | F-12 (FR-023) | SOS trusted-contact toggle | notifications service | trusted_contacts | UT-16, IT-12 | PRD §5 F-12 |
| — (user-requested: security/trust) | [E] | F-14 (FR-024) | Incident Detail (restricted-field placeholder) | resolve_pii_visibility() | audit_log | SEC-05, SEC-06, IT-13 | PRD §5 F-14 |
| — (user-requested: scalability) | [E] | Architecture §1/§12 (async classification, WS fan-out, pooling) | — (non-functional) | classification_queue worker, Redis Pub/Sub, PgBouncer | classification_queue | PERF-01, PERF-02, IT-14 | Doc 03 §12 |

## Coverage Gaps (explicitly identified, none silently dropped)

- **Password recovery flow:** noted in `03_BACKEND_ARCHITECTURE.md` §6 as out-of-MVP-scope [A], not implemented, not tested. Documented limitation, not a silent omission.
- **Real SMS/push delivery:** intentionally simulated per Document 03 §2 — covered by UT-11/IT-11 for the simulated path only; no test claims real telephony delivery.
- **Live "follow-me" location tracking for SOS:** explicitly out of scope (PRD §3), no traceability row — flagged here as a known future enhancement, not a missed requirement.
- **Multi-cloud / advanced GIS layers (PS-2-style):** not applicable to PS-9; confirmed no cross-contamination from other problem statements' suggested stacks.

Every row above traces to a PRD acceptance criterion; every PRD Feature (F-01–F-14) has at least one row. No requirement in this matrix lacks a Test ID.

---

## Part 2 — System audit (2026-09-19)

### §A — Executive summary

**Verdict:** RescueGrid is a **production-credible local MVP** for PS-9 (citizen report/SOS, async classify/dedup, dispatch dashboard + WS, assignments, alerts, analytics, RBAC/PII). **Live cloud deploy is Deferred** (operator checklist in `MANUAL_TASKS.md` §8 only — not a defect).

**CI:** `.github/workflows/ci.yml` runs Compose smoke, migrate, **80 pytest**, frontend lint/test/build — not E2E/A11Y/PERF-01/03.

**Design rules (Doc 04):** flat `docs/`, session workflow §T followed for this pass. Doc 02 typography (Inter spec vs Manrope in UI) = cosmetic **Partial**.

**Roadmap honesty:** Phase 4 “four intake sources E2E” → API + seed + **`/incidents/log`** + sensor script; Doc 08 J4 (PII walkthrough) ≠ Doc 06 E2E-04 (escalation journey); Phase 10 PERF-01/03 not automated; IT-14/PERF-02 present.

**AI stack:** OpenAI-compatible **`/chat/completions`** (classification) + optional **`/embeddings`** (dedup text leg) on shared `LLM_API_*` + `LLM_EMBEDDING_MODEL`. Fallback classifier when chat unset (NFR-004).

### §B — Feature matrix F-01–F-14

| Feature | Status | Frontend | Backend | Tests | Residual |
|---------|--------|----------|---------|-------|----------|
| F-01 Citizen report | Met | `/report` | API-005 | UT-01, IT-01 | E2E-01 manual |
| F-02 SOS | Met | `/sos` | API-006 | UT-14, IT-12 | E2E-02 manual |
| F-03 Multi-source | Met | `/incidents/log`, API | API-005 auth sources | IT-01, sensor script | — |
| F-04 AI classify | Met* | review badge | worker + LLM/fallback | UT-04/04b/05, IT-04 | *Live LLM needs OpenAI `.env` |
| F-05 Dedup | Met* | detail status | dedup + optional embed | UT-06, IT-05 | *Embeddings optional |
| F-06 Resources | Met | `/resources` | API-016–018 | UT-10, IT-07 | — |
| F-07 Recommend | Met | incident detail | API-013 heuristic | UT-07, IT-06 | Not LLM-ranked |
| F-08 Assign | Met | accept/override | API-014 | UT-08, IT-06 | — |
| F-09 Dashboard | Met | `/dashboard`, WS | API-008, WS | IT-08 | E2E manual |
| F-10 Alerts | Met | `/alerts`, bell | worker | UT-09, IT-09 | Threshold env-only |
| F-11 AI display | Met | summary panels | `ai_summary` | UT-04 | — |
| F-12 Notify | Partial | bell | email/SMS sim | UT-11, IT-11 | Real email if `EMAIL_*` empty |
| F-13 Analytics | Met | `/analytics` | API-021–024 | IT-10 | E2E-06 manual |
| F-14 Auth/PII | Met | middleware | auth + PII resolver | SEC-05/06, IT-13 | — |
| Cloud deploy | **Deferred** | — | — | NOT_RUN | MANUAL_TASKS §8 |

### §C — Doc 06 test execution

| Gate | Baseline (pre-gap) | Final (this pass) |
|------|-------------------|-------------------|
| Ruff | PASS | PASS |
| Frontend lint + vitest (9) | PASS | PASS |
| Pytest | **69 PASS** | **80 PASS** |

| ID group | Final result | Notes |
|----------|--------------|-------|
| UT-01,04,04b,05,06,07,08,09,10,11,12,14,16 | PASS | + UT-13, UT-15 added |
| UT-13 | PASS | `test_state_machine.py` |
| UT-15 | PASS | `test_anonymous_serialization.py` |
| IT-01–14 (listed in Doc 06) | PASS | In CI via compose job |
| SEC-01–08 | PASS | Existing suite |
| SEC-09 | **PARTIAL** | SlowAPI middleware + intake `Request` wiring; live 429 burst = manual (Doc 08) |
| PERF-02, PERF-04 | PASS | ops integration + dedup index tests |
| E2E-01–06 | NOT_RUN | No Playwright/Cypress |
| PERF-01, PERF-03 | MISSING_TEST | Not implemented |
| A11Y / responsive automation | NOT_RUN | Manual spot-check only |

### §D — Enhancements backlog (non-Android)

Playwright J1/J2; admin alert-threshold UI; full Doc 02 UX-state pass; PERF-01/03 harness; real email when `EMAIL_*` set. **Not required** for local MVP sign-off.

### Coverage Gaps (audit update)

- **E2E journeys J1–J5:** manual / backlog — not automated in CI.
- **Cloud deploy:** **Deferred** to operator; documented, not executed.
- **Optional OpenAI embeddings:** enhance dedup when `LLM_EMBEDDING_MODEL` set; SequenceMatcher-only when empty.
- Prior gaps (password recovery, simulated SMS, live GPS, multi-cloud GIS) unchanged — see list above Part 2.
