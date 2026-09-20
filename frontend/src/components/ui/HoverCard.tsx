"use client";

import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const HoverCardRoot = HoverCardPrimitive.Root;
export const HoverCardTrigger = HoverCardPrimitive.Trigger;

export const HoverCardContent = forwardRef<
  ElementRef<typeof HoverCardPrimitive.Content>,
  ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(function HoverCardContent({ className, align = "start", sideOffset = 6, ...props }, ref) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        data-radix-hover-card-content=""
        className={cn(
          "z-50 w-64 rounded-panel border border-border bg-surface p-3 shadow-md",
          className,
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
});

/**
 * Convenience wrapper:
 * <HoverCard trigger={<span>Hover me</span>}>
 *   <p>Card content</p>
 * </HoverCard>
 */
export function HoverCard({
  trigger,
  children,
  openDelay = 300,
  closeDelay = 150,
}: {
  trigger: ReactNode;
  children: ReactNode;
  openDelay?: number;
  closeDelay?: number;
}) {
  return (
    <HoverCardRoot openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent>{children}</HoverCardContent>
    </HoverCardRoot>
  );
}
