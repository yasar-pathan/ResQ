"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SOSButton } from "@/components/domain/SOSButton";
import { ApiError, createSos } from "@/lib/api/client";
import { getCurrentPosition } from "@/lib/geo";
import { SosStep } from "@/lib/reportValidation";

type LocationState =
  | { status: "pending" }
  | { status: "ready"; latitude: number; longitude: number }
  | { status: "manual"; latitude: string; longitude: string; hint: string };

export default function SosPage() {
  const [step, setStep] = useState<SosStep>("idle");
  const [location, setLocation] = useState<LocationState>({ status: "pending" });
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [notifyContacts, setNotifyContacts] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactValue, setContactValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trackingRef, setTrackingRef] = useState<string | null>(null);

  useEffect(() => {
    if (step !== "confirming") return;
    let cancelled = false;
    (async () => {
      const result = await getCurrentPosition();
      if (cancelled) return;
      if (result.ok) {
        setLocation({
          status: "ready",
          latitude: result.latitude,
          longitude: result.longitude,
        });
      } else {
        setLocation({
          status: "manual",
          latitude: "",
          longitude: "",
          hint: "Location unavailable. Enter coordinates to continue.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  function startSos() {
    setError(null);
    setStep("confirming");
  }

  async function confirmSos() {
    setError(null);
    let lat: number;
    let lng: number;
    if (location.status === "ready") {
      lat = location.latitude;
      lng = location.longitude;
    } else if (location.status === "manual") {
      lat = Number(location.latitude);
      lng = Number(location.longitude);
      if (
        location.latitude.trim() === "" ||
        location.longitude.trim() === "" ||
        Number.isNaN(lat) ||
        Number.isNaN(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        setError("Enter valid latitude and longitude to send SOS.");
        return;
      }
    } else {
      setError("Waiting for location…");
      return;
    }

    setStep("submitting");
    try {
      const contacts =
        notifyContacts && contactName.trim() && contactValue.trim()
          ? [{ name: contactName.trim(), contact: contactValue.trim() }]
          : [];
      const created = await createSos({
        location: { latitude: lat, longitude: lng },
        is_anonymous: isAnonymous,
        trusted_contacts: contacts,
      });
      setTrackingRef(created.tracking_ref);
      setStep("success");
    } catch (err) {
      setStep("error");
      setError(err instanceof ApiError ? err.message : "SOS failed. Tap retry.");
    }
  }

  if (step === "success" && trackingRef) {
    return (
      <section className="citizen-narrow stack animate-enter">
        <div className="page-media-banner" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/resources-arrived-success.jpg" alt="" />
        </div>
        <div className="alert-success stack">
          <h1 className="hero-title" style={{ fontSize: "1.5rem" }}>
            SOS sent
          </h1>
          <p>
            Tracking reference: <strong>{trackingRef}</strong>
          </p>
          <p>
            Help is being coordinated. Stay as safe as you can. Responders will treat this as
            critical priority.
          </p>
          <Link className="btn btn-primary" href={`/report/${trackingRef}`}>
            Track status
          </Link>
        </div>
      </section>
    );
  }

  if (step === "idle") {
    return (
      <section className="citizen-narrow stack animate-enter" style={{ gap: "1.5rem" }}>
        <div className="stack">
          <h1 className="hero-title">SOS</h1>
          <p className="muted">
            One more confirm step after this. Location is required so help can find you.
          </p>
        </div>
        <SOSButton onActivate={startSos} />
      </section>
    );
  }

  return (
    <section className="citizen-narrow stack animate-enter">
      <div className="stack">
        <h1 className="hero-title" style={{ fontSize: "1.4rem" }}>
          Confirm SOS
        </h1>
        <p className="muted">Tap confirm to send. You can adjust privacy options below.</p>
      </div>

      <div className="panel stack">
        {location.status === "pending" ? (
          <p className="muted">Getting your location…</p>
        ) : null}
        {location.status === "ready" ? (
          <p>
            Location ready: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </p>
        ) : null}
        {location.status === "manual" ? (
          <div className="stack">
            <p className="muted">{location.hint}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label className="label" htmlFor="sos-lat">
                  Latitude
                </label>
                <input
                  id="sos-lat"
                  className="field"
                  inputMode="decimal"
                  value={location.latitude}
                  onChange={(e) =>
                    setLocation({ ...location, latitude: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="sos-lng">
                  Longitude
                </label>
                <input
                  id="sos-lng"
                  className="field"
                  inputMode="decimal"
                  value={location.longitude}
                  onChange={(e) =>
                    setLocation({ ...location, longitude: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        ) : null}

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
          />
          Stay anonymous
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={notifyContacts}
            onChange={(e) => setNotifyContacts(e.target.checked)}
          />
          Notify a trusted contact
        </label>

        {notifyContacts ? (
          <div className="stack">
            <div>
              <label className="label" htmlFor="contact-name">
                Contact name
              </label>
              <input
                id="contact-name"
                className="field"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="contact-value">
                Phone or email
              </label>
              <input
                id="contact-value"
                className="field"
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
              />
            </div>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Contact details are saved with your report. Delivery is enabled in a later phase.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="alert-error" role="alert">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn-sos"
          disabled={step === "submitting" || location.status === "pending"}
          onClick={confirmSos}
        >
          {step === "submitting" ? "Sending…" : "Confirm send SOS"}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setStep("idle");
            setLocation({ status: "pending" });
            setError(null);
          }}
          disabled={step === "submitting"}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
