"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ApiError, registerCitizen } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await registerCitizen({
        name,
        email,
        password,
        phone: phone.trim() || undefined,
      });
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <p
          className="muted"
          style={{
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontSize: "0.8rem",
          }}
        >
          Citizen account
        </p>
        <h1 className="hero-title" style={{ fontSize: "2rem" }}>
          RescueGrid
        </h1>
        <p className="muted">Create an account to report incidents with your profile.</p>
        <form className="stack" style={{ gap: "1rem", marginTop: "1.5rem" }} onSubmit={onSubmit}>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span>Phone (optional)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              placeholder="+919876543210"
              autoComplete="tel"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: "1.5rem", fontSize: "0.9rem" }}>
          Already registered? <Link href="/login">Sign in</Link>
          {" · "}
          <Link href="/">Home</Link>
        </p>
      </div>
    </div>
  );
}
