"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { LocationMapDialog } from "@/components/maps/LocationMapDialog";
import { OpsMapDynamic } from "@/components/maps/OpsMapDynamic";
import { resourceStatusColor } from "@/components/maps/mapStyles";
import { Button } from "@/components/ui/Button";
import {
  ApiError,
  createResource,
  listResources,
  updateResource,
  type ResourceItem,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

const RESOURCE_TYPES = ["team", "vehicle", "equipment", "facility"] as const;

function statusLabel(r: ResourceItem): string {
  if (r.is_active === false) return "Inactive";
  return r.status;
}

export default function ResourcesPage() {
  const { getToken, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof RESOURCE_TYPES)[number]>("team");
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await listResources(token, {
        active_only: false,
        status: statusFilter || undefined,
      });
      setItems(data.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load resources");
    }
  }, [getToken, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token || !isAdmin) return;
    setMessage(null);
    try {
      await createResource(token, {
        type,
        name,
        location: { latitude: Number(lat), longitude: Number(lng) },
      });
      setMessage(`Created ${name}`);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    }
  }

  async function onDeactivate(id: string) {
    const token = getToken();
    if (!token || !isAdmin) return;
    try {
      await updateResource(token, id, { is_active: false });
      setMessage("Resource deactivated");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 flex-col gap-4 overflow-hidden">
      <header className="shrink-0">
        <h1 className="font-display text-xl font-bold md:text-2xl">Resources</h1>
        <p className="text-sm text-muted">Inventory and map of response units</p>
      </header>

      {error ? <p className="form-error shrink-0">{error}</p> : null}
      {message ? <p className="form-success shrink-0">{message}</p> : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_minmax(300px,400px)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-base font-bold">Map</h2>
            <div className="flex flex-wrap gap-3 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#15803d" }} />
                Available
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#d97706" }} />
                Assigned
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#94a3b8" }} />
                Unavailable / inactive
              </span>
            </div>
          </div>
          <div className="relative min-h-[45dvh] flex-1 lg:min-h-0">
            <OpsMapDynamic
              resources={items}
              showIncidents={false}
              showResources
              height="100%"
              className="absolute inset-0 rounded-none border-0"
            />
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <div className="shrink-0">
            <select
              className="field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Resource status filter"
            >
              <option value="">All statuses</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>

          {isAdmin ? (
            <form className="stack shrink-0 gap-2 rounded-panel border border-border bg-surface p-3" onSubmit={onCreate}>
              <h2 className="text-sm font-bold">Add resource</h2>
              <input
                className="field"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <select
                className="field"
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
              >
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="filter-row">
                <input
                  className="field"
                  placeholder="Latitude"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  required
                />
                <input
                  className="field"
                  placeholder="Longitude"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" size="sm">
                Create
              </Button>
            </form>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto rounded-panel border border-border bg-surface">
            <ul className="divide-y divide-border">
              {items.length === 0 ? (
                <li className="p-4 text-sm text-muted">No resources match this filter.</li>
              ) : (
                items.map((r) => (
                  <li key={r.id} className="flex items-start gap-2 p-3">
                    <span
                      className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-sm"
                      style={{ background: resourceStatusColor(r) }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-xs text-muted">
                        {r.type} · {statusLabel(r)}
                      </p>
                    </div>
                    <LocationMapDialog
                      latitude={r.location.latitude}
                      longitude={r.location.longitude}
                      label={r.name}
                    />
                    {isAdmin ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => void onDeactivate(r.id)}>
                        Deactivate
                      </Button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
