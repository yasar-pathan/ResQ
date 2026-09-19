"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/domain/StatusPill";
import { acknowledgeAlert, ApiError, listAlerts, type AlertItem } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

export default function AlertsPage() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<AlertItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = await listAlerts(token, {
        status: statusFilter || undefined,
      });
      setItems(data.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [getToken, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAck(id: string) {
    const token = getToken();
    if (!token) return;
    setBusyId(id);
    try {
      await acknowledgeAlert(token, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Acknowledge failed");
    } finally {
      setBusyId(null);
    }
  }

  const byType = items.reduce<Record<string, AlertItem[]>>((acc, a) => {
    (acc[a.type] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="stack" style={{ gap: "1.5rem", maxWidth: 800 }}>
      <header>
        <h1>Alerts</h1>
        <p className="muted">Critical, delayed-response, and escalation alerts</p>
      </header>
      <select
        className="field"
        style={{ maxWidth: 220 }}
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        aria-label="Alert status filter"
      >
        <option value="active">Active only</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="">All statuses</option>
      </select>
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && items.length === 0 && !error ? (
        <p className="empty-state">
          {statusFilter === "active"
            ? "No active alerts — all clear."
            : "No alerts match this filter."}
        </p>
      ) : null}
      {Object.entries(byType).map(([type, group]) => (
        <section key={type} className="stack">
          <h2>{type.replaceAll("_", " ")}</h2>
          <ul className="alert-list">
            {group.map((a) => (
              <li key={a.id} className="alert-row">
                <div>
                  <StatusPill status={a.status} />
                  <p>{a.message}</p>
                  <p className="muted">{new Date(a.created_at).toLocaleString()}</p>
                </div>
                {a.status === "active" ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === a.id}
                    onClick={() => void onAck(a.id)}
                  >
                    Acknowledge
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
