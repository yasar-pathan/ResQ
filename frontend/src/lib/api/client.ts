const DEFAULT_API_BASE = "http://localhost:8000";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE;
}

export function getWsUrl(): string {
  return process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";
}

export function newIdempotencyKey(prefix = "web"): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type Envelope<T> = {
  success: boolean;
  data: T;
  message?: string;
  error?: { code: string; message: string; details?: unknown };
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  const body = (await res.json()) as Envelope<T>;
  if (!res.ok || body.success === false) {
    throw new ApiError(
      res.status,
      body.error?.code ?? "request_failed",
      body.error?.message ?? `Request failed (${res.status})`,
      body.error?.details,
    );
  }
  return body.data;
}

export type LocationPayload = {
  latitude: number;
  longitude: number;
};

export type IncidentCreated = {
  id: string;
  tracking_ref: string;
  category: string;
  description: string;
  location: LocationPayload;
  source: string;
  priority: string | null;
  status: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
};

export type PublicStatus = {
  tracking_ref: string;
  status: string;
  updated_at: string;
};

export type TrustedContactPayload = {
  name: string;
  contact: string;
};

export async function fetchHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch(`${getApiBaseUrl()}/health`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json() as Promise<{ status: string; service: string }>;
}

export async function createIncident(input: {
  category: string;
  description: string;
  location: LocationPayload;
  address_text?: string;
  is_anonymous?: boolean;
  photo_url?: string;
  idempotency_key?: string;
}): Promise<IncidentCreated> {
  const res = await fetch(`${getApiBaseUrl()}/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      category: input.category,
      description: input.description,
      location: input.location,
      address_text: input.address_text || null,
      source: "citizen_web",
      is_anonymous: Boolean(input.is_anonymous),
      photo_url: input.photo_url || null,
      idempotency_key: input.idempotency_key ?? newIdempotencyKey("report"),
    }),
  });
  return parseEnvelope<IncidentCreated>(res);
}

export async function createSos(input: {
  location: LocationPayload;
  is_anonymous?: boolean;
  description?: string;
  trusted_contacts?: TrustedContactPayload[];
  idempotency_key?: string;
}): Promise<IncidentCreated> {
  const res = await fetch(`${getApiBaseUrl()}/incidents/sos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      location: input.location,
      is_anonymous: input.is_anonymous ?? true,
      description: input.description ?? "SOS emergency report",
      trusted_contacts: input.trusted_contacts ?? [],
      idempotency_key: input.idempotency_key ?? newIdempotencyKey("sos"),
    }),
  });
  return parseEnvelope<IncidentCreated>(res);
}

export async function getIncidentStatus(trackingRef: string): Promise<PublicStatus> {
  const res = await fetch(
    `${getApiBaseUrl()}/incidents/${encodeURIComponent(trackingRef)}/status`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  return parseEnvelope<PublicStatus>(res);
}
