"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  MapPin,
  Radio,
  RotateCcw,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { StatusPill } from "@/components/domain/StatusPill";
import { ClassificationReviewBadge } from "@/components/domain/ClassificationReviewBadge";
import { LocationMapDialog } from "@/components/maps/LocationMapDialog";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  ApiError,
  assignResource,
  getIncident,
  getRecommendations,
  listResources,
  updateIncidentStatus,
  type IncidentListItem,
  type RecommendationItem,
  type ResourceItem,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(distKm: number): string {
  if (distKm < 1) return `${Math.round(distKm * 1000)}m`;
  if (distKm < 10) return `${distKm.toFixed(1)} km`;
  if (distKm < 100) return `${distKm.toFixed(0)} km`;
  return `${Math.round(distKm).toLocaleString()} km`;
}

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [incident, setIncident] = useState<IncidentListItem | null>(null);
  const [recs, setRecs] = useState<RecommendationItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [manualId, setManualId] = useState("");
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [showReassign, setShowReassign] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !id) return;
    try {
      const [inc, r, avail] = await Promise.all([
        getIncident(token, id),
        getRecommendations(token, id),
        listResources(token, { status: "available" }),
      ]);
      setIncident(inc);
      setRecs(r.items);
      setEmptyReason(r.empty_reason);
      setResources(avail.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load incident");
    }
  }, [getToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Calculate distance for all available resources from this incident's coordinates
  const resourcesWithDistance = useMemo(() => {
    if (!incident?.location) {
      return resources.map((r) => ({
        ...r,
        distanceKm: 999999,
        formattedDistance: "—",
      }));
    }
    const { latitude: incLat, longitude: incLng } = incident.location;
    return resources
      .map((r) => {
        const distKm = calculateDistanceKm(
          incLat,
          incLng,
          r.location.latitude,
          r.location.longitude,
        );
        return {
          ...r,
          distanceKm: distKm,
          formattedDistance: formatDistance(distKm),
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [incident?.location, resources]);

  async function onAssign(
    resourceId: string,
    decision: string,
    reason?: string,
    nameHint?: string,
  ) {
    const token = getToken();
    if (!token || !id) return;
    setBusy(true);
    setAssigningId(resourceId);
    setMessage(null);
    try {
      await assignResource(token, id, {
        resource_id: resourceId,
        decision,
        recommendation_reason: reason,
      });
      setMessage(`Successfully assigned ${nameHint ?? resourceId}. Request status updated to Assigned.`);
      setShowReassign(false);
      setManualId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Assign failed");
    } finally {
      setBusy(false);
      setAssigningId(null);
    }
  }

  async function onChangeStatus(newStatus: string) {
    const token = getToken();
    if (!token || !id) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateIncidentStatus(token, id, newStatus);
      setMessage(`Request status changed to ${newStatus.toUpperCase()}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !incident) {
    return <p className="form-error">{error}</p>;
  }
  if (!incident) {
    return <p className="muted">Loading incident…</p>;
  }

  const isAssigned =
    incident.status === "assigned" ||
    incident.status === "in_progress" ||
    Boolean(incident.active_assignment);

  return (
    <div className="stack h-full min-h-0 overflow-y-auto" style={{ gap: "1.5rem", width: "100%", maxWidth: 960 }}>
      <Link href="/dashboard" className="muted">
        ← Dashboard
      </Link>

      {/* Header */}
      <header className="stack" style={{ gap: "0.5rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>{incident.tracking_ref}</h1>
          {incident.location ? (
            <LocationMapDialog
              latitude={incident.location.latitude}
              longitude={incident.location.longitude}
              label={incident.tracking_ref}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusPill status={incident.status} />
          <span className={`prio prio-${incident.priority ?? "none"}`}>
            {incident.priority ?? "unclassified"}
          </span>
          {incident.location ? (
            <span className="text-xs text-muted">
              📍 Lat {incident.location.latitude.toFixed(4)}, Lng {incident.location.longitude.toFixed(4)}
            </span>
          ) : null}
        </div>
        <ClassificationReviewBadge
          confidence={incident.ai_confidence}
          className="mt-1 w-fit"
        />
        <p className="muted">
          {incident.category.replaceAll("_", " ")} · {incident.source}
          {incident.classification_source
            ? ` · classified via ${incident.classification_source}`
            : ""}
        </p>
      </header>

      {/* AI Summary */}
      <section className="stack">
        <h2>AI-generated summary</h2>
        <p>{incident.ai_summary || incident.description}</p>
      </section>

      {/* Feedback Messages */}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs font-semibold text-emerald-800 flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}

      {/* ACTIVE TEAM ASSIGNMENT & STATUS MANAGEMENT */}
      {isAssigned && !showReassign ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 m-0">Team Assigned & Active</h2>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                    {incident.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Assigned unit:{" "}
                  <strong className="text-slate-900">
                    {incident.active_assignment?.resource_name ?? "Emergency Response Squad"}
                  </strong>
                  {incident.active_assignment?.status
                    ? ` (Mission: ${incident.active_assignment.status})`
                    : ""}
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowReassign(true)}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Change / Reassign Unit
            </Button>
          </div>

          {/* Request Status Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div>
              <span className="text-xs font-semibold text-slate-700 block">
                Update Request Status:
              </span>
              <p className="text-[11px] text-muted">
                Keep the citizen and field team updated on the emergency lifecycle.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {incident.status !== "in_progress" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy}
                  onClick={() => void onChangeStatus("in_progress")}
                  className="bg-white hover:bg-blue-50 text-blue-700 border-blue-200"
                >
                  <Radio className="h-3.5 w-3.5 mr-1.5" />
                  Mark In Progress
                </Button>
              ) : null}

              {incident.status !== "resolved" ? (
                <Button
                  size="sm"
                  variant="primary"
                  loading={busy}
                  onClick={() => void onChangeStatus("resolved")}
                  className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Mark Resolved
                </Button>
              ) : null}

              {incident.status !== "closed" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy}
                  onClick={() => void onChangeStatus("closed")}
                  className="text-slate-600 hover:bg-slate-100"
                >
                  Close Request
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* DISPATCH / ASSIGNMENT WORKFLOW (Shown when request is unassigned OR when dispatcher clicks Change/Reassign) */}
      {(!isAssigned || showReassign) ? (
        <>
          {showReassign ? (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-700">
                Selecting replacement resource for {incident.tracking_ref}
              </span>
              <button
                type="button"
                onClick={() => setShowReassign(false)}
                className="text-xs font-medium text-slate-500 hover:underline"
              >
                Cancel Reassignment
              </button>
            </div>
          ) : null}

          {/* Recommendations with distance */}
          <section className="stack">
            <div className="flex items-center justify-between">
              <h2>AI Recommended Units</h2>
              <span className="text-xs text-muted">Ranked by proximity & match</span>
            </div>

            {emptyReason ? (
              <p className="form-error">
                No resources available ({emptyReason}). Escalation alert will be raised.
              </p>
            ) : null}

            {recs.map((rec, idx) => (
              <article key={rec.resource_id} className="rec-card">
                <div>
                  <div className="flex items-center gap-2">
                    <strong>
                      #{idx + 1} {rec.name}
                    </strong>
                    <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-100">
                      <MapPin className="h-3 w-3" />
                      {formatDistance(rec.distance_meters / 1000)}
                    </span>
                  </div>
                  <p className="muted text-xs mt-1">{rec.recommendation_reason}</p>
                  <p className="muted text-[11px] mt-0.5">
                    Match score: {(rec.score * 100).toFixed(0)}% · Active missions: {rec.load}
                  </p>
                </div>
                <div className="rec-actions">
                  <Button
                    variant="primary"
                    loading={busy && assigningId === rec.resource_id}
                    disabled={busy}
                    onClick={() =>
                      void onAssign(
                        rec.resource_id,
                        idx === 0 ? "accepted_ai" : "overridden",
                        rec.recommendation_reason,
                        rec.name,
                      )
                    }
                  >
                    {idx === 0 ? "Accept AI" : "Assign (override)"}
                  </Button>
                </div>
              </article>
            ))}
          </section>

          {/* Manual Assign with Distances of ALL Available Resources */}
          <section className="stack">
            <h2>Manual assign from Fleet</h2>
            <p className="muted text-xs">
              All available resources sorted by distance from this incident coordinates.
            </p>
            <div className="cta-row">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 min-w-[280px] sm:min-w-[340px] items-center justify-between gap-2 rounded-control border border-border bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="Available resource"
                  >
                    <span className="truncate">
                      {manualId
                        ? (() => {
                            const res = resourcesWithDistance.find((r) => r.id === manualId);
                            return res
                              ? `${res.name} (${res.type}) · 📍 ${res.formattedDistance}`
                              : "Select resource…";
                          })()
                        : "Select resource…"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[min(92vw,440px)] bg-surface max-h-72 overflow-y-auto">
                  <DropdownMenuRadioGroup value={manualId} onValueChange={setManualId}>
                    <DropdownMenuRadioItem value="">
                      <span className="text-slate-400">Select resource…</span>
                    </DropdownMenuRadioItem>
                    {resourcesWithDistance.map((r) => (
                      <DropdownMenuRadioItem key={r.id} value={r.id} className="py-2">
                        <div className="flex items-center justify-between w-full gap-3">
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-semibold text-xs text-slate-900 truncate">
                              {r.name}
                            </span>
                            <span className="text-[10px] capitalize text-slate-500">
                              {r.type} · Lat {r.location.latitude.toFixed(3)}, Lng {r.location.longitude.toFixed(3)}
                            </span>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-100">
                            <MapPin className="h-3 w-3" />
                            {r.formattedDistance}
                          </span>
                        </div>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="secondary"
                loading={busy && assigningId === manualId}
                disabled={busy || !manualId}
                onClick={() => {
                  const r = resourcesWithDistance.find((x) => x.id === manualId);
                  void onAssign(manualId, "manual", undefined, r?.name);
                }}
              >
                Assign manually
              </Button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
