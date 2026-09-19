"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StatusPill } from "@/components/domain/StatusPill";
import { ClassificationReviewBadge } from "@/components/domain/ClassificationReviewBadge";
import { LocationMapDialog } from "@/components/maps/LocationMapDialog";
import { OpsMapDynamic } from "@/components/maps/OpsMapDynamic";
import {
  ApiError,
  dashboardWsUrl,
  listIncidents,
  listResources,
  type IncidentListItem,
  type ResourceItem,
} from "@/lib/api/client";
import { useAuth, withAuthRetry } from "@/lib/auth";
import { INCIDENT_CATEGORIES } from "@/lib/reportValidation";

function priorityRank(p: string | null | undefined): number {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return order[p ?? ""] ?? 9;
}

function sortQueue(items: IncidentListItem[]): IncidentListItem[] {
  return [...items].sort((a, b) => {
    const sosA = a.source === "sos" ? 0 : 1;
    const sosB = b.source === "sos" ? 0 : 1;
    if (sosA !== sosB) return sosA - sosB;
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    return a.created_at.localeCompare(b.created_at);
  });
}

function DashboardInner() {
  const { getToken, refreshSession } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterCategory = searchParams.get("category") ?? "";
  const filterPriority = searchParams.get("priority") ?? "";
  const filterStatus = searchParams.get("status") ?? "";
  const selectedId = searchParams.get("selected");

  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsState, setWsState] = useState<"connecting" | "live" | "degraded">("connecting");
  const [showIncidents, setShowIncidents] = useState(true);
  const [showResources, setShowResources] = useState(true);

  const patchParams = useCallback(
    (mutate: (qs: URLSearchParams) => void) => {
      const qs = new URLSearchParams(searchParams.toString());
      mutate(qs);
      const next = qs.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setFilter = (key: "category" | "priority" | "status", value: string) => {
    patchParams((qs) => {
      if (value) qs.set(key, value);
      else qs.delete(key);
    });
  };

  const setSelectedId = (id: string | null) => {
    patchParams((qs) => {
      if (id) qs.set("selected", id);
      else qs.delete("selected");
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [incData, resData] = await withAuthRetry(getToken, refreshSession, async (token) => {
        const [incidentsRes, resourcesRes] = await Promise.all([
          listIncidents(token, {
            limit: 50,
            category: filterCategory || undefined,
            priority: filterPriority || undefined,
            status: filterStatus || undefined,
          }),
          listResources(token),
        ]);
        return [incidentsRes, resourcesRes] as const;
      });
      setIncidents(sortQueue(incData.items));
      setResources(resData.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [getToken, refreshSession, filterCategory, filterPriority, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (closed) return;
      setWsState("connecting");
      ws = new WebSocket(dashboardWsUrl(token!));
      ws.onopen = () => setWsState("live");
      ws.onmessage = () => {
        void load();
      };
      ws.onerror = () => setWsState("degraded");
      ws.onclose = () => {
        setWsState("degraded");
        retry = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [getToken, load]);

  const selected = useMemo(
    () => incidents.find((i) => i.id === selectedId) ?? null,
    [incidents, selectedId],
  );

  return (
    <div className="dashboard-ops flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {wsState === "degraded" ? (
        <div className="ws-banner shrink-0" role="status">
          Live connection lost — reconnecting. Showing last REST snapshot.
        </div>
      ) : null}

      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 md:text-2xl">Live ops</h1>
          <p className="text-sm text-muted">
            {wsState === "live" ? "Live" : wsState === "connecting" ? "Connecting…" : "Degraded"} ·{" "}
            {incidents.length} in queue
          </p>
        </div>
        <div className="filter-row !mt-0 flex flex-wrap gap-2">
          <select
            className="field"
            value={filterCategory}
            onChange={(e) => setFilter("category", e.target.value)}
            aria-label="Filter category"
          >
            <option value="">All categories</option>
            {INCIDENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={filterPriority}
            onChange={(e) => setFilter("priority", e.target.value)}
            aria-label="Filter priority"
          >
            <option value="">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            className="field"
            value={filterStatus}
            onChange={(e) => setFilter("status", e.target.value)}
            aria-label="Filter status"
          >
            <option value="">All statuses</option>
            <option value="reported">Reported</option>
            <option value="classified">Classified</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </header>

      {error ? <p className="form-error shrink-0">{error}</p> : null}

      <div className="dashboard-ops-grid grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <section
          className="queue-panel flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface"
          aria-label="Incident queue"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base font-bold">Queue</h2>
            {loading ? <span className="text-xs text-muted">Loading…</span> : null}
          </div>
          <ul className="queue-list min-h-0 flex-1 list-none space-y-2 overflow-y-auto p-3">
            {!loading && incidents.length === 0 ? (
              <li className="empty-state p-4 text-sm">No active incidents in queue — standing by.</li>
            ) : null}
            {incidents.map((inc) => (
              <li
                key={inc.id}
                className={`rounded-panel border p-3 transition ${
                  selectedId === inc.id ? "border-primary bg-slate-50" : "border-border bg-white"
                }`}
              >
                <button
                  type="button"
                  className="w-full cursor-pointer border-0 bg-transparent p-0 text-left"
                  onClick={() => setSelectedId(inc.id)}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`prio prio-${inc.priority ?? "none"}`}>
                      {inc.source === "sos" ? "SOS · " : ""}
                      {inc.priority ?? "unclassified"}
                    </span>
                    <StatusPill status={inc.status} />
                    <ClassificationReviewBadge confidence={inc.ai_confidence} />
                  </div>
                  <strong className="block text-sm">{inc.tracking_ref}</strong>
                  <span className="text-sm text-muted">{inc.category.replaceAll("_", " ")}</span>
                </button>
                <div className="mt-3 flex items-center gap-2">
                  <LocationMapDialog
                    latitude={inc.location.latitude}
                    longitude={inc.location.longitude}
                    label={inc.tracking_ref}
                  />
                  <Link href={`/incidents/${inc.id}`} className="btn btn-primary btn-sm">
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="map-panel flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface"
          aria-label="Situation map"
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-base font-bold">Map</h2>
            <div className="layer-toggles flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showIncidents}
                  onChange={(e) => setShowIncidents(e.target.checked)}
                />
                Incidents
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showResources}
                  onChange={(e) => setShowResources(e.target.checked)}
                />
                Resources
              </label>
            </div>
          </div>
          <div className="relative min-h-[45dvh] flex-1 lg:min-h-0">
            <OpsMapDynamic
              incidents={incidents}
              resources={resources}
              showIncidents={showIncidents}
              showResources={showResources}
              selectedId={selectedId}
              onSelectIncident={setSelectedId}
              height="100%"
              className="absolute inset-0 rounded-none border-0"
            />
          </div>
          {selected ? (
            <div className="map-drawer shrink-0 border-t border-border bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{selected.tracking_ref}</h3>
                  <p className="text-sm text-muted">
                    {selected.category.replaceAll("_", " ")} · {selected.priority ?? "—"}
                  </p>
                  <ClassificationReviewBadge confidence={selected.ai_confidence} />
                  <p className="mt-1 line-clamp-2 text-sm">
                    {selected.ai_summary || selected.description?.slice(0, 160)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <LocationMapDialog
                    latitude={selected.location.latitude}
                    longitude={selected.location.longitude}
                    label={selected.tracking_ref}
                  />
                  <Link href={`/incidents/${selected.id}`} className="btn btn-primary btn-sm">
                    Triage & assign
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="ops-loading">Loading dashboard…</div>}>
      <DashboardInner />
    </Suspense>
  );
}
