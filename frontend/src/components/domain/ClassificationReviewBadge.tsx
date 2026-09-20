export function needsClassificationReview(
  confidence: number | null | undefined,
): boolean {
  return confidence != null && confidence < 0.5;
}

export function ClassificationReviewBadge({
  confidence,
  className = "",
}: {
  confidence: number | null | undefined;
  className?: string;
}) {
  if (!needsClassificationReview(confidence)) return null;
  return (
    <span
      className={`badge badge-warning inline-flex max-w-full shrink-0 items-center whitespace-nowrap px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide sm:text-xs ${className}`}
      title="Review classification"
    >
      Review AI
    </span>
  );
}
