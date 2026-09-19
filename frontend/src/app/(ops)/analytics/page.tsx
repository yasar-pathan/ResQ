"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, getApiBaseUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

type Overview = {
  total_incidents: number;
  active: number;
  resolved: number;
  critical: number;
  personal_safety_count: number;
};

async function fetchAnalytics<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok || body.success === false) {
    throw new ApiError(res.status, body.error?.code ?? "error", body.error?.message ?? "Failed");
  }
  return body.data as T;
}

export default function AnalyticsPage() {
  const { getToken } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [categories, setCategories] = useState<Array<{ category: string; count: number }>>([]);
  const [delays, setDelays] = useState<{ assigned_count: number; avg_minutes_to_assign: number } | null>(
    null,
  );
  const [hotspots, setHotspots] = useState<Array<{ lat: number; lng: number; count: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const [o, c, d, h] = await Promise.all([
        fetchAnalytics<Overview>(token, "/analytics/overview"),
        fetchAnalytics<{ items: Array<{ category: string; count: number }> }>(
          token,
          "/analytics/incidents-by-category",
        ),
        fetchAnalytics<{ assigned_count: number; avg_minutes_to_assign: number }>(
          token,
          "/analytics/response-delays",
        ),
        fetchAnalytics<{ items: Array<{ lat: number; lng: number; count: number }> }>(
          token,
          "/analytics/hotspots",
        ),
      ]);
      setOverview(o);
      setCategories(c.items);
      setDelays(d);
      setHotspots(h.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="stack" style={{ gap: "1.5rem", maxWidth: 900 }}>
      <header>
        <h1>Analytics</h1>
        <p className="muted">Aggregate KPIs — no personal-safety identity fields</p>
      </header>
      {loading ? <p className="muted">Loading…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && !overview ? <p className="empty-state">No analytics data in range.</p> : null}
      {overview ? (
        <div className="kpi-row">
          <div className="kpi">
            <span className="muted">Total</span>
            <strong>{overview.total_incidents}</strong>
          </div>
          <div className="kpi">
            <span className="muted">Active</span>
            <strong>{overview.active}</strong>
          </div>
          <div className="kpi">
            <span className="muted">Resolved</span>
            <strong>{overview.resolved}</strong>
          </div>
          <div className="kpi">
            <span className="muted">Critical</span>
            <strong>{overview.critical}</strong>
          </div>
          <div className="kpi">
            <span className="muted">Personal safety (count only)</span>
            <strong>{overview.personal_safety_count}</strong>
          </div>
        </div>
      ) : null}
      {delays ? (
        <section>
          <h2>Response delays</h2>
          <p>
            Avg minutes to first assignment: <strong>{delays.avg_minutes_to_assign}</strong> (
            {delays.assigned_count} assigned)
          </p>
        </section>
      ) : null}
      <section>
        <h2>By category</h2>
        {categories.length === 0 ? (
          <p className="empty-state">No category data.</p>
        ) : (
          <ul className="field-list">
            {categories.map((c) => (
              <li key={c.category} className="field-card">
                <strong>{c.category.replaceAll("_", " ")}</strong>
                <span>{c.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Hotspots (anonymized buckets)</h2>
        {hotspots.length === 0 ? (
          <p className="empty-state">No hotspot data.</p>
        ) : (
          <ul className="field-list">
            {hotspots.map((h) => (
              <li key={`${h.lat}-${h.lng}`} className="field-card">
                <strong>
                  {h.lat}, {h.lng}
                </strong>
                <span>{h.count} incidents</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
