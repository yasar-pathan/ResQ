import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/incidents",
  "/alerts",
  "/analytics",
  "/settings",
  "/field",
  "/resources",
];

const ROLE_GATES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/settings", roles: ["admin"] },
  { prefix: "/field", roles: ["field_team", "admin"] },
  {
    prefix: "/dashboard",
    roles: ["dispatcher", "admin"],
  },
  {
    prefix: "/incidents",
    roles: ["dispatcher", "admin"],
  },
  {
    prefix: "/alerts",
    roles: ["dispatcher", "admin"],
  },
  {
    prefix: "/analytics",
    roles: ["dispatcher", "admin"],
  },
  {
    prefix: "/resources",
    roles: ["dispatcher", "admin"],
  },
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const auth = request.cookies.get("rg_auth")?.value;
  const role = request.cookies.get("rg_role")?.value;

  if (!auth) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  for (const gate of ROLE_GATES) {
    if (pathname === gate.prefix || pathname.startsWith(`${gate.prefix}/`)) {
      if (!role || !gate.roles.includes(role)) {
        const login = new URL("/login", request.url);
        login.searchParams.set("error", "unauthorized");
        return NextResponse.redirect(login);
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/incidents/:path*",
    "/alerts/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/field/:path*",
    "/resources/:path*",
  ],
};
