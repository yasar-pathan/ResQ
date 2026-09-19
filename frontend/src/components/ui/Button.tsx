import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "sos" | "danger";
type Size = "default" | "sm" | "lg" | "icon";

const variantClass: Record<Variant, string> = {
  primary: "btn btn-primary",
  secondary: "btn btn-secondary",
  ghost: "btn btn-ghost",
  sos: "btn btn-sos",
  danger: "btn btn-danger",
};

const sizeClass: Record<Size, string> = {
  default: "",
  sm: "btn-sm",
  lg: "btn-lg",
  icon: "btn-icon",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className = "", variant = "primary", size = "default", type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={[variantClass[variant], sizeClass[size], className].filter(Boolean).join(" ")}
        {...props}
      />
    );
  },
);
