"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { BrandMark } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { hardNavigate, postLoginPath } from "@/lib/postLogin";

function LoginForm() {
  const { login } = useAuth();
  const params = useSearchParams();
  const [email, setEmail] = useState("dispatcher@rescuegrid.dev");
  const [password, setPassword] = useState("ChangeMeOps123!");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get("error") === "unauthorized") {
      setError("You do not have access to that area. Sign in with an operator account.");
    }
  }, [params]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(email, password);
      const dest = postLoginPath(user.role, params.get("next"));
      hardNavigate(dest);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <div className="auth-page auth-page-split">
      <div className="auth-visual" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/media/ambulance-night-response.jpg" alt="" />
        <div className="auth-visual-caption">
          <BrandMark href="/" size={48} variant="light" />
          <p>Response anytime — coordinated, calm, ready.</p>
        </div>
      </div>
      <div className="auth-panel animate-enter">
        <p className="home-eyebrow">Operator access</p>
        <BrandMark href="/" size={40} />
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          Sign in to dispatch, alerts, or field assignments.
        </p>
        <form className="stack" style={{ gap: "1rem", marginTop: "1.5rem" }} onSubmit={onSubmit}>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="username"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <Button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="muted" style={{ marginTop: "1.5rem", fontSize: "0.9rem" }}>
          Citizen reporting? <Link href="/">Go to RescueGrid home</Link>
          {" · "}
          <Link href="/register">Create citizen account</Link>
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
