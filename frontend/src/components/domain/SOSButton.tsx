"use client";

type SOSButtonProps = {
  onActivate: () => void;
  disabled?: boolean;
  label?: string;
};

export function SOSButton({ onActivate, disabled, label = "Send SOS" }: SOSButtonProps) {
  return (
    <button
      type="button"
      className="btn btn-sos"
      disabled={disabled}
      onClick={onActivate}
      aria-label={label}
    >
      <span aria-hidden="true">●</span>
      SOS
    </button>
  );
}
