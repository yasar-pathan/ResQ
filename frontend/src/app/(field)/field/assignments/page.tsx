"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/domain/StatusPill";
import { ApiError, listAssignments, type AssignmentItem } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

type FieldAssignment = AssignmentItem & {
  tracking_ref?: string;
  incident_status?: string;
  priority?: string | null;
};

export default function FieldAssignmentsPage() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<FieldAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await listAssignments(token);
      setItems(data.items as FieldAssignment[]);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load assignments");
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="stack" style={{ gap: "1.25rem", maxWidth: 640 }}>
      <header>
        <h1>My assignments</h1>
        <p className="muted">Field team task list</p>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {items.length === 0 && !error ? (
        <p className="empty-state">No active assignments right now.</p>
      ) : null}
      <ul className="field-list">
        {items.map((a) => (
          <li key={a.id}>
            <Link href={`/field/assignments/${a.id}`} className="field-card">
              <StatusPill status={a.status} />
              <strong>{a.tracking_ref ?? a.id.slice(0, 8)}</strong>
              <span className="muted">
                {a.priority ? `${a.priority} · ` : ""}
                {a.incident_status ?? a.decision}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
