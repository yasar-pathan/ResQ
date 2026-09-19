"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createResource,
  listResources,
  updateResource,
  type ResourceItem,
} from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

const RESOURCE_TYPES = ["team", "vehicle", "equipment", "facility"] as const;

export default function ResourcesPage() {
  const { getToken, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof RESOURCE_TYPES)[number]>("team");
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await listResources(token, { active_only: false });
      setItems(data.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load resources");
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token || !isAdmin) return;
    setMessage(null);
    try {
      await createResource(token, {
        type,
        name,
        location: { latitude: Number(lat), longitude: Number(lng) },
      });
      setMessage(`Created ${name}`);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    }
  }

  async function onDeactivate(id: string) {
    const token = getToken();
    if (!token || !isAdmin) return;
    try {
      await updateResource(token, id, { is_active: false });
      setMessage("Resource deactivated");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <header>
        <h1>Resources</h1>
        <p className="muted">Inventory of response units available for assignment</p>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      {isAdmin ? (
        <form className="stack" style={{ maxWidth: 520, gap: "0.75rem" }} onSubmit={onCreate}>
          <h2 style={{ fontSize: "1.1rem" }}>Add resource</h2>
          <input
            className="field"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select className="field" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="filter-row">
            <input
              className="field"
              placeholder="Latitude"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
            />
            <input
              className="field"
              placeholder="Longitude"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Create
          </button>
        </form>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Location</th>
              {isAdmin ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="muted">
                  No resources yet.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.type}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.location.latitude.toFixed(4)}, {r.location.longitude.toFixed(4)}
                  </td>
                  {isAdmin ? (
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => void onDeactivate(r.id)}>
                        Deactivate
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
