"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";

const MiniMap = dynamic(() => import("./MiniMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted">Loading map…</div>
  ),
});

export function LocationMapDialog({
  latitude,
  longitude,
  label,
  description,
  details,
  embedded,
  disabled,
}: {
  latitude?: number | null;
  longitude?: number | null;
  label?: string;
  description?: string;
  details?: ReactNode;
  /** Borderless icon for dense list rows */
  embedded?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasCoords =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  if (disabled || !hasCoords) {
    return (
      <button
        type="button"
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-control text-slate-400",
          !embedded && "border border-border bg-surface",
        )}
        disabled
        aria-label="No location available"
        title="No location available"
      >
        <MapPin className="h-5 w-5" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-control text-primary transition-colors hover:bg-slate-100 hover:text-primary",
            !embedded && "border border-border bg-surface hover:bg-slate-50",
          )}
          aria-label={label ? `View map for ${label}` : "View location on map"}
          title="View on map"
        >
          <MapPin className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label ?? "Location"}</DialogTitle>
          <DialogDescription>
            {description ?? `${latitude!.toFixed(5)}, ${longitude!.toFixed(5)}`}
          </DialogDescription>
        </DialogHeader>
        {details ? <div className="space-y-1 text-sm text-slate-700">{details}</div> : null}
        {open ? (
          <div className="overflow-hidden rounded-control border border-border">
            <MiniMap lat={latitude!} lng={longitude!} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
