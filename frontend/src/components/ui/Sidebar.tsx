"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ElementRef,
  type HTMLAttributes,
} from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "rescuegrid.ops.sidebar.collapsed";

type SidebarContextType = {
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within a <SidebarProvider />");
  }
  return ctx;
}

export function SidebarProvider({
  children,
  defaultCollapsed = false,
}: {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsedState] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === "1") setCollapsedState(true);
      else if (saved === "0") setCollapsedState(false);
    } catch {
      /* ignore */
    }
  }, []);

  const setCollapsed = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => !v);
  }, [setCollapsed]);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        setCollapsed,
        toggleCollapsed,
        mobileOpen,
        setMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export const Sidebar = forwardRef<
  HTMLElement,
  ComponentProps<"aside"> & { className?: string }
>(function Sidebar({ className, children, ...props }, ref) {
  const { collapsed } = useSidebar();

  return (
    <aside
      ref={ref}
      className={cn(
        "relative hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        collapsed ? "w-[64px]" : "w-[220px]",
        className,
      )}
      aria-label="Operator navigation"
      data-state={collapsed ? "collapsed" : "expanded"}
      {...props}
    >
      {children}
    </aside>
  );
});

export const SidebarHeader = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  function SidebarHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-white/10 px-3",
          className,
        )}
        {...props}
      />
    );
  },
);

export const SidebarContent = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  function SidebarContent({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("min-h-0 flex-1 overflow-y-auto px-2 py-3", className)}
        {...props}
      />
    );
  },
);

export const SidebarGroup = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  function SidebarGroup({ className, ...props }, ref) {
    return <div ref={ref} className={cn("space-y-1", className)} {...props} />;
  },
);

export const SidebarGroupLabel = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  function SidebarGroupLabel({ className, ...props }, ref) {
    const { collapsed } = useSidebar();
    if (collapsed) return null;
    return (
      <div
        ref={ref}
        className={cn("px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted", className)}
        {...props}
      />
    );
  },
);

export const SidebarMenu = forwardRef<HTMLUListElement, ComponentProps<"ul">>(
  function SidebarMenu({ className, ...props }, ref) {
    return (
      <ul
        ref={ref}
        className={cn("flex flex-col gap-1 list-none p-0 m-0", className)}
        {...props}
      />
    );
  },
);

export const SidebarMenuItem = forwardRef<HTMLLIElement, ComponentProps<"li">>(
  function SidebarMenuItem({ className, ...props }, ref) {
    return <li ref={ref} className={cn("relative list-none", className)} {...props} />;
  },
);

export const SidebarMenuButton = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & {
    isActive?: boolean;
    size?: "default" | "sm";
  }
>(function SidebarMenuButton(
  { className, isActive = false, size = "default", ...props },
  ref,
) {
  const { collapsed } = useSidebar();

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-medium transition-colors outline-none",
        "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
        isActive && "bg-primary text-white font-semibold hover:bg-primary",
        collapsed && "justify-center px-0 py-2.5",
        size === "sm" && "py-1.5 text-xs",
        className,
      )}
      {...props}
    />
  );
});

export const SidebarFooter = forwardRef<HTMLDivElement, ComponentProps<"div">>(
  function SidebarFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("mt-auto shrink-0 border-t border-white/10 p-2", className)}
        {...props}
      />
    );
  },
);

export const SidebarTrigger = forwardRef<HTMLButtonElement, ComponentProps<"button">>(
  function SidebarTrigger({ className, ...props }, ref) {
    const { collapsed, toggleCollapsed } = useSidebar();

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-control text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
          className,
        )}
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        {...props}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
        )}
      </button>
    );
  },
);
