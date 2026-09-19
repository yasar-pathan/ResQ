import Link from "next/link";

export default function NotFound() {
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
          404
        </p>
        <h1 className="hero-title" style={{ fontSize: "2rem" }}>
          RescueGrid
        </h1>
        <p className="muted">This page could not be found.</p>
        <p style={{ marginTop: "1.5rem" }}>
          <Link className="btn btn-primary" href="/">
            Home
          </Link>{" "}
          <Link className="btn btn-ghost" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
