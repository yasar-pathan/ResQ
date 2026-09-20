"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { ApiError, getApiBaseUrl, type UserPublic } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

export default function UsersSettingsPage() {
  const { getToken } = useAuth();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("dispatcher");

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/users`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new ApiError(res.status, "error", body.error?.message ?? "Failed");
      }
      setUsers(body.data.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load users");
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setMessage(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ name, email, password, role }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new ApiError(res.status, "error", body.error?.message ?? "Create failed");
      }
      setMessage(`Created ${email}`);
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    }
  }

  return (
    <div className="stack" style={{ gap: "1.5rem", maxWidth: 720 }}>
      <header>
        <h1>User management</h1>
        <p className="muted">Admin-only: create dispatcher, field, or admin accounts</p>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}
      <form className="stack" onSubmit={onCreate}>
        <input className="field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          className="field"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="field"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 w-full items-center justify-between rounded-control border border-border bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <span className="capitalize">
                {role === "field_team" ? "Field team" : role}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-surface">
            <DropdownMenuRadioGroup value={role} onValueChange={setRole}>
              <DropdownMenuRadioItem value="dispatcher">Dispatcher</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="field_team">Field team</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <button className="btn btn-primary" type="submit">
          Create user
        </button>
      </form>
      <ul className="field-list">
        {users.map((u) => (
          <li key={u.id} className="field-card">
            <strong>{u.name}</strong>
            <span className="muted">
              {u.email} · {u.role}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
