"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/domain/StatusPill";
import {
  ApiError,
  assignResource,
  getIncident,
  getRecommendations,
  type IncidentListItem,
  type RecommendationItem,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [incident, setIncident] = useState<IncidentListItem | null>(null);
  const [recs, setRecs] = useState<RecommendationItem[]>([]);
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
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load incident");
    }
  }, [getToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAssign(rec: RecommendationItem, decision: string) {
    const token = getToken();
    if (!token || !id) return;
    setBusy(true);
    setMessage(null);
    try {
      await assignResource(token, id, {
        resource_id: rec.resource_id,
        decision,
        recommendation_reason: rec.recommendation_reason,
      });
      setMessage(`Assigned ${rec.name}`);
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
    <div className="stack" style={{ gap: "1.5rem", maxWidth: 720 }}>
      <Link href="/dashboard" className="muted">
        ← Dashboard
      </Link>
      <header className="stack" style={{ gap: "0.5rem" }}>
        <h1>{incident.tracking_ref}</h1>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <StatusPill status={incident.status} />
          <span className={`prio prio-${incident.priority ?? "none"}`}>
            {incident.priority ?? "unclassified"}
          </span>
        </div>
        <p className="muted">
          {incident.category.replaceAll("_", " ")} · {incident.source}
        </p>
      </header>

      <section className="stack">
        <h2>AI summary</h2>
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
                onClick={() => void onAssign(rec, idx === 0 ? "accepted_ai" : "overridden")}
              >
                {idx === 0 ? "Accept AI" : "Assign (override)"}
              </button>
            </div>
          </article>
        ))}
      </section>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
