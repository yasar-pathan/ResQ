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
