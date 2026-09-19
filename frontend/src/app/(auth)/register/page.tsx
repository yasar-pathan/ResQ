"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
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
    <div className="auth-page auth-page-split">
      <div className="auth-visual" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/media/ambulance-night-response.jpg" alt="" />
        <div className="auth-visual-caption">
          <BrandMark href="/" size={48} variant="light" />
          <p>Create an account to report with your profile.</p>
        </div>
      </div>
      <div className="auth-panel animate-enter">
        <p className="home-eyebrow">Citizen account</p>
        <BrandMark href="/" size={40} />
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          Create an account to report incidents with your profile.
        </p>
        <form className="stack" style={{ gap: "1rem", marginTop: "1.5rem" }} onSubmit={onSubmit}>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </div>
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
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              placeholder="+919876543210"
              autoComplete="tel"
            />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </Button>
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
