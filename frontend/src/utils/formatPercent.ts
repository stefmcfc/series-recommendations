// FRONTEND-119-AC-11 (Correction, 2026-09-11): extracted from
// SeriesDetailFields.tsx's former private helper of the same name -- a third
// consumer (SeriesList.tsx's expanded-row rating column, frontend_spec_119;
// SeriesCompactGrid.tsx via SeriesList.tsx's formatCompactRatingLabel,
// frontend_spec_120) justifies pulling it into a shared util per
// frontend_conventions.md's "extract on a third consumer" rule.
export function formatPercent(value: number | null, emoji: string): string {
  return value === null ? '—' : `${value}% ${emoji}`
}
