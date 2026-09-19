/** Safe post-login destinations by role (middleware-aligned). */

const OPS_PREFIXES = ["/dashboard", "/incidents", "/alerts", "/analytics", "/resources", "/settings"];

export function postLoginPath(role: string, next: string | null): string {
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  if (role === "field_team") {
    if (safeNext?.startsWith("/field")) return safeNext;
    return "/field/assignments";
  }
  if (role === "dispatcher" || role === "admin") {
    if (safeNext && OPS_PREFIXES.some((p) => safeNext === p || safeNext.startsWith(`${p}/`))) {
      return safeNext;
    }
    return "/dashboard";
  }
  // citizen and unknown
  if (safeNext && !OPS_PREFIXES.some((p) => safeNext === p || safeNext.startsWith(`${p}/`)) && !safeNext.startsWith("/field")) {
    return safeNext;
  }
  return "/";
}

export function hardNavigate(path: string): void {
  window.location.assign(path);
}
