"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/Button";
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
    ? [{ href: "/field/assignments", label: "Assignments", icon: ClipboardList }]
    : [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/alerts", label: "Alerts", icon: AlertTriangle },
        { href: "/resources", label: "Resources", icon: Package },
        { href: "/analytics", label: "Analytics", icon: BarChart3 },
        ...(isAdmin ? [{ href: "/settings/users", label: "Users", icon: Users }] : []),
      ];

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar" aria-label="Operator">
        <BrandMark
          href={isField ? "/field/assignments" : "/dashboard"}
          size={32}
          variant="light"
          className="ops-brand-mark"
        />
        <nav className="ops-nav">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={pathname.startsWith(l.href) ? "active" : undefined}
              >
                <Icon size={18} aria-hidden />
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ops-user">
          <div className="notif-bell">
            <Button
              type="button"
              variant="ghost"
              aria-expanded={openNotif}
              onClick={() => {
                setOpenNotif((v) => !v);
                void loadNotifs();
              }}
            >
              <Bell size={18} aria-hidden />
              Notifications ({notifs.length})
            </Button>
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
          <Button type="button" variant="ghost" onClick={logout}>
            <LogOut size={16} aria-hidden />
            Log out
          </Button>
        </div>
      </aside>
      <div className="ops-main-wrap">
        <main className="ops-main animate-enter">{children}</main>
      </div>
    </div>
  );
}
