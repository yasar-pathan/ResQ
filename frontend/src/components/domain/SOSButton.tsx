"use client";

import { AlertTriangle } from "lucide-react";

type SOSButtonProps = {
  onActivate: () => void;
  disabled?: boolean;
  label?: string;
};

export function SOSButton({ onActivate, disabled, label = "Send SOS" }: SOSButtonProps) {
  return (
    <button
      type="button"
      className="btn btn-sos btn-sos-square sos-pulse"
      disabled={disabled}
      onClick={onActivate}
      aria-label={label}
    >
      <AlertTriangle size={32} aria-hidden />
      SOS
    </button>
  );
}
