"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/domain/StatusPill";
import { ClassificationReviewBadge } from "@/components/domain/ClassificationReviewBadge";
import { LocationMapDialog } from "@/components/maps/LocationMapDialog";
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
              <button
                type="button"
                className="btn btn-primary"
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
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="stack">
        <h2>Manual assign</h2>
        <p className="muted">Pick any available resource (decision=manual).</p>
        <div className="cta-row">
          <select
            className="field"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            aria-label="Available resource"
          >
            <option value="">Select resource…</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.type})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || !manualId}
            onClick={() => {
              const r = resources.find((x) => x.id === manualId);
              void onAssign(manualId, "manual", undefined, r?.name);
            }}
          >
            Assign manually
          </button>
        </div>
      </section>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
