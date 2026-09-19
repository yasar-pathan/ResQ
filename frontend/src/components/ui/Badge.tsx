import type { HTMLAttributes, ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "error" | "info" | "sos" | "accent";

const toneClass: Record<Tone, string> = {
  default: "badge",
  success: "badge badge-success",
  warning: "badge badge-warning",
  error: "badge badge-error",
  info: "badge badge-info",
  sos: "badge badge-sos",
  accent: "badge badge-accent",
};

export function Badge({
  children,
  tone = "default",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; children: ReactNode }) {
  return (
    <span className={[toneClass[tone], className].filter(Boolean).join(" ")} {...props}>
      {children}
    </span>
  );
}
