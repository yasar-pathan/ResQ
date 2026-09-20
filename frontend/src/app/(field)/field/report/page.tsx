"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { ApiError, createOpsIncident, newIdempotencyKey } from "@/lib/api/client";
import { useAuth, withAuthRetry } from "@/lib/auth";
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

type SuccessResult = {
  id: string;
  tracking_ref: string;
};

export default function FieldReportPage() {
  const { getToken, refreshSession } = useAuth();
  const { toast } = useToast();
  const [values, setValues] = useState<ReportFormValues>(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validateReportForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const nextErrors = validateReportForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const created = await withAuthRetry(getToken, refreshSession, (token) =>
        createOpsIncident(token, {
          category: values.category,
          description: values.description.trim(),
          location: {
            latitude: Number(values.latitude),
            longitude: Number(values.longitude),
          },
          address_text: values.address_text.trim() || undefined,
          source: "field_team",
          idempotency_key: newIdempotencyKey("field"),
        }),
      );
      setResult({ id: created.id, tracking_ref: created.tracking_ref });
      toast({
        title: "Field report submitted",
        description: `Tracking ref: ${created.tracking_ref}`,
        variant: "success",
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unable to submit report.";
      setFormError(msg);
      toast({
        title: "Submission failed",
        description: msg,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="stack max-w-xl animate-enter">
        <div className="alert-success">
          <h1 className="text-xl font-bold">Report submitted ✓</h1>
          <p className="mt-1 text-sm">
            Incident{" "}
            <strong className="font-mono">{result.tracking_ref}</strong> has been queued with
            source{" "}
            <span className="source-chip source-chip-field_team inline-flex">Field</span>.
            Dispatchers will classify and assign resources.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/incidents/${result.id}`} className="btn btn-primary">
            View incident
          </Link>
          <Link href="/field/assignments" className="btn btn-secondary">
            My assignments
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setResult(null);
              setValues(initial);
              setErrors({});
            }}
          >
            Report another
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="stack max-w-xl animate-enter">
      <header className="stack gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Report incident</h1>
          <span className="source-chip source-chip-field_team">Field</span>
        </div>
        <p className="text-sm text-muted">
          Field-team intake. Submit what you observe on the ground — dispatchers will triage and
          assign resources. Source is recorded as{" "}
          <code className="text-xs">field_team</code>.
        </p>
      </header>

      <form className="stack gap-4" onSubmit={onSubmit} noValidate>
        <div className="stack gap-1 text-sm">
          <span>Incident type</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 w-full items-center justify-between rounded-control border border-border bg-white px-3 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <span className="capitalize">
                  {INCIDENT_CATEGORIES.find((c) => c.value === values.category)?.label || values.category}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 bg-surface">
              <DropdownMenuRadioGroup
                value={values.category}
                onValueChange={(v) => setValues((prev) => ({ ...prev, category: v }))}
              >
                {INCIDENT_CATEGORIES.map((c) => (
                  <DropdownMenuRadioItem key={c.value} value={c.value}>
                    {c.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <label className="stack gap-1 text-sm">
          Observation notes
          <Textarea
            className="min-h-[120px]"
            placeholder="Describe what you are observing on the ground…"
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
          onHint={setHint}
          error={errors.latitude || errors.longitude}
        />
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}

        <label className="stack gap-1 text-sm">
          Address / landmark (optional)
          <input
            className="field"
            placeholder="e.g. Near water tank, junction with Ring Road…"
            value={values.address_text}
            onChange={(e) => setValues((v) => ({ ...v, address_text: e.target.value }))}
          />
        </label>

        {formError ? <p className="form-error">{formError}</p> : null}

        <Button type="submit" loading={submitting}>
          {submitting ? "Submitting…" : "Submit field report"}
        </Button>
      </form>
    </section>
  );
}
