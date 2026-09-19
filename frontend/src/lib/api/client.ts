const DEFAULT_API_BASE = "http://localhost:8000";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE;
}

export function getWsUrl(): string {
  return process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/dashboard";
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

function authHeaders(token: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export type UserPublic = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export async function login(email: string, password: string): Promise<TokenPair> {
  const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseEnvelope<TokenPair>(res);
}

export async function getMe(token: string): Promise<UserPublic> {
  const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  return parseEnvelope<UserPublic>(res);
}

export type IncidentListItem = IncidentCreated & {
  ai_summary?: string | null;
  classification_source?: string | null;
  classified_at?: string | null;
  tracking_ref: string;
};

export async function listIncidents(
  token: string,
  params?: {
    status?: string;
    category?: string;
    priority?: string;
    page?: number;
    limit?: number;
  },
): Promise<{ items: IncidentListItem[]; total: number; page: number; limit: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.category) qs.set("category", params.category);
  if (params?.priority) qs.set("priority", params.priority);
  qs.set("page", String(params?.page ?? 1));
  qs.set("limit", String(params?.limit ?? 50));
  const res = await fetch(`${getApiBaseUrl()}/incidents?${qs}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  return parseEnvelope(res);
}

export async function getIncident(token: string, id: string): Promise<IncidentListItem> {
  const res = await fetch(`${getApiBaseUrl()}/incidents/${id}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  return parseEnvelope(res);
}

export type RecommendationItem = {
  resource_id: string;
  name: string;
  distance_meters: number;
  capability_match: boolean;
  load: number;
  score: number;
  recommendation_reason: string;
};

export async function getRecommendations(
  token: string,
  incidentId: string,
): Promise<{ items: RecommendationItem[]; empty_reason: string | null }> {
  const res = await fetch(`${getApiBaseUrl()}/incidents/${incidentId}/recommendations`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  return parseEnvelope(res);
}

export async function assignResource(
  token: string,
  incidentId: string,
  body: { resource_id: string; decision: string; recommendation_reason?: string },
): Promise<Record<string, unknown>> {
  const res = await fetch(`${getApiBaseUrl()}/incidents/${incidentId}/assign`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseEnvelope(res);
}

export type ResourceItem = {
  id: string;
  type: string;
  name: string;
  status: string;
  location: { latitude: number; longitude: number };
};

export async function listResources(
  token: string,
  params?: { status?: string },
): Promise<{ items: ResourceItem[] }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  qs.set("limit", "100");
  const res = await fetch(`${getApiBaseUrl()}/resources?${qs}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  return parseEnvelope(res);
}

export type AlertItem = {
  id: string;
  incident_id: string | null;
  type: string;
  message: string;
  status: string;
  created_at: string;
};

export async function listAlerts(
  token: string,
  params?: { status?: string },
): Promise<{ items: AlertItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  const res = await fetch(`${getApiBaseUrl()}/alerts?${qs}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  return parseEnvelope(res);
}

export async function acknowledgeAlert(token: string, alertId: string): Promise<AlertItem> {
  const res = await fetch(`${getApiBaseUrl()}/alerts/${alertId}/acknowledge`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  return parseEnvelope(res);
}

export type AssignmentItem = {
  id: string;
  incident_id: string;
  resource_id: string;
  status: string;
  decision: string;
  assignee_user_id: string | null;
  recommendation_reason: string | null;
  created_at: string;
  incident?: Record<string, unknown>;
  resource?: Record<string, unknown>;
};

export async function listAssignments(token: string): Promise<{ items: AssignmentItem[] }> {
  const res = await fetch(`${getApiBaseUrl()}/assignments`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  return parseEnvelope(res);
}

export async function getAssignment(token: string, id: string): Promise<AssignmentItem> {
  const res = await fetch(`${getApiBaseUrl()}/assignments/${id}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  return parseEnvelope(res);
}

export async function patchAssignmentStatus(
  token: string,
  id: string,
  statusValue: string,
): Promise<AssignmentItem> {
  const res = await fetch(`${getApiBaseUrl()}/assignments/${id}/status`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ status: statusValue }),
  });
  return parseEnvelope(res);
}

export async function listNotifications(
  token: string,
): Promise<{ items: Array<{ id: string; content: string; channel: string; created_at: string }> }> {
  const res = await fetch(`${getApiBaseUrl()}/notifications`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  return parseEnvelope(res);
}

export function dashboardWsUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/dashboard";
  const url = new URL(base);
  url.searchParams.set("token", token);
  return url.toString();
}
