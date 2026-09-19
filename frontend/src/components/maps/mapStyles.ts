import type { ResourceItem } from "@/lib/api/client";

export function priorityColor(priority: string | null | undefined): string {
  switch (priority) {
    case "critical":
      return "#dc2626";
    case "high":
      return "#ea580c";
    case "medium":
      return "#b45309";
    case "low":
      return "#64748b";
    default:
      return "#1e3a8a";
  }
}

export function resourceStatusColor(r: Pick<ResourceItem, "status" | "is_active">): string {
  if (r.is_active === false || r.status === "unavailable") return "#94a3b8";
  if (r.status === "assigned") return "#d97706";
  if (r.status === "available") return "#15803d";
  return "#0f766e";
}
