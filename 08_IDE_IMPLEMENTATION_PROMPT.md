# 08 — IDE Implementation Prompt (Final Verification)

Closing checklist for Phase 11 production sign-off. Complete after local Compose + CI are green. Cloud platform deploy is **manual** (see `MANUAL_TASKS.md` § Cloud deploy) and is not required to mark the local production gate complete.

## Final Verification checklist (Doc 04 §S)

### A. Local stack

- [ ] `docker compose up -d --build` starts **only** `postgres redis migrate api worker frontend` (no `pgbouncer` / `api2` without profiles)
- [ ] `GET :8000/health`, `GET :8081/health`, frontend `:3000` respond
- [ ] `alembic heads` returns exactly one head; `alembic upgrade head` applied
- [ ] `bash scripts/lint-gate.sh` green (ruff + eslint/vitest + pytest)

### B. Journeys J1–J5 (manual)

| ID | Journey | Pass? |
|----|---------|-------|
| J1 | Citizen report → classify → dispatch → field resolve | [ ] |
| J2 | SOS (≤2 taps) → trusted contact notify (simulated) → dispatch | [ ] |
| J3 | Duplicate near-same reports consolidate / possible_duplicate | [ ] |
| J4 | Personal-safety PII restricted for unassigned dispatcher; granted + audited when assigned | [ ] |
| J5 | Analytics KPIs update after resolution; no reporter identity in aggregates | [ ] |

### C. Security live attempts

- [ ] **SEC-011:** Unassigned dispatcher on `personal_safety` detail → `pii.restricted=true`; no reporter identity; `audit_log` denial row
- [ ] **SEC-012:** Analytics/hotspots responses contain no reporter emails/phones/names
- [ ] Forged / role-escalated JWT rejected (401/403)
- [ ] Garbage `tracking_ref` → 400 envelope, not 500
- [ ] Unauthenticated protected routes → 401 envelope (no stack trace)
- [ ] Rate limit on `POST /incidents` / `/sos` returns 429 with `Retry-After` (SlowAPI default)

### D. Resilience

- [ ] With `LLM_API_KEY` empty/removed, new incidents still classify via **fallback** rules
- [ ] Worker health endpoint stays up during classification

### E. Artifacts

- [ ] `FINAL_IMPLEMENTATION_REPORT.md` present and accurate
- [ ] `MANUAL_TASKS.md` lists every operator knob once (ports, profiles, seed passwords, cloud env map)
- [ ] Known limitations documented (password recovery, simulated SMS/push, URL-only media, no live GPS, cloud deploy manual)

**Gate:** all boxes above checked for local production-ready sign-off. Live Vercel/Render/Neon deploy remains an operator follow-up from the cloud checklist.
