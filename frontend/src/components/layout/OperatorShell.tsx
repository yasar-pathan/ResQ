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
import { Button } from "@/components/ui/Button";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/Sheet";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "rg_ops_sidebar";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

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
    <nav className="flex flex-col gap-1" aria-label="Operator">
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
              "flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold no-underline transition",
              collapsed && "justify-center px-2",
              active
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white",
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {!collapsed ? <span>{l.label}</span> : <span className="sr-only">{l.label}</span>}
          </Link>
        );
      })}
    </nav>
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

  const sidebarInner = (opts?: { collapsed?: boolean; onNavigate?: () => void }) => (
    <>
      <div className={cn("flex items-center gap-2 px-3 py-4", opts?.collapsed && "justify-center px-2")}>
        <BrandMark
          href={homeHref}
          size={opts?.collapsed ? 28 : 32}
          variant="light"
          showWordmark={!opts?.collapsed}
          className="ops-brand-mark"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <NavLinks
          links={links}
          pathname={pathname}
          collapsed={opts?.collapsed}
          onNavigate={opts?.onNavigate}
        />
      </div>
    </>
  );

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-slate-100">
      <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 shadow-sm md:px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-border md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-sidebar">
            <div className="flex items-center justify-between px-3 pt-3">
              <span className="text-sm font-semibold text-sidebar-foreground">Menu</span>
              <SheetClose asChild>
                <button type="button" className="rounded-control p-2 text-sidebar-muted" aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </SheetClose>
            </div>
            {sidebarInner({ onNavigate: () => setMobileOpen(false) })}
          </SheetContent>
        </Sheet>

        <button
          type="button"
          className="hidden h-11 w-11 items-center justify-center rounded-control border border-border md:inline-flex"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>

        <div className="min-w-0 flex-1">
          <BrandMark href={homeHref} size={28} showWordmark className="md:hidden" />
          <p className="hidden truncate text-sm font-semibold text-slate-800 md:block">
            RescueGrid Operations
          </p>
        </div>

        <NotificationBell />
        <div className="hidden items-center gap-2 sm:flex">
          <div className="text-right leading-tight">
            <p className="max-w-[10rem] truncate text-sm font-semibold text-slate-800">{user?.name}</p>
            <p className="text-xs text-muted">{user?.role}</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" aria-hidden />
            Log out
          </Button>
        </div>
        <Button type="button" variant="secondary" size="icon" className="sm:hidden" onClick={logout} aria-label="Log out">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            "hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
            collapsed ? "w-[72px]" : "w-[220px]",
          )}
          aria-label="Operator navigation"
        >
          {sidebarInner({ collapsed })}
        </aside>
        <div className="ops-main-wrap min-w-0 flex-1 overflow-hidden">
          <main className="ops-main h-full overflow-y-auto p-4 md:p-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
