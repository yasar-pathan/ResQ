"use client";

import { ChevronDown } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StatusPill } from "@/components/domain/StatusPill";
import { LocationMapDialog } from "@/components/maps/LocationMapDialog";
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from "@/components/ui/Collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { acknowledgeAlert, ApiError, listAlerts, type AlertItem } from "@/lib/api/client";
import { useAuth, withAuthRetry } from "@/lib/auth";
import { cn } from "@/lib/utils";

function AlertsPageInner() {
  const { getToken, refreshSession } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "active";
  const focusId = searchParams.get("focus");
  const [items, setItems] = useState<AlertItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const focusRef = useRef<HTMLLIElement | null>(null);

  const setStatusFilter = useCallback(
    (value: string) => {
      const qs = new URLSearchParams(searchParams.toString());
      if (value) qs.set("status", value);
      else qs.delete("status");
      const next = qs.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await withAuthRetry(getToken, refreshSession, (token) =>
        listAlerts(token, {
          status: statusFilter || undefined,
        }),
      );
      setItems(data.items);
      setError(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load alerts";
      setError(msg);
      toast({ title: "Failed to load alerts", description: msg, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [getToken, refreshSession, statusFilter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusId || loading) return;
    const t = window.setTimeout(() => {
      focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [focusId, loading, items]);

  async function onAck(id: string) {
    setBusyId(id);
    try {
      await withAuthRetry(getToken, refreshSession, (token) => acknowledgeAlert(token, id));
      toast({
        title: "Alert acknowledged",
        description: "The alert has been marked as acknowledged.",
        variant: "success",
      });
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Acknowledge failed";
      setError(msg);
      toast({ title: "Acknowledge failed", description: msg, variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  const byType = items.reduce<Record<string, AlertItem[]>>((acc, a) => {
    (acc[a.type] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="alerts-page flex h-full min-h-0 flex-col overflow-hidden">
      <header className="alerts-page-header shrink-0">
        <div>
          <h1 className="font-display text-xl font-bold md:text-2xl">Alerts</h1>
          <p className="text-sm text-muted">Critical, delayed-response, and escalation alerts</p>
        </div>
        <div className="alerts-filter-row">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-control border border-border bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="Alert status filter"
              >
                <span>
                  {statusFilter === "active"
                    ? "Status: Active only"
                    : statusFilter === "acknowledged"
                    ? "Status: Acknowledged"
                    : "Status: All"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-surface">
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                <DropdownMenuRadioItem value="active">Active only</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="acknowledged">Acknowledged</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="">All statuses</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {error ? <p className="form-error shrink-0">{error}</p> : null}

      <ScrollArea className="alerts-scroll min-h-0 flex-1" withFade hideScrollbar>
        <div className="space-y-4 px-2 py-3 pb-12">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="alert-card flex items-start justify-between gap-3 p-4 shadow-sm"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-24 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Skeleton className="h-9 w-16 rounded-control" />
                    <Skeleton className="h-9 w-24 rounded-control" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!loading && items.length === 0 && !error ? (
            <p className="empty-state">
              {statusFilter === "active"
                ? "No active alerts — all clear."
                : "No alerts match this filter."}
            </p>
          ) : null}

          {!loading &&
            Object.entries(byType).map(([type, group]) => (
              <CollapsibleRoot key={type} defaultOpen className="stack gap-2">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group flex w-full cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-left"
                  >
                    <h2 className="flex items-center gap-2 text-base font-bold capitalize">
                      {type.replaceAll("_", " ")}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-muted">
                        {group.length}
                      </span>
                    </h2>
                    <ChevronDown className="h-4 w-4 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="alert-list space-y-2">
                    {group.map((a) => (
                      <li
                        key={a.id}
                        id={`alert-${a.id}`}
                        ref={focusId === a.id ? focusRef : undefined}
                        className={cn(
                          "alert-card",
                          focusId === a.id && "ring-2 ring-primary ring-offset-2",
                        )}
                      >
                        <div>
                          <div className="alert-card-top">
                            <span className="alert-type-label">{a.type.replaceAll("_", " ")}</span>
                            <StatusPill status={a.status} />
                            {a.priority ? (
                              <span className={`prio prio-${a.priority}`}>{a.priority}</span>
                            ) : null}
                          </div>
                          <p className="alert-card-message">{a.message}</p>
                          <p className="alert-card-meta">
                            {new Date(a.created_at).toLocaleString()}
                            {a.tracking_ref ? ` · ${a.tracking_ref}` : null}
                            {a.category ? ` · ${a.category.replaceAll("_", " ")}` : null}
                          </p>
                        </div>
                        <div className="alert-card-actions">
                          <Tooltip tip="View alert location on map">
                            <span>
                              <LocationMapDialog
                                latitude={a.location?.latitude}
                                longitude={a.location?.longitude}
                                label={a.tracking_ref ?? a.type.replaceAll("_", " ")}
                                embedded
                                details={
                                  a.location ? (
                                    <>
                                      <p>
                                        <strong>Type:</strong> {a.type.replaceAll("_", " ")}
                                      </p>
                                      <p>
                                        <strong>Status:</strong> {a.status}
                                      </p>
                                      {a.priority ? (
                                        <p>
                                          <strong>Priority:</strong> {a.priority}
                                        </p>
                                      ) : null}
                                      {a.category ? (
                                        <p>
                                          <strong>Category:</strong> {a.category.replaceAll("_", " ")}
                                        </p>
                                      ) : null}
                                      <p className="line-clamp-3 text-muted">{a.message}</p>
                                      <p className="text-xs text-muted">
                                        {new Date(a.created_at).toLocaleString()}
                                      </p>
                                    </>
                                  ) : undefined
                                }
                              />
                            </span>
                          </Tooltip>
                          {a.status === "active" ? (
                            <Tooltip tip="Acknowledge alert and notify dispatch">
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={busyId === a.id}
                                onClick={() => void onAck(a.id)}
                              >
                                {busyId === a.id ? "…" : "Acknowledge"}
                              </button>
                            </Tooltip>
                          ) : (
                            <span className="text-sm text-muted">Acknowledged</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </CollapsibleRoot>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="ops-loading">Loading alerts…</div>}>
      <AlertsPageInner />
    </Suspense>
  );
}
