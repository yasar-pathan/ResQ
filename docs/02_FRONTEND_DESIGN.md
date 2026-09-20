# 02 — Frontend Design Document: RescueGrid

## 1. Design Philosophy

**Visual personality:** Calm authority under pressure — a control-room tool, not a consumer app. High information density is acceptable for dispatcher screens; the citizen/SOS screens are the opposite: maximal simplicity, minimal cognitive load, largest touch targets.

**Usability principles:** (1) Never make a dispatcher hunt for the highest-priority item — critical/SOS incidents are always visually pinned and unmistakable. (2) Never show an ambiguous "loading" screen longer than necessary — every async action has an explicit state. (3) Color never carries meaning alone (accessibility + colorblind dispatchers). (4) The citizen-facing SOS flow must be operable one-handed, under stress, in under 10 seconds.

**Information hierarchy:** Priority > Status > Time. Personal-safety/SOS incidents are a hierarchy override — always rendered above standard priority sort.

**Design priorities (in order):** clarity under stress → speed of the critical action (assign/acknowledge) → data density for situational awareness → aesthetic polish.

## 2. Design System

### Colors

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | #1E3A8A | Primary actions, active nav, links |
| `--color-primary-hover` | #1E40AF | Hover state |
| `--color-secondary` | #0F766E | Secondary actions, informational accents |
| `--color-accent` | #7C3AED | AI-generated content indicators (badges, summary panels) |
| `--color-bg` | #F8FAFC | App background |
| `--color-surface` | #FFFFFF | Cards, panels |
| `--color-text` | #0F172A | Primary text |
| `--color-text-muted` | #64748B | Secondary/meta text |
| `--color-success` | #15803D | Resolved, available, confirmed |
| `--color-warning` | #B45309 | Delayed, medium priority |
| `--color-error` | #B91C1C | Critical priority, failures |
| `--color-info` | #0369A1 | Neutral system notices |
| `--color-sos` | #DC2626 | Reserved exclusively for personal-safety/SOS — always paired with an icon + "SOS" text label, never color alone |
| `--color-border` | #E2E8F0 | Dividers, input borders |

Dark-mode tokens are not in MVP scope (dispatcher control-room use case assumes managed lighting); flag as future enhancement.

### Typography

- **Font family:** Inter (system-ui fallback stack: `-apple-system, Segoe UI, Roboto, sans-serif`).
- **Headings:** H1 28px/700/1.2 · H2 22px/700/1.25 · H3 18px/600/1.3 · H4 16px/600/1.35.
- **Body:** 14px/400/1.5 default; 16px for citizen-facing/SOS screens (larger for stress-condition legibility).
- **Labels/buttons:** 13px/600, uppercase tracking 0.02em for status badges only.
- **Captions/meta:** 12px/400, `--color-text-muted`.
- **Numerical/data (severity score, counts, timers):** tabular-nums, 20–32px/700 depending on prominence, monospace-adjacent rendering for scannability.

### Spacing Scale
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (px). Component internal padding uses 8/16; section gaps use 24/32; page-level margins use 48/64.

### Border Radius
Buttons/inputs: 6px. Cards/panels: 10px. Modals: 12px. Badges/pills: 999px (full).

### Shadows
Used only for elevation implying interactivity or overlay (cards on hover: `0 2px 8px rgba(15,23,42,0.08)`; modals/drawers: `0 8px 32px rgba(15,23,42,0.16)`). Never used on static in-flow content (dashboard panels, table rows) — flat borders (`--color-border`) define those instead.

### Icons
Lucide icon set, 20px default / 16px inline-with-text / 24px for primary actions. Always paired with a text label on any status/priority indicator (accessibility rule). Prohibited: decorative-only icons with no semantic pairing on any dispatcher-critical control.

### Grid / Layout
Max content width: 1440px (dashboard), 640px (citizen/SOS flow — intentionally narrow, mobile-first). Page margins: 24px mobile, 48px desktop. Dashboard: 12-column grid, map+queue split 60/40 on desktop, stacked (queue above map, collapsible) on mobile. Breakpoints: mobile <640px, tablet 640–1024px, desktop >1024px.

---

## 3. Frontend Information Architecture

