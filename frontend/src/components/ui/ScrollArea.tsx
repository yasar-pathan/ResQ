"use client";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import { cn } from "@/lib/utils";

export const ScrollArea = forwardRef<
  ElementRef<typeof ScrollAreaPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    withFade?: boolean;
    fadeBoth?: boolean;
    viewportClassName?: string;
  }
>(function ScrollArea(
  { className, children, withFade = false, fadeBoth = false, viewportClassName, ...props },
  ref,
) {
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const enableFade = withFade || fadeBoth;

  const checkScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setCanScrollUp(scrollTop > 4);
    setCanScrollDown(scrollHeight - scrollTop - clientHeight > 6);
  }, []);

  useEffect(() => {
    if (!enableFade) return;
    const el = viewportRef.current;
    if (!el) return;

    checkScroll();
    const frameId = requestAnimationFrame(checkScroll);
    const timeoutId = setTimeout(checkScroll, 100);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => checkScroll());
      ro.observe(el);
      const firstChild = el.firstElementChild as HTMLElement | null;
      if (firstChild) {
        ro.observe(firstChild);
        if (firstChild.firstElementChild) {
          ro.observe(firstChild.firstElementChild as HTMLElement);
        }
      }
    }

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
      ro?.disconnect();
    };
  }, [enableFade, checkScroll, children]);

  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      {enableFade ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-0 left-0 right-2.5 z-10 h-7 bg-gradient-to-b from-white via-white/80 to-transparent transition-opacity duration-200",
            canScrollUp ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}

      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        onScroll={enableFade ? checkScroll : undefined}
        className={cn(
          "h-full w-full rounded-[inherit]",
          viewportClassName,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      {enableFade ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-0 left-0 right-2.5 z-10 h-10 bg-gradient-to-t from-white via-white/85 to-transparent transition-opacity duration-200",
            canScrollDown ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}

      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});

export const ScrollBar = forwardRef<
  ElementRef<typeof ScrollAreaPrimitive.Scrollbar>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>
>(function ScrollBar({ className, orientation = "vertical", ...props }, ref) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        "flex touch-none select-none transition-colors",
        orientation === "vertical" && "h-full w-2 border-l border-l-transparent p-px",
        orientation === "horizontal" && "h-2 flex-col border-t border-t-transparent p-px",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-slate-300 transition-colors hover:bg-slate-400" />
    </ScrollAreaPrimitive.Scrollbar>
  );
});
