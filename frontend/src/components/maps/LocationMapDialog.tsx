"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";

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
}: {
  latitude: number;
  longitude: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border bg-surface text-primary transition hover:bg-slate-50"
          aria-label={label ? `View map for ${label}` : "View location on map"}
          title="View on map"
        >
          <MapPin className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label ?? "Location"}</DialogTitle>
          <DialogDescription>
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <div className="overflow-hidden rounded-control border border-border">
            <MiniMap lat={latitude} lng={longitude} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
