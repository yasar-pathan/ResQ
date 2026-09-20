"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LocationPicker } from "@/components/maps/LocationPicker";
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
        setError("Please select your location on the map to send SOS.");
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius-control)",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
            }}
          >
            <div>
              <p style={{ fontWeight: 600, color: "#10b981", fontSize: "0.95rem" }}>
                ✔ Location Captured
              </p>
              <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.15rem" }}>
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: "0.85rem", textDecoration: "underline" }}
              onClick={() =>
                setLocation({
                  status: "manual",
                  latitude: String(location.latitude),
                  longitude: String(location.longitude),
                  hint: "Tap on the map to fine-tune your location",
                })
              }
            >
              Adjust on map
            </button>
          </div>
        ) : null}
        {location.status === "manual" ? (
          <div className="stack" style={{ gap: "0.6rem" }}>
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              {location.hint || "Device GPS unavailable. Pin your position on the map:"}
            </p>
            <LocationPicker
              latitude={location.latitude}
              longitude={location.longitude}
              onChange={(lat, lng) => {
                const nLat = parseFloat(lat);
                const nLng = parseFloat(lng);
                if (!isNaN(nLat) && !isNaN(nLng)) {
                  setLocation({
                    status: "ready",
                    latitude: nLat,
                    longitude: nLng,
                  });
                } else {
                  setLocation({
                    status: "manual",
                    latitude: lat,
                    longitude: lng,
                    hint: "Select a point on the map to continue",
                  });
                }
              }}
            />
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
