"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/domain/StatusPill";
import {
  ApiError,
  dashboardWsUrl,
  listAlerts,
  listIncidents,
  type AlertItem,
  type IncidentListItem,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

function priorityRank(p: string | null): number {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return order[p ?? ""] ?? 9;
}

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [wsState, setWsState] = useState<"connecting" | "live" | "degraded">("connecting");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await listIncidents(token, { limit: 50 });
      const sorted = [...data.items].sort((a, b) => {
        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;
        return a.created_at.localeCompare(b.created_at);
      });
      setIncidents(sorted);
      setQueueError(null);
    } catch (err) {
      setQueueError(err instanceof ApiError ? err.message : "Failed to load queue");
    }
    try {
      const a = await listAlerts(token, { status: "active" });
      setAlerts(a.items);
    } catch {
      /* banner optional */
    }
    setMapReady(true);
  }, [getToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const selected = incidents.find((i) => i.id === selectedId) ?? null;

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
          {incidents.length} incidents in queue
        </p>
      </header>

      <div className="dashboard-grid">
        <section className="queue-panel" aria-label="Incident queue">
          <h2>Queue</h2>
          {queueError ? <p className="form-error">{queueError}</p> : null}
          {!queueError && incidents.length === 0 ? (
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
          {!mapReady ? <p className="muted">Loading map…</p> : null}
          {mapReady && incidents.length === 0 ? (
            <p className="empty-state">Map clear — no plotted incidents.</p>
          ) : null}
          <div className="map-canvas" role="img" aria-label="Incident locations">
            {incidents.map((inc) => {
              const x = ((inc.location.longitude - 77.5) / 0.2) * 100;
              const y = (1 - (inc.location.latitude - 12.9) / 0.15) * 100;
              return (
                <button
                  key={inc.id}
                  type="button"
                  className={`map-pin ${selectedId === inc.id ? "selected" : ""} prio-${inc.priority ?? "none"}`}
                  style={{ left: `${Math.min(95, Math.max(5, x))}%`, top: `${Math.min(95, Math.max(5, y))}%` }}
                  title={inc.tracking_ref}
                  onClick={() => setSelectedId(inc.id)}
                />
              );
            })}
          </div>
          {selected ? (
            <div className="map-drawer">
              <h3>{selected.tracking_ref}</h3>
              <p className="muted">{selected.category} · {selected.priority ?? "—"}</p>
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
