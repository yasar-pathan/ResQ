"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Flame,
  Radio,
  Shield,
  ShieldAlert,
  Timer,
  Zap,
} from "lucide-react";
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
import { ScrollArea } from "@/components/ui/ScrollArea";
import { HotspotsMapDynamic } from "@/components/maps/HotspotsMapDynamic";
import { ApiError, getApiBaseUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Overview = {
  total_incidents: number;
  pending_triage?: number;
  active: number;
  resolved: number;
  merged?: number;
  critical: number;
  personal_safety_count: number;
};

type DelayMetrics = {
  assigned_count: number;
  avg_minutes_to_assign: number;
  median_minutes_to_assign?: number;
};

const CHART_COLORS = {
  pending: "#f59e0b",
  active: "#2563eb",
  resolved: "#10b981",
  merged: "#64748b",
  bars: [
    "#2563eb",
    "#0d9488",
    "#d97706",
    "#7c3aed",
    "#e11d48",
    "#059669",
    "#475569",
  ],
};

const STATUS_CHART_CONFIG: ChartConfig = {
  "Pending Triage": {
    label: "Pending Triage",
    color: "#f59e0b",
  },
  "Active Dispatched": {
    label: "Active Dispatched",
    color: "#2563eb",
  },
  "Resolved / Closed": {
    label: "Resolved",
    color: "#10b981",
  },
  "Merged Duplicate": {
    label: "Merged",
    color: "#64748b",
  },
};

const CATEGORY_CHART_CONFIG: ChartConfig = {
  count: {
    label: "Incidents",
    color: "#2563eb",
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
  const [delays, setDelays] = useState<DelayMetrics | null>(null);
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
        fetchAnalytics<DelayMetrics>(token, "/analytics/response-delays"),
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
    const pending =
      overview.pending_triage ??
      Math.max(0, overview.total_incidents - overview.active - overview.resolved);
    const merged = overview.merged ?? 0;

    return [
      { name: "Pending Triage", value: pending, color: CHART_COLORS.pending },
      { name: "Active Dispatched", value: overview.active, color: CHART_COLORS.active },
      { name: "Resolved / Closed", value: overview.resolved, color: CHART_COLORS.resolved },
      { name: "Merged Duplicate", value: merged, color: CHART_COLORS.merged },
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
    <ScrollArea className="h-full min-h-0 flex-1" withFade type="always" hideScrollbar={false}>
      <div className="space-y-6 p-2 pr-4 pb-16 max-w-7xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 md:text-2xl">
              Operational Analytics
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Live disaster coordination KPIs · Response telemetry & regional incident distribution
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            >
              Refresh
            </button>
          </div>
        </header>

        {loading || authLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-white p-4 border border-slate-100 shadow-2xs animate-pulse" />
            ))}
          </div>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}

        {!loading && !authLoading && !overview && !error ? (
          <p className="empty-state">No analytics data in range.</p>
        ) : null}

        {overview ? (
          <>
            {/* Modern Metric Cards Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {/* Total Incidents */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Total Intake</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <Activity className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <span className="font-display text-2xl font-extrabold text-slate-900 tracking-tight">
                    {overview.total_incidents}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">All logged reports</p>
                </div>
              </div>

              {/* Pending Triage */}
              <div className="flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-amber-50/20 p-4 shadow-xs transition hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-800">Pending Triage</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 border border-amber-200">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <span className="font-display text-2xl font-extrabold text-amber-900 tracking-tight">
                    {overview.pending_triage ?? Math.max(0, overview.total_incidents - overview.active - overview.resolved)}
                  </span>
                  <p className="text-[11px] text-amber-700 mt-0.5">Awaiting assignment</p>
                </div>
              </div>

              {/* Active Dispatched */}
              <div className="flex flex-col justify-between rounded-2xl border border-blue-200/80 bg-blue-50/20 p-4 shadow-xs transition hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-800">Active Units</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 border border-blue-200">
                    <Radio className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <span className="font-display text-2xl font-extrabold text-blue-900 tracking-tight">
                    {overview.active}
                  </span>
                  <p className="text-[11px] text-blue-700 mt-0.5">In field deployment</p>
                </div>
              </div>

              {/* Critical Severity */}
              <div className="flex flex-col justify-between rounded-2xl border border-red-200/80 bg-red-50/20 p-4 shadow-xs transition hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-800">Critical Priority</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-red-700 border border-red-200">
                    <Flame className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <span className="font-display text-2xl font-extrabold text-red-900 tracking-tight">
                    {overview.critical}
                  </span>
                  <p className="text-[11px] text-red-700 mt-0.5">Urgent life threat</p>
                </div>
              </div>

              {/* Resolved / Closed */}
              <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-4 shadow-xs transition hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-800">Resolved</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <span className="font-display text-2xl font-extrabold text-emerald-900 tracking-tight">
                    {overview.resolved}
                  </span>
                  <p className="text-[11px] text-emerald-700 mt-0.5">Missions completed</p>
                </div>
              </div>

              {/* Personal Safety SOS */}
              <div className="flex flex-col justify-between rounded-2xl border border-purple-200/80 bg-purple-50/20 p-4 shadow-xs transition hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-800">SOS Reports</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 border border-purple-200">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <span className="font-display text-2xl font-extrabold text-purple-900 tracking-tight">
                    {overview.personal_safety_count}
                  </span>
                  <p className="text-[11px] text-purple-700 mt-0.5">Personal safety intake</p>
                </div>
              </div>
            </div>

            {/* Row 2: Status Distribution Donut + Response Performance */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Status Distribution */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Status Distribution</h2>
                    <p className="text-xs text-muted">Intake lifecycle breakdown across entire dataset</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {overview.total_incidents} Total
                  </span>
                </div>

                {statusPie.length === 0 ? (
                  <p className="empty-state">No status slices yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] items-center gap-4">
                    <div className="h-64 w-full">
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
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                          >
                            {statusPie.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                    </div>

                    {/* Breakdown List with Percentage */}
                    <div className="space-y-2">
                      {statusPie.map((item) => {
                        const pct = ((item.value / overview.total_incidents) * 100).toFixed(0);
                        return (
                          <div
                            key={item.name}
                            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 transition hover:bg-slate-50"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-xs font-medium text-slate-700">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{item.value}</span>
                              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-200">
                                {pct}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* Response Delays & Telemetry */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Dispatch Response Telemetry</h2>
                    <p className="text-xs text-muted">Time to dispatch first responder after report intake</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                    SLA Target: &lt; 20m
                  </span>
                </div>

                {delays ? (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Average Time */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                          <Timer className="h-3.5 w-3.5 text-primary" />
                          <span className="text-[11px] font-semibold uppercase">Avg Dispatch</span>
                        </div>
                        <p className="font-display text-3xl font-extrabold text-slate-900">
                          {delays.avg_minutes_to_assign}{" "}
                          <span className="text-sm font-normal text-slate-500">min</span>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">Across all assigned missions</p>
                      </div>

                      {/* Median Time */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                          <Zap className="h-3.5 w-3.5 text-amber-600" />
                          <span className="text-[11px] font-semibold uppercase">Median Response</span>
                        </div>
                        <p className="font-display text-3xl font-extrabold text-slate-900">
                          {delays.median_minutes_to_assign ?? 0.5}{" "}
                          <span className="text-sm font-normal text-slate-500">min</span>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">Rapid response 50th percentile</p>
                      </div>
                    </div>

                    {/* Operational Summary */}
                    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Active Deployments</span>
                        </span>
                        <span className="font-bold text-primary">
                          {delays.assigned_count} Incidents Dispatched
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((delays.assigned_count / (overview.total_incidents || 1)) * 100 * 3),
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1.5 leading-snug">
                        Field resources mobilized for life safety and property protection.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="empty-state">No delay metrics.</p>
                )}
              </section>
            </div>
          </>
        ) : null}

        {/* Row 3: Incidents by Category & Hotspots Map */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Incidents by Category */}
          <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Incidents by Category</h2>
                <p className="text-xs text-muted">Distribution across emergency types</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {categories.length} Categories
              </span>
            </div>

            {categoryBars.length === 0 ? (
              <p className="empty-state">No category data.</p>
            ) : (
              <div className="h-80 w-full">
                <ChartContainer
                  config={CATEGORY_CHART_CONFIG}
                  className="h-full w-full aspect-auto"
                >
                  <BarChart data={categoryBars} margin={{ top: 12, right: 16, left: 0, bottom: 44 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      height={50}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                    <ChartTooltip
                      cursor={{ fill: "rgba(0, 0, 0, 0.04)" }}
                      content={<ChartTooltipContent indicator="line" />}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {categoryBars.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS.bars[i % CHART_COLORS.bars.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </section>

          {/* Regional Hotspots */}
          <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Regional Incident Hotspots</h2>
                <p className="text-xs text-muted">Anonymized geographic density clusters</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {hotspots.length} Grid Cells
              </span>
            </div>

            {hotspots.length === 0 ? (
              <p className="empty-state">No hotspot data.</p>
            ) : (
              <div className="h-80 w-full overflow-hidden rounded-xl border border-slate-200">
                <HotspotsMapDynamic points={hotspots} height={320} />
              </div>
            )}
          </section>
        </div>
      </div>
    </ScrollArea>
  );
}