**App shell:** Top bar (logo, role badge, notifications bell, user menu) + left sidebar nav (role-conditional) + main content area.

**Route structure:**

| Route | Screen | Role | Auth |
|---|---|---|---|
| `/report` | Citizen Report Form | Citizen/Guest | Public |
| `/sos` | SOS Quick Report | Citizen/Guest | Public |
| `/report/:trackingId` | Report Status Tracker | Citizen/Guest | Public (tracking ID gated) |
| `/login`, `/register` | Auth | All | Public |
| `/dashboard` | Live Ops Dashboard | Dispatcher, Admin | Protected |
| `/incidents/:id` | Incident Detail | Dispatcher, Admin | Protected |
| `/resources` | Resource Inventory | Admin | Protected |
| `/field/assignments` | Field Team Assignment List | Field Team | Protected |
| `/field/assignments/:id` | Field Assignment Detail | Field Team | Protected |
| `/analytics` | Analytics | Admin, Dispatcher (read-only) | Protected |
| `/alerts` | Alerts Center | Dispatcher, Admin | Protected |
| `/settings/users` | User Management | Admin | Protected |

Protected routes redirect to `/login` with return-path preserved on session expiry (UX-state: expired session, see Section 6).

### Screen Inventory (detail)

**Citizen Report Form** (`/report`) — Purpose: structured incident submission. Entry: public link/QR. Layout: single-column form, progressive disclosure (category → location → details → optional photo). Data/API: `POST /incidents`. States: initial, submitting, success (tracking ID shown), error (field-level), offline-queued.

**SOS Quick Report** (`/sos`) — Purpose: one-tap panic report. Entry: prominent persistent button on citizen-facing shell + direct link. Layout: full-viewport single large SOS button, confirm step, two toggles (anonymous, notify contacts). Data/API: `POST /incidents/sos`. States: idle, location-pending, confirming, submitting, success (large confirmation + what-happens-next text), location-denied (manual pin fallback), error (persistent visible retry, never a dead-end).

**Live Ops Dashboard** (`/dashboard`) — Purpose: real-time situational awareness + triage. Entry: post-login default for Dispatcher/Admin. Layout: left = prioritized queue (SOS/critical pinned, filterable), right = map (incident + resource pins, layer toggle), top = alert banner strip. Data/API: `GET /incidents`, WS `/ws/dashboard`. States: initial-loading (skeleton), live, empty (no active incidents — explicit positive-state message, not a blank screen), degraded (WS disconnected — reconnect banner), partial (map loaded, queue pending or vice versa — independent loading per panel).

**Incident Detail** (`/incidents/:id`) — Purpose: full triage/assign workspace. Layout: header (category/priority/status/SOS flag), AI summary panel (accent-bordered, "AI-generated" label), classification detail, recommendation list with accept/override actions, assignment history, merge history, notes. Data/API: `GET /incidents/:id`, `POST /incidents/:id/assign`, `GET /incidents/:id/recommendations`. States: loading, loaded, unauthorized (PII-restricted fields hidden with an explicit "restricted" placeholder, not simply omitted silently), assigning (button loading), conflict-error (resource taken), resolved (read-only view).

**Resource Inventory** (`/resources`) — Purpose: manage dispatchable resources. Layout: filterable table + add/edit drawer. States: loading, loaded, empty ("no resources registered — add your first"), error, form-validation-error.

**Field Assignment List/Detail** (`/field/assignments*`) — Purpose: field team's task view. Layout: card list sorted by assignment time; detail shows AI summary + location + status-update controls (en route/on-scene/complete). States: loading, empty ("no active assignments"), loaded, updating, error.

**Analytics** (`/analytics`) — Purpose: aggregate reporting. Layout: KPI cards row + charts grid (incidents by category, response-delay trend, resource utilization, geographic heatmap). States: loading, loaded, empty (no data in range), error. Personal-safety data always pre-aggregated server-side — frontend never receives identifying fields here (defense in depth alongside SEC-011).

**Alerts Center** (`/alerts`) — Purpose: manage active/acknowledged alerts. Layout: list grouped by type, acknowledge action inline. States: loading, empty ("no active alerts" — positive state), loaded, acknowledging.

