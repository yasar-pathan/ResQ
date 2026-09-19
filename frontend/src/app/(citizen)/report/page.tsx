"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { Button } from "@/components/ui/Button";
import { ApiError, createIncident, uploadMedia } from "@/lib/api/client";
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
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function onPhotoSelected(file: File | null) {
    setPhotoError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("Image must be under 2MB.");
      return;
    }
    setPhotoBusy(true);
    try {
      const localPreview = URL.createObjectURL(file);
      setPhotoPreview(localPreview);
      const uploaded = await uploadMedia(file);
      setValues((v) => ({ ...v, photo_url: uploaded.url }));
    } catch (err) {
      setPhotoPreview(null);
      setValues((v) => ({ ...v, photo_url: "" }));
      setPhotoError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setPhotoBusy(false);
    }
  }

  function clearPhoto() {
    setPhotoPreview(null);
    setPhotoError(null);
    setValues((v) => ({ ...v, photo_url: "" }));
    if (fileRef.current) fileRef.current.value = "";
  }

  if (trackingRef) {
    return (
      <section className="citizen-narrow stack animate-enter">
        <div className="page-media-banner" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/resources-arrived-success.jpg" alt="" />
        </div>
        <div className="alert-success stack">
          <h1 className="hero-title" style={{ fontSize: "1.4rem" }}>
            Report submitted
          </h1>
          <p>
            Tracking reference: <strong>{trackingRef}</strong>
          </p>
          <p className="muted">Keep this code. You can check status anytime without signing in.</p>
          <Link className="btn btn-primary" href={`/report/${trackingRef}`}>
            Track status
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="citizen-narrow stack animate-enter">
      <div className="page-media-banner" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/media/fire-brigade-ready.jpg" alt="" />
      </div>
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
          <span className="label">Location</span>
          <LocationPicker
            latitude={values.latitude}
            longitude={values.longitude}
            onChange={(lat, lng) => setValues((v) => ({ ...v, latitude: lat, longitude: lng }))}
            onHint={setLocHint}
            error={errors.location}
          />
          {locHint ? <p className="muted" style={{ fontSize: "0.9rem" }}>{locHint}</p> : null}
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

        <div className="stack" style={{ gap: "0.75rem" }}>
          <span className="label">Photo (optional)</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id="photo-upload"
            onChange={(e) => void onPhotoSelected(e.target.files?.[0] ?? null)}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
            <Button
              type="button"
              variant="secondary"
              disabled={photoBusy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" aria-hidden />
              {photoBusy ? "Uploading…" : "Upload photo"}
            </Button>
            {values.photo_url ? (
              <Button type="button" variant="secondary" onClick={clearPhoto}>
                <X className="h-4 w-4" aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>
          {photoError ? <p className="field-error">{photoError}</p> : null}
          {photoPreview || values.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview || values.photo_url}
              alt="Upload preview"
              style={{
                maxWidth: "100%",
                maxHeight: 180,
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                objectFit: "cover",
              }}
            />
          ) : null}
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

        <button type="submit" className="btn btn-primary" disabled={submitting || photoBusy}>
          {submitting ? "Submitting…" : "Submit report"}
        </button>
      </form>
    </section>
  );
}
