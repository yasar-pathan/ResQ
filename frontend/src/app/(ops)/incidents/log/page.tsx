"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Info,
  MapPin,
  Phone,
  RotateCcw,
  Send,
  User,
} from "lucide-react";
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

type SuccessResult = {
  id: string;
  tracking_ref: string;
  category: string;
  caller?: string;
};

const CALL_CHANNELS = [
  { value: "phone_112", label: "Emergency Hotline (112 / 100)" },
  { value: "control_room", label: "Control Room Direct Line" },
  { value: "radio_dispatch", label: "VHF / Tactical Radio" },
  { value: "walk_in", label: "Station Walk-In / Intercom" },
];

export default function LogCallPage() {
  const { getToken, refreshSession } = useAuth();
  const { toast } = useToast();

  // Intake form state
  const [category, setCategory] = useState("fire");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [landmark, setLandmark] = useState("");
  const [callerName, setCallerName] = useState("");
  const [callerPhone, setCallerPhone] = useState("");
  const [callChannel, setCallChannel] = useState(CALL_CHANNELS[0].value);

  const [errors, setErrors] = useState<ReturnType<typeof validateReportForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessResult | null>(null);

  // Character count & validation hints
  const descTrimmed = description.trim();
  const descLength = descTrimmed.length;
  const isDescValid = descLength >= 10;

  // Build values for reportValidation
  const formValues: ReportFormValues = useMemo(
    () => ({
      category,
      description,
      latitude,
      longitude,
      address_text: landmark,
      photo_url: "",
      is_anonymous: false,
    }),
    [category, description, latitude, longitude, landmark],
  );

  function resetForm() {
    setCategory("fire");
    setDescription("");
    setLatitude("");
    setLongitude("");
    setLandmark("");
    setCallerName("");
    setCallerPhone("");
    setCallChannel(CALL_CHANNELS[0].value);
    setErrors({});
    setFormError(null);
  }

  // Handle submit
  async function onSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    setFormError(null);

    const nextErrors = validateReportForm(formValues);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please check the required fields: description (min 10 chars) and valid coordinates.",
        variant: "error",
      });
      return;
    }

    // Build structured address / caller information
    const addressParts: string[] = [];
    if (landmark.trim()) {
      addressParts.push(landmark.trim());
    }
    const callerMeta: string[] = [];
    if (callerName.trim()) callerMeta.push(`Caller: ${callerName.trim()}`);
    if (callerPhone.trim()) callerMeta.push(`Phone: ${callerPhone.trim()}`);
    const selectedChannel = CALL_CHANNELS.find((c) => c.value === callChannel);
    if (selectedChannel) callerMeta.push(`Channel: ${selectedChannel.label}`);
    if (callerMeta.length > 0) {
      addressParts.push(`[${callerMeta.join(" · ")}]`);
    }
    const finalAddressText = addressParts.join(" | ") || undefined;

    setSubmitting(true);
    try {
      const created = await withAuthRetry(getToken, refreshSession, (token) =>
        createOpsIncident(token, {
          category,
          description: descTrimmed,
          location: {
            latitude: Number(latitude),
            longitude: Number(longitude),
          },
          address_text: finalAddressText,
          source: "call",
          idempotency_key: newIdempotencyKey("logcall"),
        }),
      );

      setResult({
        id: created.id,
        tracking_ref: created.tracking_ref,
        category,
        caller: callerName.trim() || undefined,
      });

      toast({
        title: "Call incident logged",
        description: `Tracking Ref: ${created.tracking_ref}`,
        variant: "success",
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unable to log call incident.";
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

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to submit
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (!submitting && !result) {
          e.preventDefault();
          onSubmit();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (result) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto pr-1 pb-10">
        <section className="mx-auto w-full max-w-2xl space-y-6 rounded-panel border border-border bg-surface p-6 shadow-md animate-enter">
          <div className="flex items-start gap-4 rounded-control border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
            <div className="space-y-1">
              <h1 className="text-lg font-bold">Emergency Call Incident Logged</h1>
              <p className="text-sm leading-relaxed text-emerald-900">
                Tracking reference: <strong className="font-mono font-bold text-emerald-950">{result.tracking_ref}</strong>
              </p>
              <p className="text-xs text-emerald-800">
                Incident queued for automated AI classification and resource dispatch under source{" "}
                <span className="source-chip source-chip-call inline-flex">Call</span>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={`/incidents/${result.id}`}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              Open triage &amp; dispatch
            </Link>
            <Link
              href={`/dashboard?selected=${result.id}`}
              className="btn btn-secondary inline-flex items-center gap-2"
            >
              View in Dashboard
            </Link>
            <button
              type="button"
              className="btn btn-secondary inline-flex items-center gap-2"
              onClick={() => {
                setResult(null);
                resetForm();
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Log another call
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto pr-1 pb-12">
      <div className="mx-auto w-full max-w-5xl space-y-5 animate-enter">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                Log Emergency Call
              </h1>
              <span className="source-chip source-chip-call">Call Intake</span>
            </div>
            <p className="mt-0.5 text-xs text-muted md:text-sm">
              Dispatcher intake for 112 / 100 calls, radio reports, and walk-in emergencies. Queues into automated AI classification and tactical dispatch.
            </p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-slate-900"
            title="Clear all inputs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset form
          </button>
        </header>

        {formError ? (
          <div className="flex items-center gap-2 rounded-control border border-red-200 bg-red-50 p-3 text-xs text-red-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{formError}</span>
          </div>
        ) : null}

        {/* 2-Column Responsive Layout */}
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left Column (7 cols): Incident & Caller Details */}
            <div className="space-y-4 lg:col-span-7">
              {/* Category & Intake Channel */}
              <div className="rounded-panel border border-border bg-surface p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold text-slate-900">Intake Classification</h2>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="stack gap-1 text-xs font-semibold text-slate-700">
                    <span>Emergency Category</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex h-9 w-full items-center justify-between rounded-control border border-border bg-white px-3 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <span className="capitalize">
                            {INCIDENT_CATEGORIES.find((c) => c.value === category)?.label || category}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 text-muted" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 bg-surface">
                        <DropdownMenuRadioGroup value={category} onValueChange={setCategory}>
                          {INCIDENT_CATEGORIES.map((c) => (
                            <DropdownMenuRadioItem key={c.value} value={c.value}>
                              {c.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="stack gap-1 text-xs font-semibold text-slate-700">
                    <span>Intake Channel</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex h-9 w-full items-center justify-between rounded-control border border-border bg-white px-3 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <span className="truncate">
                            {CALL_CHANNELS.find((c) => c.value === callChannel)?.label || callChannel}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64 bg-surface">
                        <DropdownMenuRadioGroup value={callChannel} onValueChange={setCallChannel}>
                          {CALL_CHANNELS.map((c) => (
                            <DropdownMenuRadioItem key={c.value} value={c.value}>
                              {c.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* Caller Identity (Optional but recommended for callbacks) */}
              <div className="rounded-panel border border-border bg-surface p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-bold text-slate-900">Caller Details</h2>
                  </div>
                  <span className="text-[11px] text-muted">Optional / Callback info</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="stack gap-1 text-xs font-semibold text-slate-700">
                    Caller Name
                    <input
                      type="text"
                      className="field h-9 text-xs"
                      placeholder="e.g. Ramesh Kumar or Anonymous"
                      value={callerName}
                      onChange={(e) => setCallerName(e.target.value)}
                    />
                  </label>

                  <label className="stack gap-1 text-xs font-semibold text-slate-700">
                    Callback Phone Number
                    <input
                      type="tel"
                      className="field h-9 text-xs font-mono"
                      placeholder="e.g. +91 98765 43210"
                      value={callerPhone}
                      onChange={(e) => setCallerPhone(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              {/* Emergency Situation Description */}
              <div className="rounded-panel border border-border bg-surface p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h2 className="text-sm font-bold text-slate-900">Caller Description</h2>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-mono font-semibold ${
                        isDescValid ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {descLength} chars
                    </span>
                    {!isDescValid ? (
                      <span className="text-[11px] text-muted">(min 10)</span>
                    ) : null}
                  </div>
                </div>

                <Textarea
                  className="min-h-[110px] text-xs leading-relaxed"
                  placeholder="Record emergency details as reported by the caller: type of hazard, injuries, entrapped individuals, immediate dangers…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
                {errors.description ? (
                  <span className="form-error text-xs">{errors.description}</span>
                ) : (
                  <p className="text-[11px] text-muted">
                    Be descriptive. AI classification uses this text for severity scoring and recommending responder teams.
                  </p>
                )}
              </div>
            </div>

            {/* Right Column (5 cols): Location Coordinates & Landmark */}
            <div className="space-y-4 lg:col-span-5">
              <div className="rounded-panel border border-border bg-surface p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold text-slate-900">Incident Location</h2>
                </div>

                <LocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  onChange={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                  error={errors.latitude || errors.longitude}
                />

                <label className="stack gap-1 pt-1 text-xs font-semibold text-slate-700">
                  Landmark / Cross-Street / Address Notes
                  <input
                    type="text"
                    className="field h-9 text-xs"
                    placeholder="e.g. Near Metro Pillar 140, Opposite City Hospital"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                  />
                  <span className="text-[11px] font-normal text-muted">
                    Helps field units pinpoint the scene quickly when coordinates are approximate.
                  </span>
                </label>
              </div>

              {/* Dispatch Tips Card */}
              <div className="rounded-panel border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-700">
                <div className="mb-1.5 flex items-center gap-1.5 font-bold text-slate-900">
                  <Info className="h-4 w-4 text-primary" />
                  <span>Dispatcher Intake Protocol</span>
                </div>
                <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-600">
                  <li>Confirm whether any lives are in immediate danger or persons trapped.</li>
                  <li>Verify caller callback number in case connection drops.</li>
                  <li>Keep caller on the line until first response unit is rolling if critical.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border bg-surface p-3.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="hidden sm:inline">Shortcuts:</span>
              <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700">
                Ctrl + Enter
              </kbd>
              <span>to log incident</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                className="btn btn-secondary text-xs"
              >
                Clear
              </button>
              <Button
                type="submit"
                loading={submitting}
                disabled={submitting || !isDescValid}
                className="inline-flex items-center gap-2"
              >
                {!submitting && <Send className="h-3.5 w-3.5" />}
                {submitting ? "Logging call…" : "Log Call Incident"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
