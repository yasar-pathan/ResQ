"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StatusPill } from "@/components/domain/StatusPill";
import { ClassificationReviewBadge } from "@/components/domain/ClassificationReviewBadge";
import { LocationMapDialog } from "@/components/maps/LocationMapDialog";
import { OpsMapDynamic } from "@/components/maps/OpsMapDynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { Switch } from "@/components/ui/Switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
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

const SOURCE_LABELS: Record<string, string> = {
  call: "Call",
  sensor: "Sensor",
  field_team: "Field",
  citizen_web: "Web",
  sos: "SOS",
};

function SourceChip({ source }: { source: string }) {
  return (
    <span className={`source-chip source-chip-${source}`}>
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}

type ActiveAssignment = { resource_name: string; status: string } | null;
type IncidentListItemEnriched = IncidentListItem & { active_assignment?: ActiveAssignment };

function DashboardInner() {
  const { getToken, refreshSession } = useAuth();
  const { toast } = useToast();
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
      const msg = err instanceof ApiError ? err.message : "Failed to load dashboard";
      setError(msg);
      toast({ title: "Dashboard error", description: msg, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [getToken, refreshSession, filterCategory, filterPriority, filterStatus, toast]);

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="filter-row !mt-0 flex flex-wrap gap-2">
            {/* Category Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-between gap-1.5 rounded-control border border-border bg-white px-3 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-label="Filter by Category"
                >
                  <span className="max-w-[130px] truncate">
                    {filterCategory
                      ? INCIDENT_CATEGORIES.find((c) => c.value === filterCategory)?.label ?? filterCategory
                      : "All categories"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Incident Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={filterCategory}
                  onValueChange={(val) => setFilter("category", val)}
                >
                  <DropdownMenuRadioItem value="">All categories</DropdownMenuRadioItem>
                  {INCIDENT_CATEGORIES.map((c) => (
                    <DropdownMenuRadioItem key={c.value} value={c.value}>
                      {c.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Priority Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-between gap-1.5 rounded-control border border-border bg-white px-3 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-label="Filter by Priority"
                >
                  <span className="truncate capitalize">
                    {filterPriority ? filterPriority : "All priorities"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel>Priority Level</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={filterPriority}
                  onValueChange={(val) => setFilter("priority", val)}
                >
                  <DropdownMenuRadioItem value="">All priorities</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="critical">Critical</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="high">High</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="medium">Medium</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="low">Low</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Status Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-between gap-1.5 rounded-control border border-border bg-white px-3 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-label="Filter by Status"
                >
                  <span className="truncate capitalize">
                    {filterStatus ? filterStatus.replace("_", " ") : "All statuses"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel>Incident Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={filterStatus}
                  onValueChange={(val) => setFilter("status", val)}
                >
                  <DropdownMenuRadioItem value="">All statuses</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="reported">Reported</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="classified">Classified</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="assigned">Assigned</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="in_progress">In progress</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="resolved">Resolved</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {error ? <p className="form-error shrink-0">{error}</p> : null}

      <div className="dashboard-ops-grid grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(320px,400px)_1fr]">
        <section
          className="queue-panel flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface"
          aria-label="Incident queue"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base font-bold">Queue</h2>
            {loading ? (
              <span className="text-xs text-muted">Refreshing…</span>
            ) : (
              <span className="text-xs text-muted">{incidents.length} active</span>
            )}
          </div>
          <ScrollArea className="min-h-0 flex-1" withFade>
            <ul className="queue-list list-none space-y-2 p-3">
              {loading && incidents.length === 0 ? (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-panel border border-border bg-white p-2.5 shadow-sm"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-14" />
                          <Skeleton className="h-4 w-12" />
                        </div>
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Skeleton className="h-7 w-12 rounded-control" />
                        <Skeleton className="h-7 w-12 rounded-control" />
                      </div>
                    </li>
                  ))}
                </>
              ) : null}
              {!loading && incidents.length === 0 ? (
                <li className="empty-state p-4 text-sm">No active incidents in queue — standing by.</li>
              ) : null}
              {incidents.map((inc) => {
                const enriched = inc as IncidentListItemEnriched;
                return (
                  <li
                    key={inc.id}
                    className={`flex items-center gap-2 rounded-panel border p-2.5 shadow-sm transition ${
                      selectedId === inc.id
                        ? "border-primary bg-slate-50 ring-1 ring-primary/20"
                        : "border-border bg-white"
                    }`}
                  >
                    {/* Left: clickable meta area */}
                    <button
                      type="button"
                      className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
                      onClick={() => setSelectedId(inc.id)}
                    >
                      <div className="queue-item-meta space-y-0.5">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span className={`prio prio-${inc.priority ?? "none"}`}>
                            {inc.source === "sos" ? "SOS · " : ""}
                            {inc.priority ?? "unclassified"}
                          </span>
                          <StatusPill status={inc.status} />
                          <SourceChip source={inc.source} />
                        </div>
                        <ClassificationReviewBadge confidence={inc.ai_confidence} className="w-fit" />
                        <strong className="block text-xs">{inc.tracking_ref}</strong>
                        <span className="block text-xs text-muted">
                          {inc.category.replaceAll("_", " ")}
                        </span>
                        {/* Active assignment snippet — shown when backend enriches list */}
                        {enriched.active_assignment ? (
                          <span className="block text-xs text-muted">
                            ↳ {enriched.active_assignment.resource_name}{" "}
                            <span className="capitalize">
                              ({enriched.active_assignment.status.replace("_", " ")})
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </button>
                    {/* Right: Map + Open with Tooltips — same row, right-aligned */}
                    <div className="queue-row-actions">
                      <Tooltip tip="View coordinates on map">
                        <span>
                          <LocationMapDialog
                            latitude={inc.location.latitude}
                            longitude={inc.location.longitude}
                            label={inc.tracking_ref}
                          />
                        </span>
                      </Tooltip>
                      <Tooltip tip="Open triage &amp; resource assignment">
                        <Link href={`/incidents/${inc.id}`} className="btn btn-primary btn-sm">
                          Open
                        </Link>
                      </Tooltip>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </section>

        <section
          className="map-panel flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface"
          aria-label="Situation map"
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-base font-bold">Map</h2>
            <div className="layer-toggles flex items-center gap-4 text-xs font-medium">
              <label className="inline-flex cursor-pointer items-center gap-2 text-slate-700">
                <Switch
                  checked={showIncidents}
                  onCheckedChange={setShowIncidents}
                  aria-label="Toggle Incidents layer"
                />
                <span>Incidents</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-slate-700">
                <Switch
                  checked={showResources}
                  onCheckedChange={setShowResources}
                  aria-label="Toggle Resources layer"
                />
                <span>Resources</span>
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
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <SourceChip source={selected.source} />
                    {selected.severity != null && (
                      <span className="text-xs text-muted">Severity {selected.severity}</span>
                    )}
                  </div>
                  <ClassificationReviewBadge
                    confidence={selected.ai_confidence}
                    className="mt-1 w-fit"
                  />
                  <p className="mt-1 line-clamp-2 text-sm">
                    {selected.ai_summary || selected.description?.slice(0, 160)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip tip="View incident coordinates on map">
                    <span>
                      <LocationMapDialog
                        latitude={selected.location.latitude}
                        longitude={selected.location.longitude}
                        label={selected.tracking_ref}
                      />
                    </span>
                  </Tooltip>
                  <Tooltip tip="Open full triage and resource assignment">
                    <Link href={`/incidents/${selected.id}`} className="btn btn-primary btn-sm">
                      Triage &amp; assign
                    </Link>
                  </Tooltip>
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
