"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  INDIA_CENTER,
  INDIA_DEFAULT_ZOOM,
  INDIA_MAP_PROPS,
  isInIndia,
} from "@/lib/maps/india";

export type HotspotPoint = { lat: number; lng: number; count: number };

function FitHotspots({ points }: { points: HotspotPoint[] }) {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => {
      map.invalidateSize();
      if (points.length === 0) {
        map.setView(INDIA_CENTER, INDIA_DEFAULT_ZOOM);
        return;
      }
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 11);
        return;
      }
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.3));
    }, 80);
    return () => window.clearTimeout(t);
  }, [map, points]);
  return null;
}

export default function HotspotsMap({
  points,
  height = 360,
}: {
  points: HotspotPoint[];
  height?: number | string;
}) {
  const inIndia = useMemo(() => points.filter((p) => isInIndia(p.lat, p.lng)), [points]);
  const maxCount = useMemo(() => Math.max(1, ...inIndia.map((p) => p.count)), [inIndia]);
  const url =
    process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div
      className="ops-hotspots-map overflow-hidden rounded-panel border border-border"
      style={{ height, minHeight: 420, width: "100%" }}
    >
      <MapContainer
        center={INDIA_CENTER}
        zoom={INDIA_DEFAULT_ZOOM}
        scrollWheelZoom
        {...INDIA_MAP_PROPS}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url={url} />
        <FitHotspots points={inIndia} />
        {inIndia.map((p) => {
          const radius = 10 + (p.count / maxCount) * 22;
          return (
            <CircleMarker
              key={`${p.lat}-${p.lng}`}
              center={[p.lat, p.lng]}
              radius={radius}
              pathOptions={{
                color: "#0f172a",
                fillColor: "#dc2626",
                fillOpacity: 0.65,
                weight: 2,
              }}
            >
              <Popup>
                <strong>
                  {p.lat.toFixed(2)}, {p.lng.toFixed(2)}
                </strong>
                <br />
                <span>
                  {p.count} incident{p.count === 1 ? "" : "s"} (anonymized bucket)
                </span>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
