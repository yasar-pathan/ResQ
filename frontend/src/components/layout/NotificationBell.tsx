"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { listAlerts, type AlertItem } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = await listAlerts(token, { status: "active" });
      setAlerts(data.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const preview = alerts.slice(0, 5);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-control border-0 bg-transparent text-black transition-all duration-150 hover:shadow-sm focus:outline-none"
          aria-label={`Alerts${alerts.length ? `, ${alerts.length} active` : ""}`}
        >
          <Bell className="h-5 w-5 text-black" strokeWidth={1.75} />
          {alerts.length > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-sos px-1 text-[11px] font-bold text-white shadow-sm">
              {alerts.length > 99 ? "99+" : alerts.length}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="mb-2 flex items-center justify-between gap-2">
          <strong className="text-sm">Active alerts</strong>
          <span className="text-xs text-muted">{alerts.length}</span>
        </div>
        {loading && preview.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Loading…</p>
        ) : null}
        {!loading && preview.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">No active alerts</p>
        ) : null}
        <ScrollArea className="max-h-72" withFade>
          <ul className="space-y-2 pr-2 pb-6">
            {preview.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/alerts?status=active&focus=${encodeURIComponent(a.id)}`}
                  className="block rounded-control border border-border bg-slate-50 p-2 no-underline transition-colors hover:border-primary hover:bg-white"
                  onClick={() => setOpen(false)}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                    {a.type.replaceAll("_", " ")}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-800">{a.message}</p>
                  <p className="mt-1 text-xs text-muted">{relativeTime(a.created_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <div className="mt-3 border-t border-border pt-3">
          <Link href="/alerts" className="btn btn-primary btn-sm w-full" onClick={() => setOpen(false)}>
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
