"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="auth-page">
      <div className="auth-panel" style={{ textAlign: "center" }}>
        <p
          className="muted"
          style={{
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontSize: "0.8rem",
          }}
        >
          Something went wrong
        </p>
        <h1 className="hero-title" style={{ fontSize: "2rem" }}>
          RescueGrid
        </h1>
        <p className="muted">{error.message || "An unexpected error occurred."}</p>
        <p style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link className="btn btn-ghost" href="/">
            Home
          </Link>
        </p>
      </div>
    </div>
  );
}
