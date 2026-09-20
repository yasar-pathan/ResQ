"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  ChevronUp,
  ClipboardList,
  FileWarning,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Phone,
  Settings,
  User,
  Users,
  X,
} from "lucide-react";
import { type ReactNode } from "react";
import { BrandMark } from "@/components/layout/BrandMark";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/Sheet";
import { useAuth } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/Sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { cn } from "@/lib/utils";

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

function SidebarProfileDropdown({
  name,
  role,
  onLogout,
}: {
  name?: string;
  role?: string;
  onLogout: () => void;
}) {
  const { collapsed } = useSidebar();
  const router = useRouter();
  const isAdmin = role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-control p-2 text-left transition-colors hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-primary",
            collapsed && "justify-center p-1.5",
          )}
          aria-label="User account settings"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm"
            aria-hidden
          >
            {initials(name)}
          </span>
          {!collapsed ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight text-slate-900">
                  {name || "Operator"}
                </p>
                <p className="truncate text-xs capitalize text-muted">
                  {role?.replaceAll("_", " ") || "Personnel"}
                </p>
              </div>
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
            </>
          ) : (
            <span className="sr-only">{name}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? "right" : "top"}
        align={collapsed ? "start" : "end"}
        className="w-56 bg-surface shadow-xl"
      >
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-bold text-slate-900">{name || "User"}</p>
            <p className="text-xs font-medium capitalize text-muted">
              Role: <span className="font-semibold text-primary">{role?.replaceAll("_", " ")}</span>
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(role === "field_team" ? "/field/assignments" : "/dashboard")}>
          <LayoutDashboard className="mr-2 h-4 w-4 text-muted" />
          <span>Home Dashboard</span>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem onClick={() => router.push("/settings/users")}>
            <Users className="mr-2 h-4 w-4 text-muted" />
            <span>User Management</span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-danger focus:bg-red-50 focus:text-danger"
          onClick={onLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ShellNavItems({
  links,
  pathname,
  onNavigate,
}: {
  links: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const { collapsed } = useSidebar();

  return (
    <SidebarMenu>
      {links.map((l) => {
        const Icon = l.icon;
        const active = pathname.startsWith(l.href);
        return (
          <SidebarMenuItem key={l.href}>
            <Link
              href={l.href}
              onClick={onNavigate}
              className="block no-underline text-inherit"
              title={collapsed ? l.label : undefined}
            >
              <SidebarMenuButton isActive={active}>
                <Icon
                  className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-slate-500")}
                  strokeWidth={1.75}
                  aria-hidden
                />
                {!collapsed ? <span>{l.label}</span> : <span className="sr-only">{l.label}</span>}
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function OperatorShellInner({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isField = user?.role === "field_team";
  const isAdmin = user?.role === "admin";
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();

  const links: NavItem[] = isField
    ? [
        { href: "/field/assignments", label: "Assignments", icon: ClipboardList },
        { href: "/field/report", label: "Report incident", icon: FileWarning },
      ]
    : [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/incidents/log", label: "Log call", icon: Phone },
        { href: "/alerts", label: "Alerts", icon: AlertTriangle },
        { href: "/resources", label: "Resources", icon: Package },
        { href: "/analytics", label: "Analytics", icon: BarChart3 },
        ...(isAdmin ? [{ href: "/settings/users", label: "Users", icon: Users }] : []),
      ];

  const homeHref = isField ? "/field/assignments" : "/dashboard";

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
          <SheetContent side="left" className="bg-surface border-r border-border p-0">
            <div className="flex h-full flex-col">
              <div className="flex h-14 items-center justify-between border-b border-border px-3">
                <span className="text-sm font-semibold text-slate-900">
                  RescueGrid Operations
                </span>
                <SheetClose asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-control text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                </SheetClose>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
                <ShellNavItems
                  links={links}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
              <div className="mt-auto border-t border-border p-2">
                <SidebarProfileDropdown
                  name={user?.name}
                  role={user?.role}
                  onLogout={logout}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <BrandMark href={homeHref} size={28} showWordmark />
        </div>

        <NotificationBell />
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <Sidebar>
          <SidebarHeader className="justify-between gap-2 border-b border-border">
            {!collapsed ? (
              <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight text-slate-900">
                RescueGrid Ops
              </p>
            ) : null}
            <SidebarTrigger />
          </SidebarHeader>

          <SidebarContent>
            <ShellNavItems links={links} pathname={pathname} />
          </SidebarContent>

          <SidebarFooter>
            <SidebarProfileDropdown
              name={user?.name}
              role={user?.role}
              onLogout={logout}
            />
          </SidebarFooter>
        </Sidebar>

        <div className="ops-main-wrap relative min-w-0 flex-1 overflow-hidden">
          <main className="ops-main flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function OperatorShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SidebarProvider>
        <OperatorShellInner>{children}</OperatorShellInner>
      </SidebarProvider>
    </ToastProvider>
  );
}
