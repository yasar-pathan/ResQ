"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/domain/StatusPill";
import {
  ApiError,
  dashboardWsUrl,
  listAlerts,
  listIncidents,
  listResources,
  type AlertItem,
  type IncidentListItem,
  type ResourceItem,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

function priorityRank(p: string | null | undefined): number {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return order[p ?? ""] ?? 9;
}

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - 77.5) / 0.2) * 100;
  const y = (1 - (lat - 12.9) / 0.15) * 100;
  return {
    x: Math.min(95, Math.max(5, x)),
    y: Math.min(95, Math.max(5, y)),
  };
}

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [wsState, setWsState] = useState<"connecting" | "live" | "degraded">("connecting");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showIncidents, setShowIncidents] = useState(true);
  const [showResources, setShowResources] = useState(true);

  const loadQueue = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setQueueLoading(true);
    try {
      const data = await listIncidents(token, {
        limit: 50,
        category: filterCategory || undefined,
        priority: filterPriority || undefined,
        status: filterStatus || undefined,
      });
      const sorted = [...data.items].sort((a, b) => {
        const sosA = a.source === "sos" ? 0 : 1;
        const sosB = b.source === "sos" ? 0 : 1;
        if (sosA !== sosB) return sosA - sosB;
        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;
        return a.created_at.localeCompare(b.created_at);
      });
      setIncidents(sorted);
      setQueueError(null);
    } catch (err) {
      setQueueError(err instanceof ApiError ? err.message : "Failed to load queue");
    } finally {
      setQueueLoading(false);
    }
  }, [getToken, filterCategory, filterPriority, filterStatus]);

  const loadMap = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setMapLoading(true);
    try {
      const [incData, resData] = await Promise.all([
        listIncidents(token, { limit: 50 }),
        listResources(token),
      ]);
      if (!filterCategory && !filterPriority && !filterStatus) {
        setIncidents((prev) => (prev.length ? prev : incData.items));
      }
      setResources(resData.items);
      setMapError(null);
    } catch (err) {
      setMapError(err instanceof ApiError ? err.message : "Failed to load map layers");
    } finally {
      setMapLoading(false);
    }
  }, [getToken, filterCategory, filterPriority, filterStatus]);

  const refresh = useCallback(async () => {
    await Promise.all([loadQueue(), loadMap()]);
    const token = getToken();
    if (!token) return;
    try {
      const a = await listAlerts(token, { status: "active" });
      setAlerts(a.items);
    } catch {
      /* optional */
    }
  }, [loadQueue, loadMap, getToken]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    void loadMap();
  }, [loadMap]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      setWsState("connecting");
      ws = new WebSocket(dashboardWsUrl(token!));
      ws.onopen = () => setWsState("live");
      ws.onmessage = () => {
        void refresh();
      };
      ws.onclose = () => {
        setWsState("degraded");
        if (!closed) retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws?.close();
    }
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [getToken, refresh]);

  const selected = useMemo(
    () => incidents.find((i) => i.id === selectedId) ?? null,
    [incidents, selectedId],
  );

  return (
    <div className="dashboard">
      {wsState === "degraded" ? (
        <div className="ws-banner" role="status">
          Live connection lost — reconnecting. Showing last REST snapshot.
        </div>
      ) : null}
      {alerts.length > 0 ? (
        <div className="alert-strip" role="region" aria-label="Active alerts">
          {alerts.slice(0, 5).map((a) => (
            <div key={a.id} className="alert-chip">
              <strong>{a.type.replaceAll("_", " ")}</strong>
              <span>{a.message}</span>
              <Link href="/alerts">Open</Link>
            </div>
          ))}
        </div>
      ) : null}

      <header className="dashboard-header">
        <h1>Live ops</h1>
        <p className="muted">
          {wsState === "live" ? "Live" : wsState === "connecting" ? "Connecting…" : "Degraded"} ·{" "}
          {incidents.length} in queue
        </p>
      </header>

      <div className="filter-row">
        <select
          className="field"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          aria-label="Filter category"
        >
          <option value="">All categories</option>
          <option value="fire">Fire</option>
          <option value="flood">Flood</option>
          <option value="medical">Medical</option>
          <option value="personal_safety">Personal safety</option>
          <option value="road_incident">Road</option>
          <option value="other">Other</option>
        </select>
        <select
          className="field"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
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
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter status"
        >
          <option value="">All statuses</option>
          <option value="reported">Reported</option>
          <option value="classified">Classified</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In progress</option>
        </select>
      </div>

      <div className="dashboard-grid">
        <section className="queue-panel" aria-label="Incident queue">
          <h2>Queue</h2>
          {queueLoading ? <p className="muted">Loading queue…</p> : null}
          {queueError ? <p className="form-error">{queueError}</p> : null}
          {!queueLoading && !queueError && incidents.length === 0 ? (
            <p className="empty-state">No active incidents in queue — standing by.</p>
          ) : null}
          <ul className="queue-list">
            {incidents.map((inc) => (
              <li key={inc.id}>
                <button
                  type="button"
                  className={selectedId === inc.id ? "queue-item active" : "queue-item"}
                  onClick={() => setSelectedId(inc.id)}
                >
                  <div className="queue-item-top">
                    <span className={`prio prio-${inc.priority ?? "none"}`}>
                      {inc.source === "sos" ? "SOS · " : ""}
                      {inc.priority ?? "unclassified"}
                    </span>
                    <StatusPill status={inc.status} />
                  </div>
                  <strong>{inc.tracking_ref}</strong>
                  <span className="muted">{inc.category.replaceAll("_", " ")}</span>
                </button>
                <Link className="queue-detail-link" href={`/incidents/${inc.id}`}>
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="map-panel" aria-label="Situation map">
          <h2>Map</h2>
          <div className="layer-toggles">
            <label>
              <input
                type="checkbox"
                checked={showIncidents}
                onChange={(e) => setShowIncidents(e.target.checked)}
              />{" "}
              Incidents
            </label>
            <label>
              <input
                type="checkbox"
                checked={showResources}
                onChange={(e) => setShowResources(e.target.checked)}
              />{" "}
              Resources
            </label>
          </div>
          {mapLoading ? <p className="muted">Loading map…</p> : null}
          {mapError ? <p className="form-error">{mapError}</p> : null}
          {!mapLoading && !mapError && incidents.length === 0 && resources.length === 0 ? (
            <p className="empty-state">Map clear — no plotted items.</p>
          ) : null}
          <div className="map-canvas" role="img" aria-label="Incident and resource locations">
            {showIncidents
              ? incidents.map((inc) => {
                  const { x, y } = project(inc.location.latitude, inc.location.longitude);
                  return (
                    <button
                      key={inc.id}
                      type="button"
                      className={`map-pin ${selectedId === inc.id ? "selected" : ""} prio-${inc.priority ?? "none"}`}
                      style={{ left: `${x}%`, top: `${y}%` }}
                      title={inc.tracking_ref}
                      onClick={() => setSelectedId(inc.id)}
                    />
                  );
                })
              : null}
            {showResources
              ? resources.map((r) => {
                  const { x, y } = project(r.location.latitude, r.location.longitude);
                  return (
                    <span
                      key={r.id}
                      className={`map-pin resource-pin status-${r.status}`}
                      style={{ left: `${x}%`, top: `${y}%` }}
                      title={r.name}
                    />
                  );
                })
              : null}
          </div>
          {selected ? (
            <div className="map-drawer">
              <h3>{selected.tracking_ref}</h3>
              <p className="muted">
                {selected.category} · {selected.priority ?? "—"}
              </p>
              <p>{selected.ai_summary || selected.description?.slice(0, 160)}</p>
              <Link className="btn btn-primary" href={`/incidents/${selected.id}`}>
                Triage & assign
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
