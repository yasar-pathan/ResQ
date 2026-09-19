import { type ButtonHTMLAttributes, forwardRef } from "react";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ className = "", label, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={["btn btn-ghost btn-icon", className].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </button>
    );
  },
);
