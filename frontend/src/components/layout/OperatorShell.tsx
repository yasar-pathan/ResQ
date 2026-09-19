"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

export function OperatorShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isField = user?.role === "field_team";

  const links = isField
    ? [{ href: "/field/assignments", label: "Assignments" }]
    : [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/alerts", label: "Alerts" },
      ];

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar" aria-label="Operator">
        <Link href={isField ? "/field/assignments" : "/dashboard"} className="brand ops-brand">
          RescueGrid
        </Link>
        <nav className="ops-nav">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname.startsWith(l.href) ? "active" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ops-user">
          <span className="muted">{user?.name}</span>
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            {user?.role}
          </span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="ops-main-wrap">
        <main className="ops-main">{children}</main>
      </div>
    </div>
  );
}
