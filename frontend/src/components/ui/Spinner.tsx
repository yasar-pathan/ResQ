import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

export interface SpinnerProps extends ComponentPropsWithoutRef<typeof Loader2> {
  size?: "sm" | "default" | "lg" | "icon";
}

const sizeMap = {
  sm: "h-3.5 w-3.5",
  default: "h-4 w-4",
  lg: "h-6 w-6",
  icon: "h-4 w-4",
};

export function Spinner({ size = "default", className, ...props }: SpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin text-current", sizeMap[size], className)}
      role="status"
      aria-label="Loading"
      {...props}
    />
  );
}
