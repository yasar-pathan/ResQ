export function Separator({ className = "" }: { className?: string }) {
  return <hr className={["ui-separator", className].filter(Boolean).join(" ")} />;
}
