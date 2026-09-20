import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Spinner } from "@/components/ui/Spinner";

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
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className = "",
      variant = "primary",
      size = "default",
      type = "button",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading}
        className={[variantClass[variant], sizeClass[size], className].filter(Boolean).join(" ")}
        {...props}
      >
        {loading ? (
          <Spinner
            size={size === "sm" ? "sm" : size === "lg" ? "lg" : "default"}
            className={children ? "mr-1.5" : ""}
          />
        ) : null}
        {children}
      </button>
    );
  },
);
