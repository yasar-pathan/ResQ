"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/Chart";
import { HotspotsMapDynamic } from "@/components/maps/HotspotsMapDynamic";
import { ApiError, getApiBaseUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

type Overview = {
  total_incidents: number;
  active: number;
  resolved: number;
  critical: number;
  personal_safety_count: number;
};

const CHART_COLORS = {
  active: "#0369a1",
  resolved: "#15803d",
  critical: "#dc2626",
  other: "#64748b",
  bars: ["#1e3a8a", "#0f766e", "#b45309", "#0369a1", "#7c3aed", "#15803d", "#dc2626"],
};

const STATUS_CHART_CONFIG: ChartConfig = {
  Active: {
    label: "Active",
    color: "#0369a1",
  },
  Resolved: {
    label: "Resolved",
    color: "#15803d",
  },
  Critical: {
    label: "Critical",
    color: "#dc2626",
  },
  Other: {
    label: "Other",
    color: "#64748b",
  },
};

const CATEGORY_CHART_CONFIG: ChartConfig = {
  count: {
    label: "Incidents",
    color: "#1e3a8a",
  },
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
  const { getToken, loading: authLoading } = useAuth();
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
    if (!token) {
      setLoading(false);
      return;
    }
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
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const statusPie = useMemo(() => {
    if (!overview) return [];
    const other = Math.max(
      0,
      overview.total_incidents - overview.active - overview.resolved - overview.critical,
    );
    return [
      { name: "Active", value: overview.active, color: CHART_COLORS.active },
      { name: "Resolved", value: overview.resolved, color: CHART_COLORS.resolved },
      { name: "Critical", value: overview.critical, color: CHART_COLORS.critical },
      { name: "Other", value: other, color: CHART_COLORS.other },
    ].filter((d) => d.value > 0);
  }, [overview]);

  const categoryBars = useMemo(
    () =>
      categories.map((c) => ({
        name: c.category.replaceAll("_", " "),
        count: c.count,
      })),
    [categories],
  );

  return (
    <div className="stack h-full min-h-0 overflow-y-auto" style={{ gap: "1.5rem", width: "100%" }}>
      <header>
        <h1 className="font-display text-xl font-bold md:text-2xl">Analytics</h1>
        <p className="text-sm text-muted">Aggregate KPIs — no personal-safety identity fields</p>
      </header>
      {loading || authLoading ? <p className="muted">Loading…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && !authLoading && !overview && !error ? (
        <p className="empty-state">No analytics data in range.</p>
      ) : null}

      {overview ? (
        <>
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

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-panel border border-border bg-surface p-4">
              <h2 className="mb-3 text-base font-bold">Status distribution</h2>
              {statusPie.length === 0 ? (
                <p className="empty-state">No status slices yet.</p>
              ) : (
                <div className="h-72 w-full">
                  <ChartContainer
                    config={STATUS_CHART_CONFIG}
                    className="mx-auto h-full w-full aspect-auto"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Pie
                        data={statusPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="42%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {statusPie.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                </div>
              )}
            </section>

            <section className="rounded-panel border border-border bg-surface p-4">
              <h2 className="mb-3 text-base font-bold">Response delays</h2>
              {delays ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm text-muted">Avg minutes to first assignment</p>
                  <p className="font-display text-5xl font-bold text-slate-900">
                    {delays.avg_minutes_to_assign}
                  </p>
                  <p className="text-sm text-muted">{delays.assigned_count} assigned incidents</p>
                </div>
              ) : (
                <p className="empty-state">No delay metrics.</p>
              )}
            </section>
          </div>
        </>
      ) : null}

      <section className="rounded-panel border border-border bg-surface p-4">
        <h2 className="mb-3 text-base font-bold">By category</h2>
        {categoryBars.length === 0 ? (
          <p className="empty-state">No category data.</p>
        ) : (
          <div className="h-80 w-full">
            <ChartContainer
              config={CATEGORY_CHART_CONFIG}
              className="h-full w-full aspect-auto"
            >
              <BarChart data={categoryBars} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={60} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <ChartTooltip
                  cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {categoryBars.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS.bars[i % CHART_COLORS.bars.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </section>

      <section className="rounded-panel border border-border bg-surface p-4">
        <h2 className="mb-1 text-base font-bold">Hotspots (anonymized buckets)</h2>
        <p className="mb-3 text-sm text-muted">Incident density across India — no personal identifiers.</p>
        {hotspots.length === 0 ? (
          <p className="empty-state">No hotspot data.</p>
        ) : (
          <div className="min-h-[420px]">
            <HotspotsMapDynamic points={hotspots} height={420} />
          </div>
        )}
      </section>
    </div>
  );
}
