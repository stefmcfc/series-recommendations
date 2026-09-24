import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// FRONTEND-124-AC-01: the [data-card-tint='on'] rule derives --card-bg via
// color-mix() from the currently-active --accent/--bg, rather than 10
// hand-picked hex values (2 per accent x 5 accents) -- see frontend_spec_124's
// Design Decisions. Pattern follows frontend_spec_121's
// `.tablistNested` sticky-declaration CSS-content test.
// FRONTEND-130-AC-01/AC-08: the flat color-mix() formula this block originally
// asserted was superseded by a 135deg diagonal linear-gradient after a live
// A/B/C/D comparison of candidate tint treatments -- see frontend_spec_130's
// Design Decisions. Only the first assertion below changed; the other two
// (surfaces.module.css/SeriesPosterGrid.module.css fallbacks) are unaffected,
// since neither consumer's fallback declaration changed.
describe('FRONTEND-124-AC-01: card tint CSS is correctly declared', () => {
  it('FRONTEND-130-AC-01: index.css declares the diagonal-gradient tint rule', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../index.css'),
      'utf-8',
    )
    expect(css).toMatch(
      /\[data-card-tint=['"]on['"]\]\s*\{[^}]*--card-bg:\s*linear-gradient\(\s*135deg,\s*color-mix\(in srgb,\s*var\(--accent\)\s*20%,\s*var\(--bg\)\)\s*0%,\s*var\(--bg\)\s*60%\s*\)/,
    )
  })

  it('surfaces.module.css falls back to --bg when the tint is unset', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, './surfaces.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/background:\s*var\(--card-bg,\s*var\(--bg\)\)/)
  })

  it('SeriesPosterGrid falls back to --social-bg when the tint is unset', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../components/SeriesPosterGrid.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/background:\s*var\(--card-bg,\s*var\(--social-bg\)\)/)
  })
})

// FRONTEND-130-AC-02/AC-05: toolbar chrome (SeriesList) and nested profile
// rows (FilterProfileAreaGroup, nested inside SettingsSection's own tinted
// card) both shadow --card-bg back to plain --bg, so neither competes with
// the content card it sits alongside/inside for the same tinted treatment --
// see frontend_spec_130's Design Decisions.
describe('FRONTEND-130-AC-02: toolbar does not inherit the card tint', () => {
  it('scopes --card-bg back to var(--bg) on .headerToolbar', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../components/SeriesList.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/\.headerToolbar\s*\{[^}]*--card-bg:\s*var\(--bg\)/)
  })
})

describe('FRONTEND-130-AC-05: nested profile rows do not double-tint', () => {
  it('scopes --card-bg back to var(--bg) on .row', () => {
    const css = fs.readFileSync(
      path.resolve(
        __dirname,
        '../components/FilterProfileAreaGroup.module.css',
      ),
      'utf-8',
    )
    expect(css).toMatch(/\.row\s*\{[^}]*--card-bg:\s*var\(--bg\)/)
  })
})

// FRONTEND-130-AC-03/AC-04: filter-section heading recolored to var(--accent-bg)
// (was the clashing var(--social-bg)) and panel spacing tightened -- see
// frontend_spec_130's Design Decisions.
describe('FRONTEND-130-AC-03: filter section heading uses --accent-bg', () => {
  it('backgrounds .filterSectionHeading with var(--accent-bg)', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../components/SearchFilter.module.css'),
      'utf-8',
    )
    expect(css).toMatch(
      /\.filterSectionHeading\s*\{[^}]*background:\s*var\(--accent-bg\)/,
    )
  })
})

describe('FRONTEND-130-AC-04: filter panel spacing tightened', () => {
  it('reduces .filterSection padding to 1rem', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../components/SearchFilter.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/\.filterSection\s*\{\s*padding:\s*1rem;/)
  })

  it('reduces .filtersBody gap to 1rem', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../components/SearchFilter.module.css'),
      'utf-8',
    )
    expect(css).toMatch(/\.filtersBody\s*\{[^}]*gap:\s*1rem/)
  })
})

// FRONTEND-130-AC-07: star-rating glyphs use --control-border (the same
// WCAG-passing token .btnSecondary's border already established) instead of
// --border, which was nearly invisible against the tinted card's lighter
// gradient overlay -- see frontend_spec_130's Design Decisions.
describe('FRONTEND-130-AC-07: star glyphs use --control-border, not --border', () => {
  it('bases .starEmpty/.starFilled color on var(--control-border)', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../components/StarRating.module.css'),
      'utf-8',
    )
    expect(css).toMatch(
      /\.starEmpty,\s*\n\.starFilled\s*\{[^}]*color:\s*var\(--control-border\)/,
    )
  })
})
