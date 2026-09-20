"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  LifeBuoy,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Truck,
  Waves,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  ApiError,
  listAssignments,
  patchAssignmentStatus,
  type AssignmentItem,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

type FieldAssignment = AssignmentItem & {
  tracking_ref?: string;
  incident_status?: string;
  priority?: string | null;
  category?: string | null;
  description?: string | null;
  ai_summary?: string | null;
  address_text?: string | null;
  location?: { latitude: number; longitude: number } | null;
  resource_name?: string | null;
  resource_type?: string | null;
  assigned_at?: string | null;
  decision?: string;
  recommendation_reason?: string | null;
  incident?: {
    id?: string;
    tracking_ref?: string;
    category?: string;
    priority?: string;
    status?: string;
    ai_summary?: string;
    description?: string;
    address_text?: string;
    location?: { latitude: number; longitude: number };
  };
  resource?: {
    id?: string;
    name?: string;
    type?: string;
    status?: string;
  };
};

function getCategoryIcon(cat?: string | null) {
  switch (cat?.toLowerCase()) {
    case "fire":
      return <Flame className="h-4 w-4 text-orange-600" />;
    case "medical":
      return <Activity className="h-4 w-4 text-rose-600" />;
    case "flood":
      return <Waves className="h-4 w-4 text-blue-600" />;
    case "industrial_accident":
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case "road_incident":
      return <Truck className="h-4 w-4 text-yellow-600" />;
    case "earthquake":
      return <ShieldAlert className="h-4 w-4 text-red-600" />;
    default:
      return <LifeBuoy className="h-4 w-4 text-indigo-600" />;
  }
}

function getPriorityBadge(priority?: string | null) {
  switch (priority?.toLowerCase()) {
    case "critical":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800 border border-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
          CRITICAL
        </span>
      );
    case "high":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800 border border-orange-200">
          HIGH
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
          MEDIUM
        </span>
      );
    case "low":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
          LOW
        </span>
      );
    default:
      return null;
  }
}

function getStatusBadge(status: string) {
  switch (status.toLowerCase()) {
    case "confirmed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200 shadow-sm">
          <Radio className="h-3 w-3 animate-pulse text-amber-600" />
          DISPATCHED
        </span>
      );
    case "en_route":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200 shadow-sm">
          <Navigation className="h-3 w-3 animate-bounce text-blue-600" />
          EN ROUTE
        </span>
      );
    case "on_scene":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-200 shadow-sm">
          <MapPin className="h-3 w-3 text-indigo-600" />
          ON SCENE
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-sm">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          COMPLETED
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
          CANCELLED
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200">
          {status.replaceAll("_", " ").toUpperCase()}
        </span>
      );
  }
}

