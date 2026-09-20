"use client";

import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { INDIA_FOCUS_ZOOM, INDIA_MAP_PROPS } from "@/lib/maps/india";

const pin = L.divIcon({
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: `<span style="display:block;width:16px;height:16px;border-radius:999px;background:#1e3a8a;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
});

export default function MiniMapInner({ lat, lng }: { lat: number; lng: number }) {
  const url =
    process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={INDIA_FOCUS_ZOOM}
      style={{ height: 280, width: "100%" }}
      scrollWheelZoom={false}
      {...INDIA_MAP_PROPS}
    >
      <TileLayer attribution="&copy; OSM" url={url} />
      <Marker position={[lat, lng]} icon={pin} />
    </MapContainer>
  );
}
