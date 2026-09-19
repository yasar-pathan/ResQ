export const INCIDENT_CATEGORIES = [
  { value: "fire", label: "Fire" },
  { value: "flood", label: "Flood" },
  { value: "industrial_accident", label: "Industrial accident" },
  { value: "road_incident", label: "Road incident" },
  { value: "medical", label: "Medical" },
  { value: "personal_safety", label: "Personal safety" },
  { value: "other", label: "Other" },
] as const;

export type ReportFormValues = {
  category: string;
  description: string;
  latitude: string;
  longitude: string;
  address_text: string;
  photo_url: string;
  is_anonymous: boolean;
};

export type FieldErrors = Partial<Record<keyof ReportFormValues | "location", string>>;

export function validateReportForm(values: ReportFormValues): FieldErrors {
  const errors: FieldErrors = {};
  const allowed = new Set(INCIDENT_CATEGORIES.map((c) => c.value));
  if (!allowed.has(values.category as (typeof INCIDENT_CATEGORIES)[number]["value"])) {
    errors.category = "Select a valid category";
  }
  const desc = values.description.trim();
  if (desc.length < 10) {
    errors.description = "Description must be at least 10 characters";
  } else if (desc.length > 2000) {
    errors.description = "Description must be at most 2000 characters";
  }
  const lat = Number(values.latitude);
  const lng = Number(values.longitude);
  if (
    values.latitude.trim() === "" ||
    values.longitude.trim() === "" ||
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    errors.location = "Set a location via map or device";
  }
  return errors;
}

export type SosStep = "idle" | "confirming" | "submitting" | "success" | "error";

/** Counts user confirm actions toward the ≤2-tap SOS gate (start + confirm). */
export function nextSosStep(step: SosStep, action: "start" | "confirm" | "reset"): SosStep {
  if (action === "reset") return "idle";
  if (action === "start" && step === "idle") return "confirming";
  if (action === "confirm" && step === "confirming") return "submitting";
  return step;
}

export function sosTapCount(fromIdle: SosStep[]): number {
  let taps = 0;
  let step: SosStep = "idle";
  for (const action of fromIdle) {
    if (action === "confirming" && step === "idle") {
      taps += 1;
      step = "confirming";
    } else if (action === "submitting" && step === "confirming") {
      taps += 1;
      step = "submitting";
    }
  }
  return taps;
}