export default function FieldAssignmentsPage() {
  const { getToken, user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<FieldAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "confirmed" | "en_route" | "on_scene" | "completed">("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    const token = getToken();
    if (!token) return;
    if (!quiet) setLoading(true);
    try {
      const data = await listAssignments(token);
      setItems((data.items ?? []) as FieldAssignment[]);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load assignments");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStatusUpdate(assignmentId: string, nextStatus: string) {
    const token = getToken();
    if (!token) return;
    setUpdatingId(assignmentId);
    try {
      await patchAssignmentStatus(token, assignmentId, nextStatus);
      toast({
        title: "Status Updated",
        description: `Mission status updated to ${nextStatus.replaceAll("_", " ")}.`,
        variant: "success",
      });
      await load(true);
    } catch (err) {
      toast({
        title: "Update Failed",
        description: err instanceof ApiError ? err.message : "Could not update assignment status",
        variant: "error",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  // Filter and search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filter tab
      if (filter === "active") {
        if (!["confirmed", "en_route", "on_scene"].includes(item.status)) return false;
      } else if (filter !== "all" && item.status !== filter) {
        return false;
      }

      // Search query
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const tracking = item.tracking_ref?.toLowerCase() ?? "";
      const cat = item.category?.toLowerCase() ?? "";
      const resName = item.resource_name?.toLowerCase() ?? "";
      const addr = item.address_text?.toLowerCase() ?? "";
      const summary = item.ai_summary?.toLowerCase() ?? "";
      return (
        tracking.includes(q) ||
        cat.includes(q) ||
        resName.includes(q) ||
        addr.includes(q) ||
        summary.includes(q)
      );
    });
  }, [items, filter, search]);

  // Counts
  const counts = useMemo(() => {
    const active = items.filter((i) => ["confirmed", "en_route", "on_scene"].includes(i.status)).length;
    const confirmed = items.filter((i) => i.status === "confirmed").length;
    const enRoute = items.filter((i) => i.status === "en_route").length;
    const onScene = items.filter((i) => i.status === "on_scene").length;
    const completed = items.filter((i) => i.status === "completed").length;
    return { all: items.length, active, confirmed, enRoute, onScene, completed };
  }, [items]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden w-full max-w-5xl mx-auto space-y-4">
      {/* Top Header & Context */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              My Mission Assignments
            </h1>
            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white">
              {counts.all}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Emergency response tasks assigned to {user?.name || "your emergency unit"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          <span>Sync Feed</span>
        </button>
      </header>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
        <div
          onClick={() => setFilter("all")}
          className={`cursor-pointer rounded-xl border p-3 transition-all ${
            filter === "all"
              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
          }`}
        >
          <p className={`text-[11px] font-semibold ${filter === "all" ? "text-slate-300" : "text-slate-500"}`}>
            Total Assigned
          </p>
          <p className="text-xl font-extrabold mt-0.5">{counts.all}</p>
        </div>

        <div
          onClick={() => setFilter("active")}
          className={`cursor-pointer rounded-xl border p-3 transition-all ${
            filter === "active"
              ? "border-blue-600 bg-blue-600 text-white shadow-sm"
              : "border-blue-100 bg-blue-50/50 text-blue-900 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-[11px] font-semibold ${filter === "active" ? "text-blue-100" : "text-blue-700"}`}>
              Active Missions
            </p>
            {counts.active > 0 ? (
              <span className={`h-2 w-2 rounded-full ${filter === "active" ? "bg-white" : "bg-blue-600"} animate-ping`} />
            ) : null}
          </div>
          <p className="text-xl font-extrabold mt-0.5">{counts.active}</p>
        </div>

        <div
          onClick={() => setFilter("en_route")}
          className={`cursor-pointer rounded-xl border p-3 transition-all ${
            filter === "en_route"
              ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
              : "border-indigo-100 bg-indigo-50/50 text-indigo-900 hover:border-indigo-300"
          }`}
        >
          <p className={`text-[11px] font-semibold ${filter === "en_route" ? "text-indigo-100" : "text-indigo-700"}`}>
            In Transit / En Route
          </p>
          <p className="text-xl font-extrabold mt-0.5">{counts.enRoute}</p>
        </div>

        <div
          onClick={() => setFilter("completed")}
          className={`cursor-pointer rounded-xl border p-3 transition-all ${
            filter === "completed"
              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
              : "border-emerald-100 bg-emerald-50/50 text-emerald-900 hover:border-emerald-300"
          }`}
        >
          <p className={`text-[11px] font-semibold ${filter === "completed" ? "text-emerald-100" : "text-emerald-700"}`}>
            Resolved / Done
          </p>
          <p className="text-xl font-extrabold mt-0.5">{counts.completed}</p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by incident ID, area, or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "confirmed", label: "Confirmed" },
              { id: "en_route", label: "En Route" },
              { id: "on_scene", label: "On Scene" },
              { id: "completed", label: "Completed" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 shrink-0 flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Main Scrollable Mission Feed Container */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 pb-8">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-700">Loading assignments…</p>
            <p className="text-xs text-slate-400">Fetching live operational missions</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <div className="rounded-full bg-slate-100 p-3 mb-3">
              <ShieldAlert className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No matching assignments</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {search || filter !== "all"
                ? "No missions match your current filter or search criteria. Try resetting filters."
                : "No active missions assigned to this unit right now. Stand by for emergency dispatch alerts."}
            </p>
            {search || filter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="mt-3 text-xs font-bold text-slate-900 underline hover:text-slate-700"
              >
                Clear all filters
              </button>
            ) : null}
          </div>
        ) : (
          filteredItems.map((a) => {
            const tracking = a.tracking_ref ?? a.id.slice(0, 8);
            const priority = a.priority ?? a.incident?.priority;
            const category = a.category ?? a.incident?.category;
            const summary = a.ai_summary ?? a.incident?.ai_summary ?? a.description ?? a.incident?.description;
            const address = a.address_text ?? a.incident?.address_text;
            const lat = a.location?.latitude ?? a.incident?.location?.latitude;
            const lng = a.location?.longitude ?? a.incident?.location?.longitude;
            const mapsUrl = lat && lng ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null;
            const isBusy = updatingId === a.id;

            return (
              <div
                key={a.id}
                className="group relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Status Indicator Left Strip */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    a.status === "en_route"
                      ? "bg-blue-600"
                      : a.status === "on_scene"
                      ? "bg-indigo-600"
                      : a.status === "completed"
                      ? "bg-emerald-600"
                      : "bg-amber-500"
                  }`}
                />

                <div className="pl-1 space-y-3">
                  {/* Card Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(a.status)}
                      {getPriorityBadge(priority)}

                      {category ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 border border-slate-200">
                          {getCategoryIcon(category)}
                          <span className="capitalize">{category.replaceAll("_", " ")}</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recent"}</span>
                    </div>
                  </div>

                  {/* Incident Title & Unit Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Ref:</span>
                      <Link
                        href={`/field/assignments/${a.id}`}
                        className="text-base font-black text-slate-900 hover:text-blue-600 transition-colors tracking-tight"
                      >
                        #{tracking}
                      </Link>
                    </div>

                    {a.resource_name ? (
                      <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-700">
                        <Truck className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[280px] font-semibold">{a.resource_name}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* AI Summary / Situation Report */}
                  {summary ? (
                    <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-2.5 text-xs text-slate-700 leading-relaxed">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-900 mb-1">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span>Situation Brief</span>
                      </div>
                      <p className="line-clamp-2">{summary}</p>
                    </div>
                  ) : null}

                  {/* Location & Navigation info */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      <span className="truncate font-medium">
                        {address || (lat && lng ? `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}` : "Location logged")}
                      </span>
                    </div>

                    {mapsUrl ? (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <Navigation className="h-3 w-3" />
                        <span>Google Maps</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : null}
                  </div>

                  {/* Tactical Action Buttons Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    {/* Progression Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {a.status === "confirmed" ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleStatusUpdate(a.id, "en_route")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          <span>{isBusy ? "Updating..." : "Start En Route"}</span>
                        </button>
                      ) : null}

                      {a.status === "en_route" ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleStatusUpdate(a.id, "on_scene")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{isBusy ? "Updating..." : "Arrived On Scene"}</span>
                        </button>
                      ) : null}

                      {a.status === "on_scene" ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleStatusUpdate(a.id, "completed")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{isBusy ? "Updating..." : "Complete Mission"}</span>
                        </button>
                      ) : null}

                      {a.status === "completed" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mission Closed
                        </span>
                      ) : null}
                    </div>

                    {/* View Details Link */}
                    <Link
                      href={`/field/assignments/${a.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 group-hover:translate-x-0.5 transition-transform"
                    >
                      <span>Mission Dossier</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-900" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