**User Management** (`/settings/users`) — Admin only. Standard table + role-assignment form. States: loading, loaded, empty, error, validation-error.

---

## 4. Component System

| Component | Purpose | Variants | States | A11y | Responsive |
|---|---|---|---|---|---|
| **AppShell** | Layout wrapper | citizen (minimal), operator (full nav) | — | Landmark regions | Sidebar collapses to bottom nav on mobile (operator only) |
| **Navbar/Sidebar** | Navigation | role-conditional items | active/inactive/disabled | Keyboard-navigable, `aria-current` | Sidebar → drawer on tablet/mobile |
| **Button** | Actions | primary/secondary/destructive/ghost | default/hover/active/loading/disabled | Focus ring, `aria-busy` on loading | Full-width on mobile forms |
| **Input / Select** | Form fields | text/textarea/select/file | default/focus/error/disabled | `label for`, `aria-describedby` for errors | Stack full-width <640px |
| **PriorityBadge** | Show incident priority | low/medium/high/critical/SOS | static | Icon+text, never color-only | — |
| **Card** | Content container | default/interactive(hover) | default/hover/selected | — | Reflows to full-width on mobile |
| **Table** | Tabular data (resources, users) | — | loading(skeleton)/empty/loaded | Scoped headers, keyboard row focus | Horizontal scroll container, never page-level scroll |
| **Modal / Drawer** | Focused task (add resource, merge confirm) | modal(center)/drawer(side) | opening/open/closing | Focus trap, `Esc` closes, returns focus on close | Modal → full-screen sheet on mobile |
| **Toast** | Transient feedback | success/error/info | entering/visible/exiting | `role="status"` / `role="alert"` for errors | — |
| **AlertBanner** | Persistent system alert | critical/warning/info | active/acknowledged | `aria-live="assertive"` for critical | Sticky top on all viewports |
| **Map** | Geospatial visualization | dashboard(full)/picker(form) | loading/loaded/error | Keyboard-alternative list view provided (map is supplementary, never the only way to see data) | Full-bleed mobile, inset desktop |
| **SOSButton** | Panic trigger | default/confirming | idle/pressed/confirming/sent | Min 64px touch target, high contrast, single unambiguous label | Always thumb-reachable zone |
| **AISummaryPanel** | Display AI text | — | loading/loaded/fallback-used | Clearly labeled "AI-generated", editable | — |
| **SkeletonLoader** | Loading placeholder | card/table/map | — | `aria-hidden`, paired with `aria-busy` on container | — |
| **EmptyState** | No-data messaging | per-screen copy | — | Descriptive, not just an icon | — |
| **ErrorState** | Failure messaging | inline/full-panel | — | Retry action always present | — |
| **ConfirmationDialog** | Destructive/critical confirm (merge, override, resolve) | — | open/confirming | Focus-trapped, explicit consequence text | Full-screen on mobile |
| **Pagination** | List navigation | — | default/disabled-edges | Keyboard operable | Simplified (prev/next only) on mobile |

Components are not created speculatively — this list is exactly what the 12 screens above require; no additional components (e.g., no carousel, no complex date-range picker beyond a simple range input) are introduced without a screen requirement.

---

## 5. Screen-by-Screen Layout Flow (example — Incident Detail)

Header (category icon, priority badge, SOS flag if applicable, status pill)
↓
AI Summary Panel (accent-bordered, labeled, editable textarea)
↓
Classification Detail (severity score, confidence, category, source)
↓
Recommendation List (ranked cards, each: resource name/type/distance/reason, Accept/Override buttons)
↓
Assignment Panel (current assignment status, field-team contact, status timeline)
↓
Merge/Duplicate History (linked source reports, if any)
↓
Notes / Activity Log (audit-visible actions)

Dashboard flow: AlertBanner (sticky) → [Queue Panel | Map Panel] side-by-side desktop / stacked mobile → Incident Detail opens as a right-side drawer over the dashboard (desktop) or full-screen push (mobile), preserving dashboard context on close.

---

## 6. UX States

