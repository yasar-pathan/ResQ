"use client";

import L from "leaflet";
import { useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const pin = L.divIcon({
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: `<span style="display:block;width:16px;height:16px;border-radius:999px;background:#1e3a8a;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
});

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPickerMap({
  latitude,
  longitude,
  onPick,
}: {
  latitude: number | null;
  longitude: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const [center] = useState<[number, number]>(() =>
    latitude != null && longitude != null ? [latitude, longitude] : [20.5937, 78.9629],
  );
  const url =
    process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <MapContainer center={center} zoom={13} style={{ height: 280, width: "100%" }} scrollWheelZoom>
      <TileLayer attribution="&copy; OSM" url={url} />
      <ClickHandler onPick={onPick} />
      {latitude != null && longitude != null ? (
        <Marker position={[latitude, longitude]} icon={pin} />
      ) : null}
    </MapContainer>
  );
}
