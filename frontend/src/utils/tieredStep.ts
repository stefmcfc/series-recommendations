// FRONTEND-122-AC-05/06: shared tiered-step resolver for NumberInput's
// dynamic `step` prop -- turns a small sorted array of `{from, step}`
// breakpoints into a `(currentValue: number) => number` resolver, reused by
// every rating/year control in the app instead of three bespoke functions
// (this spec's Design Decisions).

import { MIN_VALID_YEAR } from './yearBounds'

export interface StepBreakpoint {
  from: number
  step: number
}

// FRONTEND-122-AC-05: breakpoints are assumed pre-sorted ascending by `from`
// -- each breakpoint's `from` is where that (finer) step begins, so the
// resolver returns the step of the highest breakpoint whose `from` is `<=`
// the current value. A value below every breakpoint's `from` (e.g. a blank
// field defaulting to 0 for a scale that starts higher, like years) falls
// back to the first (coarsest) breakpoint's step, rather than being
// undefined.
export function resolveTieredStep(
  breakpoints: readonly StepBreakpoint[],
): (currentValue: number) => number {
  return (currentValue: number) => {
    let resolved = breakpoints[0].step
    for (const breakpoint of breakpoints) {
      if (breakpoint.from <= currentValue) resolved = breakpoint.step
    }
    return resolved
  }
}

// FRONTEND-122-AC-06: 0-10 IMDb/TMDB rating scale -- coarse (1) below 6,
// half-steps (0.5) from 6, tenths (0.1) from 8.
export const RATING_STEP_BREAKPOINTS: readonly StepBreakpoint[] = [
  { from: 0, step: 1 },
  { from: 6, step: 0.5 },
  { from: 8, step: 0.1 },
]

// FRONTEND-122-AC-06: 0-100 Rotten Tomatoes Tomatometer/Popcornmeter scale --
// coarse (10) below 60, finer (5) from 60, finest (1) from 80.
export const ROTTEN_TOMATOES_STEP_BREAKPOINTS: readonly StepBreakpoint[] = [
  { from: 0, step: 10 },
  { from: 60, step: 5 },
  { from: 80, step: 1 },
]

// FRONTEND-122-AC-06: year fields -- coarse (10) below 2010, fine (1) from
// 2010 onwards. The 2010 threshold is a fixed constant, not computed from
// the current date (confirmed with the user; see this spec's Design
// Decisions) -- it will need a manual update in some future decade if
// "recent years" should mean something different than "2010+" by then.
export const YEAR_STEP_BREAKPOINTS: readonly StepBreakpoint[] = [
  { from: MIN_VALID_YEAR, step: 10 },
  { from: 2010, step: 1 },
]
