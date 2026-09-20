"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { IncidentListItem, ResourceItem } from "@/lib/api/client";
import { priorityColor, resourceStatusColor } from "@/components/maps/mapStyles";
import {
  INDIA_CENTER,
  INDIA_DEFAULT_ZOOM,
  INDIA_FOCUS_ZOOM,
  INDIA_MAP_PROPS,
  isInIndia,
} from "@/lib/maps/india";

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

function dispatcherMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: "dispatcher-pulse-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      <span style="position:absolute;inset:0;border-radius:999px;background:rgba(37,99,235,0.3);box-shadow:0 0 12px rgba(37,99,235,0.6);animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></span>
      <span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:999px;background:#1d4ed8;border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.35);color:#fff;font-size:12px;font-weight:bold;">📍</span>
    </div>`,
  });
}

export function FitBounds({
  points,
  selectedId,
  dispatcherLocation,
  radiusKm,
}: {
  points: Array<{ id: string; lat: number; lng: number }>;
  selectedId?: string | null;
  dispatcherLocation?: { latitude: number; longitude: number } | null;
  radiusKm?: number | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (selectedId) {
      const sel = points.find((p) => p.id === selectedId);
      if (sel) {
        const targetZoom = Math.max(map.getZoom(), INDIA_FOCUS_ZOOM);
        map.flyTo([sel.lat, sel.lng], targetZoom, { duration: 1.1, easeLinearity: 0.25 });
        return;
      }
    }

    // When dispatcher location is provided, automatically focus near the dispatcher
    if (dispatcherLocation && isInIndia(dispatcherLocation.latitude, dispatcherLocation.longitude)) {
      if (radiusKm) {
        const latOffset = radiusKm / 111.0;
        const lngOffset = radiusKm / (111.0 * Math.cos((dispatcherLocation.latitude * Math.PI) / 180));
        const radiusBounds = L.latLngBounds([
          [dispatcherLocation.latitude - latOffset, dispatcherLocation.longitude - lngOffset],
          [dispatcherLocation.latitude + latOffset, dispatcherLocation.longitude + lngOffset],
        ]);
        map.fitBounds(radiusBounds.pad(0.08), { animate: true });
        return;
      } else {
        map.setView([dispatcherLocation.latitude, dispatcherLocation.longitude], 11);
        return;
      }
    }

    if (points.length === 0) {
      map.setView(INDIA_CENTER, INDIA_DEFAULT_ZOOM);
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], INDIA_FOCUS_ZOOM);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.2));
  }, [map, points, selectedId, dispatcherLocation, radiusKm]);
  return null;
}

function RecenterDispatcherButton({
  dispatcherLocation,
  radiusKm,
}: {
  dispatcherLocation?: { latitude: number; longitude: number } | null;
  radiusKm?: number | null;
}) {
  const map = useMap();
  if (!dispatcherLocation || !isInIndia(dispatcherLocation.latitude, dispatcherLocation.longitude)) {
    return null;
  }
  const handleClick = () => {
    if (radiusKm) {
      const latOffset = radiusKm / 111.0;
      const lngOffset = radiusKm / (111.0 * Math.cos((dispatcherLocation.latitude * Math.PI) / 180));
      const radiusBounds = L.latLngBounds([
        [dispatcherLocation.latitude - latOffset, dispatcherLocation.longitude - lngOffset],
        [dispatcherLocation.latitude + latOffset, dispatcherLocation.longitude + lngOffset],
      ]);
      map.flyToBounds(radiusBounds.pad(0.08), { duration: 0.8 });
    } else {
      map.flyTo([dispatcherLocation.latitude, dispatcherLocation.longitude], 11, { duration: 0.8 });
    }
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: "auto", margin: "10px" }}>
      <div className="leaflet-control">
        <button
          type="button"
          onClick={handleClick}
          className="flex items-center gap-1.5 rounded-control border border-blue-300 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-blue-700 shadow-md backdrop-blur-sm transition hover:bg-blue-50 active:scale-95"
          title="Zoom to Dispatcher Vicinity"
        >
          <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
          Focus Near Me
        </button>
      </div>
    </div>
  );
}

export type OpsMapProps = {
  incidents?: IncidentListItem[];
  resources?: ResourceItem[];
  showIncidents?: boolean;
  showResources?: boolean;
  selectedId?: string | null;
  dispatcherLocation?: { latitude: number; longitude: number } | null;
  radiusKm?: number | null;
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
  dispatcherLocation = null,
  radiusKm = null,
  onSelectIncident,
  onSelectResource,
  className = "",
  height = "100%",
}: OpsMapProps) {
  const points = useMemo(() => {
    const list: Array<{ id: string; lat: number; lng: number }> = [];
    if (showIncidents) {
      for (const inc of incidents) {
        const { latitude: lat, longitude: lng } = inc.location;
        if (isInIndia(lat, lng)) list.push({ id: inc.id, lat, lng });
      }
    }
    if (showResources) {
      for (const r of resources) {
        const { latitude: lat, longitude: lng } = r.location;
        if (isInIndia(lat, lng)) list.push({ id: r.id, lat, lng });
      }
    }
    if (dispatcherLocation && isInIndia(dispatcherLocation.latitude, dispatcherLocation.longitude)) {
      list.push({ id: "dispatcher-hq", lat: dispatcherLocation.latitude, lng: dispatcherLocation.longitude });
    }
    return list;
  }, [incidents, resources, showIncidents, showResources, dispatcherLocation]);

  return (
    <div className={`ops-leaflet-map overflow-hidden rounded-panel border border-border ${className}`} style={{ height, minHeight: 280 }}>
      <MapContainer
        center={dispatcherLocation ? [dispatcherLocation.latitude, dispatcherLocation.longitude] : INDIA_CENTER}
        zoom={dispatcherLocation ? 11 : INDIA_DEFAULT_ZOOM}
        scrollWheelZoom
        {...INDIA_MAP_PROPS}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url={tileUrl()} />
        <FitBounds
          points={points}
          selectedId={selectedId}
          dispatcherLocation={dispatcherLocation}
          radiusKm={radiusKm}
        />
        <RecenterDispatcherButton
          dispatcherLocation={dispatcherLocation}
          radiusKm={radiusKm}
        />
        {/* Dispatcher Location Marker & Near-Me Coverage Circle */}
        {dispatcherLocation && isInIndia(dispatcherLocation.latitude, dispatcherLocation.longitude) ? (
          <>
            {radiusKm ? (
              <Circle
                center={[dispatcherLocation.latitude, dispatcherLocation.longitude]}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: "#2563eb",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.08,
                  weight: 1.5,
                  dashArray: "4, 6",
                }}
              />
            ) : null}
            <Marker
              position={[dispatcherLocation.latitude, dispatcherLocation.longitude]}
              icon={dispatcherMarkerIcon()}
            >
              <Popup>
                <div style={{ minWidth: 150, padding: 2 }}>
                  <strong style={{ color: "#1d4ed8", fontSize: 13, display: "block", marginBottom: 2 }}>
                    📍 Dispatcher Location
                  </strong>
                  <div style={{ fontSize: 11, color: "#475569" }}>
                    Lat: {dispatcherLocation.latitude.toFixed(4)}
                    <br />
                    Lng: {dispatcherLocation.longitude.toFixed(4)}
                    {radiusKm ? (
                      <div style={{ marginTop: 4, fontWeight: 600, color: "#2563eb" }}>
                        Active Range: {radiusKm} km radius
                      </div>
                    ) : (
                      <div style={{ marginTop: 4, color: "#64748b" }}>Showing all incidents</div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        ) : null}

        {showIncidents
          ? incidents
              .filter((inc) => isInIndia(inc.location.latitude, inc.location.longitude))
              .map((inc) => (
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
          ? resources
              .filter((r) => isInIndia(r.location.latitude, r.location.longitude))
              .map((r) => (
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