Every interactive screen implements: initial, loading, success, empty, error, disabled, processing, partially-loaded, unauthorized, expired-session. Concretely: **expired session** → any 401 response triggers a global interceptor that shows a non-destructive "session expired" modal preserving unsaved form state where possible, then redirects to `/login` with return-path. **unauthorized** → 403 responses render an explicit "you don't have access to this" panel, never a blank/broken layout. **partially-loaded** → dashboard's queue and map panels load and error independently (one failing does not block the other).

## 7. Responsive Design Rules

**Desktop (>1024px):** Full sidebar nav, dashboard map+queue side-by-side, incident detail as a right-side drawer, tables show all columns.
**Tablet (640–1024px):** Sidebar collapses to icon-only (expandable), dashboard map+queue stacked with a toggle tab, tables horizontally scrollable within their container.
**Mobile (<640px):** Sidebar → bottom navigation bar (operator role) or hidden entirely (citizen role, which has no nav), dashboard defaults to queue view with a "Map" toggle button (not both simultaneously — avoids cramming), incident detail becomes a full-screen push view, modals become full-screen sheets, tables collapse to stacked card rows (label:value pairs) rather than horizontal scroll for the Resource/User management screens specifically (better mobile usability than a table).

## 8. UX Rules

**Forms:** inline validation on blur, submit button disabled until required fields valid, server errors mapped back to specific fields where possible. **Destructive actions** (merge override, resolve, deactivate resource, un-merge): always behind ConfirmationDialog with explicit consequence text ("This will reassign 2 field teams"). **Navigation:** protected-route guard redirects preserve intended destination. **Feedback:** every mutating action shows a toast (success/error); long-running actions (assignment) show inline button-loading, not a page-level spinner. **Notifications:** bell icon badge count, dropdown list, mark-as-read on view. **Errors:** field-level for validation, toast for action failures, full-panel ErrorState for page-load failures — never a raw error string exposed to the user. **Search/filtering:** incident queue filterable by category/priority/status, debounced 300ms. **Pagination:** cursor/offset with visible page indicator, default 25/page. **Data density:** dispatcher screens favor density (compact rows); citizen screens favor whitespace and large touch targets. **Empty states:** always actionable ("No resources yet — Add your first") rather than a bare "No data."

## 9. Frontend Technical Rules

**Folder structure:**
```
src/
  app/                # Next.js app router pages per route
  components/
    ui/                # Button, Input, Card, Modal, Toast, Badge...
    domain/            # IncidentCard, PriorityBadge, SOSButton, MapView, AISummaryPanel...
    layout/            # AppShell, Navbar, Sidebar
  hooks/               # useIncidents, useWebSocket, useAuth
  lib/
    api/               # typed API client functions per resource
    ws/                # WebSocket connection manager
    validation/        # zod/yup schemas shared with form components
  state/               # global state (auth, dashboard live-state)
  types/               # shared TS types mirroring backend API contract
  utils/
  styles/
```
**Component architecture:** Presentational `ui/` components are stateless/prop-driven; `domain/` components own their data-fetch via hooks; pages compose domain components.
**State management:** Server-state via React Query (caching, refetch, mutation states) — never hand-rolled fetch+useState for data that needs caching. Local/global client UI state (auth session, dashboard filter selections) via lightweight context/Zustand — Redux not justified at this scale.
**API client:** Single typed fetch wrapper (`lib/api`) handling base URL, auth header injection, 401 interceptor (Section 6), consistent error unwrapping from the backend's standard response envelope.
**Request handling/caching:** React Query with per-resource cache keys; incident list invalidated on relevant WS events rather than polled.
**Form handling/validation:** React Hook Form + Zod schemas shared (where feasible) with backend validation shape, to keep client/server rules from drifting.
**Error boundaries:** Top-level boundary per route segment; map/WebSocket failures isolated so one panel's crash doesn't blank the whole dashboard.
**Route protection:** Middleware/HOC checks role from decoded JWT before rendering protected routes; server-side check still authoritative (frontend gate is UX only, never the security boundary — SEC-002 enforced backend-side).
**Environment variables:** `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_MAP_TILE_URL` — no secrets in frontend env.
**Typing:** TypeScript strict mode; API response types generated/maintained to mirror `03_BACKEND_ARCHITECTURE.md` §5 contract exactly.
**Code conventions:** ESLint + Prettier enforced; no inline business logic in `ui/` components; no hardcoded copy for error/empty states (centralized message constants) to keep tone consistent, especially for SOS/critical-path screens.

