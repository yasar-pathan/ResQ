"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Ambulance,
  Building2,
  ChevronDown,
  MapPin,
  Plus,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { OpsMapDynamic } from "@/components/maps/OpsMapDynamic";
import { resourceStatusColor } from "@/components/maps/mapStyles";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { HoverCard } from "@/components/ui/HoverCard";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
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
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const isDispatcher = user?.role === "dispatcher";
  const canManage = isAdmin || isDispatcher;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "";
  const selectedId = searchParams.get("selected");
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof RESOURCE_TYPES)[number]>("team");
  const [lat, setLat] = useState("23.0225");
  const [lng, setLng] = useState("72.5714");
  const [locating, setLocating] = useState(false);
  const [creating, setCreating] = useState(false);

  const GUJARAT_PRESETS = [
    { label: "Ahmedabad", lat: "23.0225", lng: "72.5714" },
    { label: "Gandhinagar", lat: "23.2156", lng: "72.6369" },
    { label: "Surat", lat: "21.1702", lng: "72.8311" },
    { label: "Vadodara", lat: "22.3072", lng: "73.1812" },
    { label: "Rajkot", lat: "22.3039", lng: "70.8022" },
  ];

  const handleGetGPS = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast({ title: "GPS Unavailable", description: "Browser geolocation not supported.", variant: "error" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLng(pos.coords.longitude.toFixed(4));
        setLocating(false);
        toast({
          title: "GPS Acquired",
          description: `Location set to ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          variant: "success",
        });
      },
      (err) => {
        setLocating(false);
        toast({ title: "GPS Acquisition Failed", description: err.message, variant: "error" });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

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
    setLoading(true);
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
      const msg = err instanceof ApiError ? err.message : "Failed to load resources";
      setError(msg);
      toast({ title: "Failed to load resources", description: msg, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [getToken, refreshSession, statusFilter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token || !canManage) return;
    setMessage(null);
    setCreating(true);
    try {
      await createResource(token, {
        type,
        name,
        location: { latitude: Number(lat), longitude: Number(lng) },
      });
      const msg = `Created resource: ${name}`;
      setMessage(msg);
      toast({ title: "Resource Added", description: msg, variant: "success" });
      setName("");
      setAddDialogOpen(false);
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Create failed";
      setError(msg);
      toast({ title: "Create failed", description: msg, variant: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function onDeactivate(id: string) {
    const token = getToken();
    if (!token || !canManage) return;
    try {
      await updateResource(token, id, { is_active: false });
      setMessage("Resource deactivated");
      toast({
        title: "Resource deactivated",
        description: "Unit marked inactive.",
        variant: "info",
      });
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Update failed";
      setError(msg);
      toast({ title: "Update failed", description: msg, variant: "error" });
    }
  }

  const [addDialogOpen, setAddDialogOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 md:text-2xl">Emergency Resources</h1>
          <p className="text-sm text-muted">
            Fleet inventory and live tactical deployment · {items.length} units registered
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-control border border-border bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="Resource status filter"
              >
                <span>
                  {statusFilter === "available"
                    ? "Status: Available"
                    : statusFilter === "assigned"
                    ? "Status: Assigned"
                    : statusFilter === "unavailable"
                    ? "Status: Unavailable"
                    : "Status: All"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-surface">
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                <DropdownMenuRadioItem value="">All statuses</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="available">Available</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="assigned">Assigned</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="unavailable">Unavailable</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Resource Trigger Button */}
          {canManage ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="inline-flex items-center gap-1.5 font-semibold shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Deploy Resource</span>
            </Button>
          ) : null}
        </div>
      </header>

      {error ? <p className="form-error shrink-0">{error}</p> : null}
      {message ? <p className="form-success shrink-0">{message}</p> : null}

      {/* Modern Add Resource Modal Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="w-[min(94vw,520px)] p-6 bg-white shadow-2xl rounded-2xl border border-slate-200">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold text-slate-900">
                Deploy Emergency Resource
              </DialogTitle>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                {isAdmin ? "Admin Console" : "Dispatcher Console"}
              </span>
            </div>
            <DialogDescription className="text-xs text-muted">
              Register a new response squad, advanced life support ambulance, or disaster equipment.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onCreate} className="space-y-4 pt-2">
            {/* Resource Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Resource Name</label>
              <input
                className="field w-full"
                placeholder="e.g. Ahmedabad SDRF Rapid Team 2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Resource Type Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Unit Classification</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RESOURCE_TYPES.map((t) => {
                  const Icon = TYPE_ICONS[t];
                  const active = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-xs font-semibold transition-all",
                        active
                          ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30"
                          : "border-border bg-slate-50/50 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="capitalize">{t}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location & Coordinates Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Deployment Coordinates</span>
                <button
                  type="button"
                  onClick={handleGetGPS}
                  disabled={locating}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {locating ? "Acquiring GPS…" : "Use My GPS"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted block mb-1">Latitude</label>
                  <input
                    className="field w-full text-xs"
                    placeholder="23.0225"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted block mb-1">Longitude</label>
                  <input
                    className="field w-full text-xs"
                    placeholder="72.5714"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Gujarat Presets */}
              <div className="pt-1">
                <span className="text-[10px] font-medium text-slate-500 block mb-1">
                  Gujarat Municipality Anchors:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {GUJARAT_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setLat(p.lat);
                        setLng(p.lng);
                      }}
                      className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-2xs hover:bg-slate-100 hover:border-slate-300 transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={creating}
                className="font-semibold shadow-sm"
              >
                Register Resource
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Main Grid: Left Map + Right Full-Height Scrollable Resource Inventory */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_minmax(320px,400px)]">
        {/* Left: Map */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-base font-bold">Tactical Map</h2>
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

        {/* Right: Full-Height Smooth-Scrollable Fleet List */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-xs">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Fleet Units</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {items.length}
              </span>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={() => setAddDialogOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Add New
              </button>
            ) : null}
          </div>

          <ScrollArea
            className="min-h-0 flex-1"
            type="always"
            withFade
            hideScrollbar={false}
          >
            {loading ? (
              <div className="space-y-3 p-3.5 pb-12">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && (
              <ul className="space-y-2 p-3 pb-16">
                {items.length === 0 ? (
                  <li className="p-8 text-center text-sm text-muted">
                    No resources match this status filter.
                  </li>
                ) : (
                  items.map((r) => {
                    const isSelected = selectedId === r.id;
                    const statusColor = resourceStatusColor(r);
                    const isAvailable = r.is_active && r.status === "available";
                    return (
                      <li
                        key={r.id}
                        className={cn(
                          "group relative flex items-center justify-between gap-3 rounded-xl border p-3 transition-all duration-150",
                          isSelected
                            ? "border-primary bg-blue-50/40 ring-1 ring-primary/30 shadow-xs"
                            : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs",
                        )}
                      >
                        {/* Left: Type Icon with Status Dot */}
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                              isAvailable
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : r.status === "assigned"
                                ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                                : "bg-slate-100 text-slate-600 border border-slate-200",
                            )}
                          >
                            <TypeIcon type={r.type} />
                          </div>

                          {/* Info Area (Clickable to select and center on map) */}
                          <button
                            type="button"
                            className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
                            onClick={() => selectResource(r.id)}
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-xs text-slate-900 leading-snug truncate group-hover:text-primary transition-colors">
                                {r.name}
                              </p>
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold uppercase"
                                style={{
                                  backgroundColor: `${statusColor}18`,
                                  color: statusColor,
                                }}
                              >
                                <span
                                  className="inline-block h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: statusColor }}
                                />
                                {statusLabel(r)}
                              </span>
                            </div>
                            <p className="text-[11px] capitalize text-slate-500 mt-0.5">
                              {r.type} · Lat {r.location.latitude.toFixed(4)}, Lng {r.location.longitude.toFixed(4)}
                            </p>
                          </button>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Tooltip tip={`Focus on map`}>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                              aria-label={`Focus ${r.name} on map`}
                              onClick={() => selectResource(r.id)}
                            >
                              <MapPin className="h-4 w-4" />
                            </button>
                          </Tooltip>

                          {canManage && r.is_active !== false ? (
                            <Tooltip tip="Mark inactive">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8 px-2 text-[11px] font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
                                onClick={() => void onDeactivate(r.id)}
                              >
                                Deactivate
                              </Button>
                            </Tooltip>
                          ) : null}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </ScrollArea>
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
