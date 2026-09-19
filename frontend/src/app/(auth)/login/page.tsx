"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("dispatcher@rescuegrid.dev");
  const [password, setPassword] = useState("ChangeMeOps123!");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(email, password);
      const next = params.get("next");
      if (user.role === "field_team") {
        router.replace(next?.startsWith("/field") ? next : "/field/assignments");
      } else {
        router.replace(next?.startsWith("/") ? next : "/dashboard");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <p className="muted" style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.8rem" }}>
          Operator access
        </p>
        <h1 className="hero-title" style={{ fontSize: "2rem" }}>
          RescueGrid
        </h1>
        <p className="muted">Sign in to dispatch, alerts, or field assignments.</p>
        <form className="stack" style={{ gap: "1rem", marginTop: "1.5rem" }} onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="username" />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: "1.5rem", fontSize: "0.9rem" }}>
          Citizen reporting? <Link href="/">Go to RescueGrid home</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="ops-loading">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
