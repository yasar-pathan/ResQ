"use client";

import Link from "next/link";
import { BrandMark } from "@/components/layout/BrandMark";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="auth-page">
      <div className="auth-panel animate-enter" style={{ textAlign: "center" }}>
        <p className="home-eyebrow">Something went wrong</p>
        <BrandMark href="/" size={48} />
        <p className="muted" style={{ marginTop: "1rem" }}>
          {error.message || "An unexpected error occurred."}
        </p>
        <p style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link className="btn btn-secondary" href="/">
            Home
          </Link>
        </p>
      </div>
    </div>
  );
}
