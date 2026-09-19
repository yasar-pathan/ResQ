"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/domain/StatusPill";
import {
  ApiError,
  getAssignment,
  patchAssignmentStatus,
  type AssignmentItem,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

const NEXT: Record<string, { label: string; status: string }[]> = {
  confirmed: [
    { label: "En route", status: "en_route" },
    { label: "Cancel", status: "cancelled" },
  ],
  en_route: [
    { label: "On scene", status: "on_scene" },
    { label: "Cancel", status: "cancelled" },
  ],
  on_scene: [
    { label: "Complete", status: "completed" },
    { label: "Cancel", status: "cancelled" },
  ],
};

export default function FieldAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
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
      setError(err instanceof ApiError ? err.message : "Failed to load");
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
      setRow(await patchAssignmentStatus(token, id, status));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!row && !error) return <p className="muted">Loading…</p>;
  if (error && !row) return <p className="form-error">{error}</p>;
  if (!row) return null;

  const incident = row.incident as
    | { tracking_ref?: string; ai_summary?: string; category?: string; status?: string }
    | undefined;
  const actions = NEXT[row.status] ?? [];

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 640 }}>
      <Link href="/field/assignments" className="muted">
        ← Assignments
      </Link>
      <header className="stack" style={{ gap: "0.5rem" }}>
        <h1>{incident?.tracking_ref ?? row.id.slice(0, 8)}</h1>
        <StatusPill status={row.status} />
      </header>
      <section>
        <h2>Summary</h2>
        <p>{incident?.ai_summary || "Respond to the assigned incident."}</p>
        <p className="muted">{incident?.category?.replaceAll("_", " ")}</p>
      </section>
      <div className="cta-row">
        {actions.map((a) => (
          <button
            key={a.status}
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void update(a.status)}
          >
            {a.label}
          </button>
        ))}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
