"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ApiError, createIncident } from "@/lib/api/client";
import { getCurrentPosition } from "@/lib/geo";
import {
  INCIDENT_CATEGORIES,
  ReportFormValues,
  validateReportForm,
} from "@/lib/reportValidation";

const initial: ReportFormValues = {
  category: "fire",
  description: "",
  latitude: "",
  longitude: "",
  address_text: "",
  photo_url: "",
  is_anonymous: false,
};

export default function ReportPage() {
  const [values, setValues] = useState<ReportFormValues>(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validateReportForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [trackingRef, setTrackingRef] = useState<string | null>(null);
  const [locHint, setLocHint] = useState<string | null>(null);

  async function useMyLocation() {
    setLocHint("Getting location…");
    const result = await getCurrentPosition();
    if (result.ok) {
      setValues((v) => ({
        ...v,
        latitude: String(result.latitude),
        longitude: String(result.longitude),
      }));
      setLocHint("Location captured from your device.");
    } else {
      setLocHint("Could not get location. Enter latitude and longitude manually.");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const nextErrors = validateReportForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const created = await createIncident({
        category: values.category,
        description: values.description.trim(),
        location: {
          latitude: Number(values.latitude),
          longitude: Number(values.longitude),
        },
        address_text: values.address_text.trim() || undefined,
        photo_url: values.photo_url.trim() || undefined,
        is_anonymous: values.is_anonymous,
      });
      setTrackingRef(created.tracking_ref);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Unable to submit report. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (trackingRef) {
    return (
      <section className="stack">
        <div className="alert-success stack">
          <h1 className="hero-title" style={{ fontSize: "1.4rem" }}>
            Report submitted
          </h1>
          <p>
            Tracking reference: <strong>{trackingRef}</strong>
          </p>
          <p className="muted">
            Keep this code. You can check status anytime without signing in.
          </p>
          <Link className="btn btn-primary" href={`/report/${trackingRef}`}>
            Track status
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="stack">
        <h1 className="hero-title">Report an incident</h1>
        <p className="muted">Describe what is happening and where. Fields marked required help responders.</p>
      </div>

      <form className="panel stack" onSubmit={onSubmit} noValidate>
        <div>
          <label className="label" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            className="field"
            value={values.category}
            onChange={(e) => setValues({ ...values, category: e.target.value })}
          >
            {INCIDENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {errors.category ? <p className="field-error">{errors.category}</p> : null}
        </div>

        <div className="stack">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
            <span className="label" style={{ marginBottom: 0 }}>
              Location
            </span>
            <button type="button" className="btn btn-secondary" onClick={useMyLocation}>
              Use my location
            </button>
          </div>
          {locHint ? <p className="muted" style={{ fontSize: "0.9rem" }}>{locHint}</p> : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label className="label" htmlFor="latitude">
                Latitude
              </label>
              <input
                id="latitude"
                className="field"
                inputMode="decimal"
                value={values.latitude}
                onChange={(e) => setValues({ ...values, latitude: e.target.value })}
                required
              />
              {errors.latitude ? <p className="field-error">{errors.latitude}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="longitude">
                Longitude
              </label>
              <input
                id="longitude"
                className="field"
                inputMode="decimal"
                value={values.longitude}
                onChange={(e) => setValues({ ...values, longitude: e.target.value })}
                required
              />
              {errors.longitude ? <p className="field-error">{errors.longitude}</p> : null}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="address_text">
              Address (optional)
            </label>
            <input
              id="address_text"
              className="field"
              value={values.address_text}
              onChange={(e) => setValues({ ...values, address_text: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="field"
            rows={4}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
            required
          />
          {errors.description ? <p className="field-error">{errors.description}</p> : null}
        </div>

        <div>
          <label className="label" htmlFor="photo_url">
            Photo URL (optional)
          </label>
          <input
            id="photo_url"
            className="field"
            type="url"
            placeholder="https://…"
            value={values.photo_url}
            onChange={(e) => setValues({ ...values, photo_url: e.target.value })}
          />
        </div>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={values.is_anonymous}
            onChange={(e) => setValues({ ...values, is_anonymous: e.target.checked })}
          />
          Submit anonymously
        </label>

        {formError ? <div className="alert-error" role="alert">{formError}</div> : null}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit report"}
        </button>
      </form>
    </section>
  );
}
