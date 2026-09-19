"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/domain/StatusPill";
import { ApiError, getIncidentStatus, PublicStatus } from "@/lib/api/client";

export default function TrackingPage() {
  const params = useParams<{ trackingRef: string }>();
  const trackingRef = decodeURIComponent(params.trackingRef ?? "");
  const [data, setData] = useState<PublicStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await getIncidentStatus(trackingRef);
      setData(status);
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError ? err.message : "Unable to load status");
    } finally {
      setLoading(false);
    }
  }, [trackingRef]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 8000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <section className="citizen-narrow stack animate-enter">
      <div className="stack">
        <h1 className="hero-title">Report status</h1>
        <p className="muted">Public tracking for reference {trackingRef || "—"}</p>
      </div>

      {data?.status === "resolved" || data?.status === "closed" ? (
        <div className="page-media-banner" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/resources-arrived-success.jpg" alt="" />
        </div>
      ) : null}

      <div className="panel stack">
        {loading && !data ? <p className="muted">Loading…</p> : null}
        {error ? (
          <div className="alert-error" role="alert">
            {error}
          </div>
        ) : null}
        {data ? (
          <>
            <p>
              <strong>Tracking ref:</strong> {data.tracking_ref}
            </p>
            <p>
              <strong>Status:</strong> <StatusPill status={data.status} />
            </p>
            <p className="muted">Updated {new Date(data.updated_at).toLocaleString()}</p>
          </>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Refresh
        </button>
        <Link href="/report" className="btn btn-primary">
          Submit another report
        </Link>
      </div>
    </section>
  );
}
