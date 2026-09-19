"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StatusPill } from "@/components/domain/StatusPill";
import { LocationMapDialog } from "@/components/maps/LocationMapDialog";
import { acknowledgeAlert, ApiError, listAlerts, type AlertItem } from "@/lib/api/client";
import { useAuth, withAuthRetry } from "@/lib/auth";
import { cn } from "@/lib/utils";

function AlertsPageInner() {
  const { getToken, refreshSession } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "active";
  const focusId = searchParams.get("focus");
  const [items, setItems] = useState<AlertItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const focusRef = useRef<HTMLLIElement | null>(null);

  const setStatusFilter = useCallback(
    (value: string) => {
      const qs = new URLSearchParams(searchParams.toString());
      if (value) qs.set("status", value);
      else qs.delete("status");
      const next = qs.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await withAuthRetry(getToken, refreshSession, (token) =>
        listAlerts(token, {
          status: statusFilter || undefined,
        }),
      );
      setItems(data.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [getToken, refreshSession, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusId || loading) return;
    const t = window.setTimeout(() => {
      focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [focusId, loading, items]);

  async function onAck(id: string) {
    setBusyId(id);
    try {
      await withAuthRetry(getToken, refreshSession, (token) => acknowledgeAlert(token, id));
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
    <div className="alerts-page">
      <header className="alerts-page-header">
        <div>
          <h1 className="font-display text-xl font-bold md:text-2xl">Alerts</h1>
          <p className="text-sm text-muted">Critical, delayed-response, and escalation alerts</p>
        </div>
        <div className="alerts-filter-row">
          <label className="sr-only" htmlFor="alert-status-filter">
            Alert status
          </label>
          <select
            id="alert-status-filter"
            className="field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Alert status filter"
          >
            <option value="active">Active only</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="">All statuses</option>
          </select>
        </div>
      </header>

      {error ? <p className="form-error shrink-0">{error}</p> : null}

      <div className="alerts-scroll">
        {loading ? <p className="muted">Loading…</p> : null}
        {!loading && items.length === 0 && !error ? (
          <p className="empty-state">
            {statusFilter === "active"
              ? "No active alerts — all clear."
              : "No alerts match this filter."}
          </p>
        ) : null}
        {Object.entries(byType).map(([type, group]) => (
          <section key={type} className="stack" style={{ gap: "0.75rem" }}>
            <h2 className="text-base font-bold capitalize">{type.replaceAll("_", " ")}</h2>
            <ul className="alert-list">
              {group.map((a) => (
                <li
                  key={a.id}
                  id={`alert-${a.id}`}
                  ref={focusId === a.id ? focusRef : undefined}
                  className={cn(
                    "alert-card",
                    focusId === a.id && "ring-2 ring-primary ring-offset-2",
                  )}
                >
                  <div>
                    <div className="alert-card-top">
                      <span className="alert-type-label">{a.type.replaceAll("_", " ")}</span>
                      <StatusPill status={a.status} />
                      {a.priority ? (
                        <span className={`prio prio-${a.priority}`}>{a.priority}</span>
                      ) : null}
                    </div>
                    <p className="alert-card-message">{a.message}</p>
                    <p className="alert-card-meta">
                      {new Date(a.created_at).toLocaleString()}
                      {a.tracking_ref ? ` · ${a.tracking_ref}` : null}
                      {a.category ? ` · ${a.category.replaceAll("_", " ")}` : null}
                    </p>
                  </div>
                  <div className="alert-card-actions">
                    <LocationMapDialog
                      latitude={a.location?.latitude}
                      longitude={a.location?.longitude}
                      label={a.tracking_ref ?? a.type.replaceAll("_", " ")}
                      embedded
                      details={
                        a.location ? (
                          <>
                            <p>
                              <strong>Type:</strong> {a.type.replaceAll("_", " ")}
                            </p>
                            <p>
                              <strong>Status:</strong> {a.status}
                            </p>
                            {a.priority ? (
                              <p>
                                <strong>Priority:</strong> {a.priority}
                              </p>
                            ) : null}
                            {a.category ? (
                              <p>
                                <strong>Category:</strong> {a.category.replaceAll("_", " ")}
                              </p>
                            ) : null}
                            <p className="line-clamp-3 text-muted">{a.message}</p>
                            <p className="text-xs text-muted">{new Date(a.created_at).toLocaleString()}</p>
                          </>
                        ) : undefined
                      }
                    />
                    {a.status === "active" ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === a.id}
                        onClick={() => void onAck(a.id)}
                      >
                        {busyId === a.id ? "…" : "Acknowledge"}
                      </button>
                    ) : (
                      <span className="muted text-sm">Acknowledged</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="ops-loading">Loading alerts…</div>}>
      <AlertsPageInner />
    </Suspense>
  );
}