---

## 10. UI Component Primitives & Design Tokens (Phase 16)

The design system incorporates Radix UI headless accessible primitives styled with Tailwind CSS tokens and custom keyframe animations:

| Component | File | Radix Primitive / Source | Usage & Behavior |
|---|---|---|---|
| `Skeleton` | `src/components/ui/Skeleton.tsx` | Native + CSS keyframe | Shimmer placeholder (`@keyframes shimmer`) with moving linear gradient (`#e2e8f0` → `#f1f5f9` → `#e2e8f0`) during loading states for queue cards, alert items, and resource lists. |
| `ScrollArea` | `src/components/ui/ScrollArea.tsx` | `@radix-ui/react-scroll-area` | Cross-browser scroll container with invisible/slim custom scrollbars. Supports `withFade` and `fadeBoth` props which apply `.scroll-fade-viewport` directly to `ScrollAreaPrimitive.Viewport` via CSS `mask-image` (`linear-gradient(to bottom, black calc(100% - 44px), transparent 100%)`). Content smoothly fades out inside the active scrolling container without overlapping native scrollbars or hardcoding solid background colors. |
| `Toast` / `useToast` | `src/components/ui/Toast.tsx` | `@radix-ui/react-toast` | Non-blocking status notifications (success, error, info) mounted globally at `OperatorShell` root via `<ToastProvider>`. Triggered via `const { toast } = useToast()`. |
| `Tooltip` | `src/components/ui/Tooltip.tsx` | `@radix-ui/react-tooltip` | Contextual button labels for icon-only and compact action buttons (Map coordinate inspector, Open incident, Acknowledge alert, Deactivate unit). Styled with dark slate background, micro-typography, and smooth slide-in animations. |
| `HoverCard` | `src/components/ui/HoverCard.tsx` | `@radix-ui/react-hover-card` | Rich hover preview on resource titles revealing real-time unit status, operational category, precise coordinates, and availability state without navigating away. |
| `DropdownMenu` | `src/components/ui/DropdownMenu.tsx` | `@radix-ui/react-dropdown-menu` | Accessible floating action and filter menus with keyboard navigation and focus management. Features `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, and `DropdownMenuCheckboxItem` with check/radio indicator icons for dashboard filters (Category, Priority, Status) and operator profile controls. |
| `Switch` | `src/components/ui/Switch.tsx` | `@radix-ui/react-switch` | Accessible two-state toggle switch with smooth thumb transition (`translate-x-4`). Utilized for situation map layer controls (Incidents & Resources toggle) on the dispatcher dashboard. |
| `Sidebar` | `src/components/ui/Sidebar.tsx` | Shadcn Modular Sidebar Suite | Enterprise collapsible navigation layout with `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarFooter`, and `SidebarTrigger`. Includes profile settings dropdown anchored to the sidebar footer and responsive mobile slide-out sheet drawer. |
| `Chart` | `src/components/ui/Chart.tsx` | Shadcn Chart + Recharts | Styled chart container (`ChartContainer`) and custom tooltip renderer (`ChartTooltip`, `ChartTooltipContent`) supporting themed color CSS variables, dot/line indicators, and tabular value formatting for analytics status distributions and category volume bars. |
| `Popover` | `src/components/ui/Popover.tsx` | `@radix-ui/react-popover` | Lightweight floating content container with click-outside dismissal and anchor positioning. Powers `NotificationBell` quick alert preview drawer with integrated `ScrollArea` fade. |
| `Collapsible` | `src/components/ui/Collapsible.tsx` | `@radix-ui/react-collapsible` | Accordion grouping for alert categories (e.g., delayed response vs critical escalation) with animated height transitions and rotating chevron indicators. |
| `Textarea` | `src/components/ui/Textarea.tsx` | Native HTML + styled ref | Resizable, comfortable textarea with relaxed line-height and theme-compliant border/focus rings for dispatcher caller notes and field-team observation notes. |


