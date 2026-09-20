"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
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
              t.variant === "success" && "toast-success",
              t.variant === "error" && "toast-error",
              t.variant === "info" && "toast-info",
            )}
          >
            <div className="min-w-0 flex-1">
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
        "flex items-start gap-3 rounded-panel border border-border bg-white px-4 py-3 shadow-lg text-sm pointer-events-auto",
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
      className={cn("text-sm font-semibold", className)}
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
      className={cn("text-sm text-muted", className)}
      {...props}
    />
  );
});

export function ToastClose() {
  return (
    <ToastPrimitive.Close
      aria-label="Dismiss notification"
      className="shrink-0 rounded-control p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      <X className="h-3.5 w-3.5" />
    </ToastPrimitive.Close>
  );
}

export function ToastViewport() {
  return (
    <ToastPrimitive.Viewport
      data-radix-toast-viewport=""
      className="fixed bottom-5 right-5 z-[999] flex max-w-[380px] flex-col gap-2 outline-none"
    />
  );
}
