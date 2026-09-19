import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={["ui-card", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={["ui-card-header", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function CardTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={["ui-card-title", className].filter(Boolean).join(" ")}>{children}</h2>;
}

export function CardDescription({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={["muted ui-card-desc", className].filter(Boolean).join(" ")}>{children}</p>;
}
