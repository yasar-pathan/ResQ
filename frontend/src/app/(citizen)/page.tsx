import Link from "next/link";

export default function HomePage() {
  return (
    <section className="stack" style={{ gap: "2rem" }}>
      <div className="stack">
        <p className="muted" style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.8rem" }}>
          Emergency coordination
        </p>
        <h1 className="hero-title">RescueGrid</h1>
        <p className="muted">
          Report an emergency or send an SOS. Your location helps responders reach you faster.
        </p>
      </div>
      <div className="cta-row">
        <Link href="/report" className="btn btn-primary" style={{ flex: 1 }}>
          Report an incident
        </Link>
        <Link href="/sos" className="btn btn-sos" style={{ flex: 1 }}>
          <span aria-hidden="true">●</span>
          SOS
        </Link>
      </div>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        Dispatcher or field team? <Link href="/login">Operator sign-in</Link>
        {" · "}
        <Link href="/register">Create citizen account</Link>
      </p>
    </section>
  );
}
