import Link from "next/link";
import { BrandMark } from "@/components/layout/BrandMark";

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-panel animate-enter" style={{ textAlign: "center" }}>
        <p className="home-eyebrow">404</p>
        <BrandMark href="/" size={48} />
        <p className="muted" style={{ marginTop: "1rem" }}>
          This page could not be found.
        </p>
        <p style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <Link className="btn btn-primary" href="/">
            Home
          </Link>
          <Link className="btn btn-secondary" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
