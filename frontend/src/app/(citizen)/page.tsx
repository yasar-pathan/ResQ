import Link from "next/link";
import { AlertTriangle, FileWarning } from "lucide-react";
import { BrandMark } from "@/components/layout/BrandMark";
import { InstallHint } from "@/components/layout/InstallHint";

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero" aria-label="RescueGrid">
        <div className="home-hero-media" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/help-desk-mobile.jpg" alt="" className="home-hero-img" />
          <div className="home-hero-veil" />
        </div>
        <div className="home-hero-brand">
          <BrandMark href="/" size={36} variant="light" />
        </div>
        <div className="home-hero-content animate-enter">
          <p className="home-eyebrow">Emergency coordination</p>
          <h1 className="home-brand">RescueGrid</h1>
          <p className="home-lead">
            Report an emergency or send an SOS. Your location helps responders reach you faster.
          </p>
          <div className="cta-row home-cta">
            <Link href="/report" className="btn btn-primary btn-lg">
              <FileWarning size={20} aria-hidden />
              Report an incident
            </Link>
            <Link href="/sos" className="btn btn-sos btn-lg">
              <AlertTriangle size={22} aria-hidden />
              SOS
            </Link>
          </div>
          <div className="home-hero-meta animate-enter-delay">
            <InstallHint />
          </div>
        </div>
        <p className="home-hero-links home-hero-links-centered animate-enter-delay">
          Dispatcher or field team? <Link href="/login">Operator sign-in</Link>
          {" · "}
          <Link href="/register">Create citizen account</Link>
        </p>
      </section>
    </div>
  );
}
