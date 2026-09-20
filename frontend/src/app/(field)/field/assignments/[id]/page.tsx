"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  LifeBuoy,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Truck,
  Waves,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  ApiError,
  getAssignment,
  patchAssignmentStatus,
  type AssignmentItem,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

type IncidentDetail = {
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

type ResourceDetail = {
  id?: string;
  name?: string;
  type?: string;
  status?: string;
};

const NEXT: Record<string, { label: string; status: string; variant: "primary" | "warning" | "danger" }[]> = {
  confirmed: [
    { label: "🚀 Start En Route (Depart)", status: "en_route", variant: "primary" },
    { label: "Cancel Dispatch", status: "cancelled", variant: "danger" },
  ],
  en_route: [
    { label: "📍 Arrived On Scene", status: "on_scene", variant: "primary" },
    { label: "Cancel Dispatch", status: "cancelled", variant: "danger" },
  ],
  on_scene: [
    { label: "✅ Complete Mission", status: "completed", variant: "primary" },
    { label: "Cancel Dispatch", status: "cancelled", variant: "danger" },
  ],
};

function getCategoryIcon(cat?: string) {
  switch (cat?.toLowerCase()) {
    case "fire":
      return <Flame className="h-5 w-5 text-orange-600" />;
    case "medical":
      return <Activity className="h-5 w-5 text-rose-600" />;
    case "flood":
      return <Waves className="h-5 w-5 text-blue-600" />;
    case "industrial_accident":
      return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    case "road_incident":
      return <Truck className="h-5 w-5 text-yellow-600" />;
    default:
      return <LifeBuoy className="h-5 w-5 text-indigo-600" />;
  }
}

export default function FieldAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [row, setRow] = useState<AssignmentItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !id) return;
    try {
      setRow(await getAssignment(token, id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load assignment");
    }
  }, [getToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(status: string) {
    const token = getToken();
    if (!token || !id) return;
    setBusy(true);
    try {
      const updated = await patchAssignmentStatus(token, id, status);
      setRow(updated);
      toast({
        title: "Status Updated",
        description: `Mission status updated to ${status.replaceAll("_", " ")}.`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Update Failed",
        description: err instanceof ApiError ? err.message : "Status update failed",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!row && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400 mb-2" />
        <p className="text-sm font-semibold text-slate-700">Loading Mission Dossier…</p>
      </div>
    );
  }

  if (error && !row) {
    return (
      <div className="max-w-2xl mx-auto p-6 rounded-2xl border border-rose-200 bg-rose-50 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-rose-600 mx-auto" />
        <h2 className="text-base font-bold text-rose-900">Unable to Load Mission</h2>
        <p className="text-xs text-rose-700">{error}</p>
        <Link
          href="/field/assignments"
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 underline mt-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Assignments
        </Link>
      </div>
    );
  }

  if (!row) return null;

  const incident = row.incident as IncidentDetail | undefined;
  const resource = row.resource as ResourceDetail | undefined;
  const actions = NEXT[row.status] ?? [];

  const lat = incident?.location?.latitude;
  const lng = incident?.location?.longitude;
  const mapsUrl = lat && lng ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden w-full max-w-4xl mx-auto space-y-4">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between shrink-0">
        <Link
          href="/field/assignments"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Assignments</span>
        </Link>

        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4 pb-8">
        {/* Mission Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-100 p-2.5">
                {getCategoryIcon(incident?.category)}
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Incident Ref
                </span>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  #{incident?.tracking_ref ?? row.id.slice(0, 8)}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                {row.status.replaceAll("_", " ")}
              </span>
              {incident?.priority ? (
                <span className="rounded-full bg-rose-100 border border-rose-200 px-3 py-1 text-xs font-bold uppercase text-rose-800">
                  {incident.priority}
                </span>
              ) : null}
            </div>
          </div>

          {resource?.name ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Truck className="h-4 w-4 text-slate-600" />
                <div>
                  <p className="text-[11px] text-slate-500 font-semibold uppercase">Operating Unit</p>
                  <p className="text-xs font-bold text-slate-900">{resource.name}</p>
                </div>
              </div>
              <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 uppercase">
                {resource.type || "Unit"}
              </span>
            </div>
          ) : null}
        </div>

        {/* Tactical Actions Card */}
        {actions.length > 0 ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-900">
              Tactical Mission Controls
            </h3>
            <div className="flex flex-wrap items-center gap-2.5">
              {actions.map((a) => (
                <button
                  key={a.status}
                  type="button"
                  disabled={busy}
                  onClick={() => void update(a.status)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm transition-all disabled:opacity-50 ${
                    a.variant === "primary"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 flex items-center gap-2.5 text-emerald-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-xs font-semibold">
              Mission is marked as {row.status.replaceAll("_", " ")}. No further field updates required.
            </p>
          </div>
        )}

        {/* AI Situation Briefing */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">AI Situation Brief</h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed bg-amber-50/40 rounded-xl border border-amber-100/60 p-3">
            {incident?.ai_summary || "No automated situation report generated for this incident."}
          </p>

          {incident?.description ? (
            <div className="pt-2 border-t border-slate-100 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Field Report Notes</span>
              <p className="text-xs text-slate-800 leading-relaxed">{incident.description}</p>
            </div>
          ) : null}
        </div>

        {/* Incident Location & Directions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900">Target Location</h3>
            </div>
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Open in Google Maps</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : null}
          </div>

          <div className="rounded-xl bg-slate-50 p-3 space-y-1 border border-slate-100">
            <p className="text-xs font-semibold text-slate-800">
              {incident?.address_text || "No formal street address specified"}
            </p>
            {lat && lng ? (
              <p className="text-[11px] text-slate-500 font-mono">
                Latitude: {lat.toFixed(6)} | Longitude: {lng.toFixed(6)}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
