"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ambulance, Building2, MapPin, Users, Wrench, type LucideIcon } from "lucide-react";
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
import { useAuth, withAuthRetry } from "@/lib/auth";

const RESOURCE_TYPES = ["team", "vehicle", "equipment", "facility"] as const;

const TYPE_ICONS: Record<(typeof RESOURCE_TYPES)[number], LucideIcon> = {
  team: Users,
  vehicle: Ambulance,
  equipment: Wrench,
  facility: Building2,
};

function statusLabel(r: ResourceItem): string {
  if (r.is_active === false) return "Inactive";
  return r.status;
}

function TypeIcon({ type }: { type: string }) {
  const Icon = TYPE_ICONS[type as (typeof RESOURCE_TYPES)[number]] ?? Wrench;
  return <Icon className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={1.75} aria-hidden />;
}

function ResourcesPageInner() {
  const { getToken, refreshSession, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "";
  const selectedId = searchParams.get("selected");
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof RESOURCE_TYPES)[number]>("team");
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");

  const patchParams = useCallback(
    (mutate: (qs: URLSearchParams) => void) => {
      const qs = new URLSearchParams(searchParams.toString());
      mutate(qs);
      const next = qs.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setStatusFilter = (value: string) => {
    patchParams((qs) => {
      if (value) qs.set("status", value);
      else qs.delete("status");
    });
  };

  const selectResource = (id: string) => {
    patchParams((qs) => {
      qs.set("selected", id);
    });
  };

  const load = useCallback(async () => {
    try {
      const data = await withAuthRetry(getToken, refreshSession, (token) =>
        listResources(token, {
          active_only: false,
          status: statusFilter || undefined,
        }),
      );
      setItems(data.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load resources");
    }
  }, [getToken, refreshSession, statusFilter]);

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
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold md:text-2xl">Resources</h1>
          <p className="text-sm text-muted">Inventory and map of response units</p>
        </div>
        <div className="filter-row !mt-0">
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
      </header>

      {error ? <p className="form-error shrink-0">{error}</p> : null}
      {message ? <p className="form-success shrink-0">{message}</p> : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_minmax(280px,380px)]">
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
          <div className="relative min-h-[40dvh] flex-1 lg:min-h-0">
            <OpsMapDynamic
              resources={items}
              showIncidents={false}
              showResources
              selectedId={selectedId}
              onSelectResource={selectResource}
              height="100%"
              className="absolute inset-0 rounded-none border-0"
            />
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
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
              <div className="filter-row !mt-0">
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
                  <li
                    key={r.id}
                    className={`flex items-start gap-2 p-3 ${selectedId === r.id ? "bg-slate-50" : ""}`}
                  >
                    <span
                      className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-sm"
                      style={{ background: resourceStatusColor(r) }}
                      aria-hidden
                    />
                    <span className="mt-1 inline-flex shrink-0 text-slate-600" title={r.type}>
                      <TypeIcon type={r.type} />
                    </span>
                    <button
                      type="button"
                      className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
                      onClick={() => selectResource(r.id)}
                    >
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-xs capitalize text-muted">
                        {r.type} · {statusLabel(r)}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-slate-700 transition-colors hover:bg-slate-100"
                      aria-label={`Show ${r.name} on map`}
                      title="Show on map"
                      onClick={() => selectResource(r.id)}
                    >
                      <MapPin className="h-5 w-5" strokeWidth={1.75} />
                    </button>
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

export default function ResourcesPage() {
  return (
    <Suspense fallback={<div className="ops-loading">Loading resources…</div>}>
      <ResourcesPageInner />
    </Suspense>
  );
}
