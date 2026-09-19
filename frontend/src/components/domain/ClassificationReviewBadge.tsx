export function needsClassificationReview(
  confidence: number | null | undefined,
): boolean {
  return confidence != null && confidence < 0.5;
}

export function ClassificationReviewBadge({
  confidence,
}: {
  confidence: number | null | undefined;
}) {
  if (!needsClassificationReview(confidence)) return null;
  return (
    <span className="badge badge-warning inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
      Review classification
    </span>
  );
}
