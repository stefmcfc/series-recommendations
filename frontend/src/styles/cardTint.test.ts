import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// FRONTEND-124-AC-01: the [data-card-tint='on'] rule derives --card-bg via
// color-mix() from the currently-active --accent/--bg, rather than 10
// hand-picked hex values (2 per accent x 5 accents) -- see frontend_spec_124's
// Design Decisions. Pattern follows frontend_spec_121's
// `.tablistNested` sticky-declaration CSS-content test.
describe('FRONTEND-124-AC-01: card tint CSS is correctly declared', () => {
  it('index.css declares the color-mix tint rule', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../index.css'),
      'utf-8',
    )
    expect(css).toMatch(
      /\[data-card-tint=['"]on['"]\]\s*\{[^}]*--card-bg:\s*color-mix\(in srgb,\s*var\(--accent\)\s*12%,\s*var\(--bg\)\)/,
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
