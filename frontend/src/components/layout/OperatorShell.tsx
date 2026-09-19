"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/layout/BrandMark";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/Sheet";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "rg_ops_sidebar";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

function initials(name?: string): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function NavLinks({
  links,
  pathname,
  collapsed,
  onNavigate,
}: {
  links: NavItem[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Operator">
      {links.map((l) => {
        const Icon = l.icon;
        const active = pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            title={l.label}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold no-underline transition-colors",
              collapsed && "justify-center px-2",
              active
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-white",
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" aria-hidden strokeWidth={1.75} />
            {!collapsed ? <span>{l.label}</span> : <span className="sr-only">{l.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarProfile({
  collapsed,
  name,
  role,
  onLogout,
}: {
  collapsed?: boolean;
  name?: string;
  role?: string;
  onLogout: () => void;
}) {
  return (
    <div className={cn("mt-auto border-t border-white/10 p-2", collapsed && "flex flex-col items-center")}>
      <div
        className={cn(
          "mb-1 flex items-center gap-2 rounded-control px-2 py-2",
          collapsed && "justify-center px-0",
        )}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-bold text-white"
          aria-hidden
        >
          {initials(name)}
        </span>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">{name}</p>
            <p className="truncate text-xs capitalize text-sidebar-muted">{role?.replaceAll("_", " ")}</p>
          </div>
        ) : (
          <span className="sr-only">
            {name} ({role})
          </span>
        )}
      </div>
      <button
        type="button"
        className={cn(
          "sidebar-logout flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-sm font-semibold transition-colors",
          collapsed && "w-11 justify-center px-0",
        )}
        onClick={onLogout}
        aria-label="Log out"
        title="Log out"
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden strokeWidth={1.75} />
        {!collapsed ? <span>Log out</span> : null}
      </button>
    </div>
  );
}

function CollapseButton({
  collapsed,
  onToggle,
  floating,
}: {
  collapsed: boolean;
  onToggle: () => void;
  floating?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn("sidebar-collapse-btn", floating && "sidebar-collapse-btn--floating")}
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? (
        <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
      ) : (
        <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
      )}
    </button>
  );
}

export function OperatorShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isField = user?.role === "field_team";
  const isAdmin = user?.role === "admin";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_KEY);
      if (saved === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const links: NavItem[] = isField
    ? [{ href: "/field/assignments", label: "Assignments", icon: ClipboardList }]
    : [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/alerts", label: "Alerts", icon: AlertTriangle },
        { href: "/resources", label: "Resources", icon: Package },
        { href: "/analytics", label: "Analytics", icon: BarChart3 },
        ...(isAdmin ? [{ href: "/settings/users", label: "Users", icon: Users }] : []),
      ];

  const homeHref = isField ? "/field/assignments" : "/dashboard";

  const sidebarInner = (opts?: { collapsed?: boolean; onNavigate?: () => void; showCollapse?: boolean }) => (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3",
          opts?.collapsed && "justify-center px-2",
        )}
      >
        {opts?.showCollapse && !opts.collapsed ? (
          <CollapseButton collapsed={false} onToggle={toggleCollapsed} />
        ) : null}
        {!opts?.collapsed ? (
          <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight text-sidebar-foreground">
            RescueGrid Operations
          </p>
        ) : opts?.showCollapse ? null : (
          <p className="sr-only">RescueGrid Operations</p>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <NavLinks
          links={links}
          pathname={pathname}
          collapsed={opts?.collapsed}
          onNavigate={opts?.onNavigate}
        />
      </div>
      <SidebarProfile
        collapsed={opts?.collapsed}
        name={user?.name}
        role={user?.role}
        onLogout={logout}
      />
    </div>
  );

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-slate-100">
      <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 shadow-sm md:px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-control text-slate-700 transition-colors hover:bg-slate-100 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-sidebar p-0">
            <div className="flex h-full flex-col">
              <div className="flex h-14 items-center justify-between border-b border-white/10 px-3">
                <span className="text-sm font-semibold text-sidebar-foreground">RescueGrid Operations</span>
                <SheetClose asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-control text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-white"
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                </SheetClose>
              </div>
              {sidebarInner({ onNavigate: () => setMobileOpen(false) })}
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <BrandMark href={homeHref} size={28} showWordmark />
        </div>

        <NotificationBell />
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            "relative hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
            collapsed ? "w-0 overflow-hidden border-0" : "w-[220px]",
          )}
          aria-label="Operator navigation"
          aria-hidden={collapsed}
        >
          {!collapsed ? sidebarInner({ collapsed: false, showCollapse: true }) : null}
        </aside>

        {collapsed ? (
          <CollapseButton collapsed floating onToggle={toggleCollapsed} />
        ) : null}

        <div className="ops-main-wrap relative min-w-0 flex-1 overflow-hidden">
          <main
            className={cn(
              "ops-main flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4",
              collapsed && "md:pl-12",
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
