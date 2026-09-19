"use client";

import dynamic from "next/dynamic";
import { MapPinned, Navigation } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { getCurrentPosition } from "@/lib/geo";

const PickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted">Loading map…</div>
  ),
});

type Props = {
  latitude: string;
  longitude: string;
  onChange: (lat: string, lng: string) => void;
  onHint?: (msg: string) => void;
  error?: string;
};

export function LocationPicker({ latitude, longitude, onChange, onHint, error }: Props) {
  const [open, setOpen] = useState(false);
  const [draftLat, setDraftLat] = useState<number | null>(null);
  const [draftLng, setDraftLng] = useState<number | null>(null);
  const [locBusy, setLocBusy] = useState(false);

  const hasLocation = latitude.trim() !== "" && longitude.trim() !== "";

  async function captureMyLocation() {
    setLocBusy(true);
    onHint?.("Getting location…");
    const result = await getCurrentPosition();
    setLocBusy(false);
    if (result.ok) {
      onChange(String(result.latitude), String(result.longitude));
      onHint?.("Location captured from your device.");
    } else {
      onHint?.("Could not get location. Use Select on map instead.");
    }
  }

  function openMap() {
    setDraftLat(hasLocation ? Number(latitude) : null);
    setDraftLng(hasLocation ? Number(longitude) : null);
    setOpen(true);
  }

  function confirmMap() {
    if (draftLat == null || draftLng == null) return;
    onChange(String(draftLat), String(draftLng));
    onHint?.("Location set from map.");
    setOpen(false);
  }

  return (
    <div className="stack" style={{ gap: "0.75rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <Button type="button" variant="secondary" onClick={() => void captureMyLocation()} disabled={locBusy}>
          <Navigation className="h-4 w-4" aria-hidden />
          {locBusy ? "Locating…" : "Use my location"}
        </Button>
        <Button type="button" variant="secondary" onClick={openMap}>
          <MapPinned className="h-4 w-4" aria-hidden />
          Select on map
        </Button>
      </div>
      {hasLocation ? (
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Location set ({Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)})
        </p>
      ) : (
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          No location yet — use your device or pick a point on the map.
        </p>
      )}
      {error ? <p className="field-error">{error}</p> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select location</DialogTitle>
            <DialogDescription>Tap the map to place a marker, then confirm.</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-control border border-border">
            {open ? (
              <PickerMap
                latitude={draftLat}
                longitude={draftLng}
                onPick={(lat, lng) => {
                  setDraftLat(lat);
                  setDraftLng(lng);
                }}
              />
            ) : null}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={draftLat == null || draftLng == null} onClick={confirmMap}>
              Use this location
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
