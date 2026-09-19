"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { listNotifications } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

export function OperatorShell({ children }: { children: ReactNode }) {
  const { user, logout, getToken } = useAuth();
  const pathname = usePathname();
  const isField = user?.role === "field_team";
  const isAdmin = user?.role === "admin";
  const [openNotif, setOpenNotif] = useState(false);
  const [notifs, setNotifs] = useState<
    Array<{ id: string; content: string; channel: string; created_at: string }>
  >([]);

  const loadNotifs = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await listNotifications(token);
      setNotifs(data.items.slice(0, 8));
    } catch {
      /* ignore */
    }
  }, [getToken]);

  useEffect(() => {
    void loadNotifs();
  }, [loadNotifs]);

  const links = isField
    ? [{ href: "/field/assignments", label: "Assignments" }]
    : [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/alerts", label: "Alerts" },
        { href: "/analytics", label: "Analytics" },
        ...(isAdmin ? [{ href: "/settings/users", label: "Users" }] : []),
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
          <div className="notif-bell">
            <button
              type="button"
              className="btn btn-ghost"
              aria-expanded={openNotif}
              onClick={() => {
                setOpenNotif((v) => !v);
                void loadNotifs();
              }}
            >
              Notifications ({notifs.length})
            </button>
            {openNotif ? (
              <div className="notif-panel" role="region" aria-label="Notifications">
                {notifs.length === 0 ? (
                  <p className="muted">No notifications yet.</p>
                ) : (
                  notifs.map((n) => (
                    <p key={n.id}>
                      <strong>{n.channel}</strong>: {n.content.slice(0, 120)}
                    </p>
                  ))
                )}
              </div>
            ) : null}
          </div>
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
