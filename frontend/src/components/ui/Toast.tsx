"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { AlertCircle, CheckCircle2, Info, Bell, X } from "lucide-react";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastVariant = "default" | "success" | "error" | "info";

export type ToastItem = {
  id: string;
  title?: string;
  description: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextType = {
  toast: (opts: Omit<ToastItem, "id">) => void;
};

// ─── Context & Hook ──────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

function ToastVariantIcon({ variant }: { variant?: ToastVariant }) {
  switch (variant) {
    case "success":
      return (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-600">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
        </span>
      );
    case "error":
      return (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100/80 text-red-600">
          <AlertCircle className="h-4 w-4" strokeWidth={2.5} />
        </span>
      );
    case "info":
      return (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100/80 text-blue-600">
          <Info className="h-4 w-4" strokeWidth={2.5} />
        </span>
      );
    default:
      return (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
          <Bell className="h-4 w-4" strokeWidth={2} />
        </span>
      );
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((opts: Omit<ToastItem, "id">) => {
    const id = String(++counter.current);
    setToasts((prev) => [...prev, { id, variant: "default", duration: 4500, ...opts }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastRoot
            key={t.id}
            open
            duration={t.duration}
            onOpenChange={(open) => {
              if (!open) remove(t.id);
            }}
            className={cn(
              t.variant === "success" && "border-emerald-200/80 shadow-emerald-500/10",
              t.variant === "error" && "border-red-200/80 shadow-red-500/10",
              t.variant === "info" && "border-blue-200/80 shadow-blue-500/10",
            )}
          >
            <ToastVariantIcon variant={t.variant} />
            <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
              {t.title && <ToastTitle>{t.title}</ToastTitle>}
              <ToastDescription>{t.description}</ToastDescription>
            </div>
            <ToastClose />
          </ToastRoot>
        ))}
        <ToastViewport />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

// ─── Primitives ──────────────────────────────────────────────────────────────

export const ToastRoot = forwardRef<
  ElementRef<typeof ToastPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Root>
>(function ToastRoot({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Root
      ref={ref}
      data-radix-toast-root=""
      className={cn(
        "pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-2xl backdrop-blur-md transition-all duration-300",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-full",
        className,
      )}
      {...props}
    />
  );
});

export const ToastTitle = forwardRef<
  ElementRef<typeof ToastPrimitive.Title>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(function ToastTitle({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Title
      ref={ref}
      className={cn("text-xs font-bold text-slate-900 tracking-tight", className)}
      {...props}
    />
  );
});

export const ToastDescription = forwardRef<
  ElementRef<typeof ToastPrimitive.Description>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(function ToastDescription({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Description
      ref={ref}
      className={cn("text-xs font-medium text-slate-600 leading-relaxed", className)}
      {...props}
    />
  );
});

export function ToastClose() {
  return (
    <ToastPrimitive.Close
      aria-label="Dismiss notification"
      className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
    >
      <X className="h-4 w-4" />
    </ToastPrimitive.Close>
  );
}

export function ToastViewport() {
  return (
    <ToastPrimitive.Viewport
      data-radix-toast-viewport=""
      className="fixed bottom-6 right-6 z-[9999] flex max-w-[400px] flex-col gap-2.5 outline-none pointer-events-none"
    />
  );
}
