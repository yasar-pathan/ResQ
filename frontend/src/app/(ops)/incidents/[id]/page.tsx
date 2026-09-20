"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
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
  type IncidentListItem,
  type RecommendationItem,
  type ResourceItem,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

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

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !id) return;
    try {
      setIncident(await getIncident(token, id));
      const r = await getRecommendations(token, id);
      setRecs(r.items);
      setEmptyReason(r.empty_reason);
      const avail = await listResources(token, { status: "available" });
      setResources(avail.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load incident");
    }
  }, [getToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setMessage(`Assigned ${nameHint ?? resourceId}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Assign failed");
    } finally {
      setBusy(false);
      setAssigningId(null);
    }
  }

  if (error && !incident) {
    return <p className="form-error">{error}</p>;
  }
  if (!incident) {
    return <p className="muted">Loading incident…</p>;
  }

  return (
    <div className="stack h-full min-h-0 overflow-y-auto" style={{ gap: "1.5rem", width: "100%", maxWidth: 960 }}>
      <Link href="/dashboard" className="muted">
        ← Dashboard
      </Link>
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

      <section className="stack">
        <h2>AI-generated summary</h2>
        <p>{incident.ai_summary || incident.description}</p>
      </section>

      <section className="stack">
        <h2>Recommendations</h2>
        {emptyReason ? (
          <p className="form-error">
            No resources available ({emptyReason}). Escalation alert will be raised.
          </p>
        ) : null}
        {recs.map((rec, idx) => (
          <article key={rec.resource_id} className="rec-card">
            <div>
              <strong>
                #{idx + 1} {rec.name}
              </strong>
              <p className="muted">{rec.recommendation_reason}</p>
              <p className="muted">
                {rec.distance_meters.toFixed(0)}m · score {rec.score.toFixed(2)} · load {rec.load}
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

      <section className="stack">
        <h2>Manual assign</h2>
        <p className="muted">Pick any available resource (decision=manual).</p>
        <div className="cta-row">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 min-w-[220px] items-center justify-between gap-2 rounded-control border border-border bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="Available resource"
              >
                <span className="truncate">
                  {manualId
                    ? (() => {
                        const res = resources.find((r) => r.id === manualId);
                        return res ? `${res.name} (${res.type})` : "Select resource…";
                      })()
                    : "Select resource…"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-surface max-h-60 overflow-y-auto">
              <DropdownMenuRadioGroup value={manualId} onValueChange={setManualId}>
                <DropdownMenuRadioItem value="">Select resource…</DropdownMenuRadioItem>
                {resources.map((r) => (
                  <DropdownMenuRadioItem key={r.id} value={r.id}>
                    {r.name} ({r.type})
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
              const r = resources.find((x) => x.id === manualId);
              void onAssign(manualId, "manual", undefined, r?.name);
            }}
          >
            Assign manually
          </Button>
        </div>
      </section>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
