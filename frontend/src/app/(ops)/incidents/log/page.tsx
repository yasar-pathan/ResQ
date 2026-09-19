"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { Button } from "@/components/ui/Button";
import { ApiError, createOpsIncident } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { INCIDENT_CATEGORIES, validateReportForm, type ReportFormValues } from "@/lib/reportValidation";

const initial: ReportFormValues = {
  category: "fire",
  description: "",
  latitude: "",
  longitude: "",
  address_text: "",
  photo_url: "",
  is_anonymous: false,
};

export default function LogCallPage() {
  const { getToken } = useAuth();
  const [values, setValues] = useState<ReportFormValues>(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validateReportForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [trackingRef, setTrackingRef] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const nextErrors = validateReportForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const token = getToken();
    if (!token) {
      setFormError("Sign in as a dispatcher to log a call.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createOpsIncident(token, {
        category: values.category,
        description: values.description.trim(),
        location: {
          latitude: Number(values.latitude),
          longitude: Number(values.longitude),
        },
        address_text: values.address_text.trim() || undefined,
        source: "call",
      });
      setTrackingRef(created.tracking_ref);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Unable to log call.");
    } finally {
      setSubmitting(false);
    }
  }

  if (trackingRef) {
    return (
      <section className="stack max-w-xl animate-enter">
        <h1 className="text-2xl font-bold">Call logged</h1>
        <p className="text-muted">
          Incident <strong>{trackingRef}</strong> is queued for classification.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" className="btn btn-primary">
            Open dashboard
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => setTrackingRef(null)}>
            Log another call
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="stack max-w-xl animate-enter">
      <header className="stack gap-1">
        <h1 className="text-2xl font-bold">Log a call</h1>
        <p className="text-sm text-muted">
          Dispatcher intake for phone or radio reports. Creates an incident with source{" "}
          <code className="text-xs">call</code>.
        </p>
      </header>

      <form className="stack gap-4" onSubmit={onSubmit} noValidate>
        <label className="stack gap-1 text-sm">
          Category
          <select
            className="input"
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
          >
            {INCIDENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="stack gap-1 text-sm">
          Description
          <textarea
            className="input min-h-[120px]"
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            required
          />
          {errors.description ? <span className="form-error">{errors.description}</span> : null}
        </label>

        <LocationPicker
          latitude={values.latitude}
          longitude={values.longitude}
          onChange={(lat, lng) => setValues((v) => ({ ...v, latitude: lat, longitude: lng }))}
          error={errors.latitude || errors.longitude}
        />

        <label className="stack gap-1 text-sm">
          Address (optional)
          <input
            className="input"
            value={values.address_text}
            onChange={(e) => setValues((v) => ({ ...v, address_text: e.target.value }))}
          />
        </label>

        {formError ? <p className="form-error">{formError}</p> : null}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Log call incident"}
        </Button>
      </form>
    </section>
  );
}
