"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { IncidentListItem, ResourceItem } from "@/lib/api/client";
import { priorityColor, resourceStatusColor } from "@/components/maps/mapStyles";

/** India geographic center — empty ops maps frame the country first. */
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;
const FOCUS_ZOOM = 15;

function tileUrl(): string {
  return process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
}

function circleIcon(color: string, selected = false): L.DivIcon {
  const size = selected ? 18 : 14;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
  });
}

function squareIcon(color: string, selected = false): L.DivIcon {
  const size = selected ? 18 : 14;
  const ring = selected ? "box-shadow:0 0 0 3px rgba(30,58,138,.45),0 1px 4px rgba(0,0,0,.35)" : "box-shadow:0 1px 4px rgba(0,0,0,.35)";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:3px;background:${color};border:2px solid #fff;${ring}"></span>`,
  });
}

export function FitBounds({
  points,
  selectedId,
}: {
  points: Array<{ id: string; lat: number; lng: number }>;
  selectedId?: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (selectedId) {
      const sel = points.find((p) => p.id === selectedId);
      if (sel) {
        const targetZoom = Math.max(map.getZoom(), FOCUS_ZOOM);
        map.flyTo([sel.lat, sel.lng], targetZoom, { duration: 1.1, easeLinearity: 0.25 });
        return;
      }
    }
    if (points.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.2));
  }, [map, points, selectedId]);
  return null;
}

export type OpsMapProps = {
  incidents?: IncidentListItem[];
  resources?: ResourceItem[];
  showIncidents?: boolean;
  showResources?: boolean;
  selectedId?: string | null;
  onSelectIncident?: (id: string) => void;
  onSelectResource?: (id: string) => void;
  className?: string;
  height?: string;
};

export function OpsMap({
  incidents = [],
  resources = [],
  showIncidents = true,
  showResources = true,
  selectedId = null,
  onSelectIncident,
  onSelectResource,
  className = "",
  height = "100%",
}: OpsMapProps) {
  const points = useMemo(() => {
    const list: Array<{ id: string; lat: number; lng: number }> = [];
    if (showIncidents) {
      for (const inc of incidents) {
        list.push({ id: inc.id, lat: inc.location.latitude, lng: inc.location.longitude });
      }
    }
    if (showResources) {
      for (const r of resources) {
        list.push({ id: r.id, lat: r.location.latitude, lng: r.location.longitude });
      }
    }
    return list;
  }, [incidents, resources, showIncidents, showResources]);

  return (
    <div className={`ops-leaflet-map overflow-hidden rounded-panel border border-border ${className}`} style={{ height, minHeight: 280 }}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url={tileUrl()} />
        <FitBounds points={points} selectedId={selectedId} />
        {showIncidents
          ? incidents.map((inc) => (
              <Marker
                key={inc.id}
                position={[inc.location.latitude, inc.location.longitude]}
                icon={circleIcon(priorityColor(inc.priority), selectedId === inc.id)}
                eventHandlers={{
                  click: () => onSelectIncident?.(inc.id),
                }}
              >
                <Popup>
                  <strong>{inc.tracking_ref}</strong>
                  <br />
                  {inc.category.replaceAll("_", " ")} · {inc.priority ?? "—"}
                </Popup>
              </Marker>
            ))
          : null}
        {showResources
          ? resources.map((r) => (
              <Marker
                key={r.id}
                position={[r.location.latitude, r.location.longitude]}
                icon={squareIcon(resourceStatusColor(r), selectedId === r.id)}
                eventHandlers={{
                  click: () => onSelectResource?.(r.id),
                }}
              >
                <Popup>
                  <strong>{r.name}</strong>
                  <br />
                  {r.type} · {r.is_active === false ? "inactive" : r.status}
                </Popup>
              </Marker>
            ))
          : null}
      </MapContainer>
    </div>
  );
}
