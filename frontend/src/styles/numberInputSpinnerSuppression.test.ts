import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// FRONTEND-115-AC-01: index.css is this app's one global (non-module)
// stylesheet, the natural home for a rule with no per-component variation
// (frontend_spec_115's Design Decisions) -- every input[type="number"]'s
// native spinner is suppressed here once, rather than duplicating the rule
// across 8 separate CSS Modules.
describe('FRONTEND-115-AC-01: global spinner suppression rule exists', () => {
  it('index.css defines the native spinner suppression rule', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../index.css'),
      'utf-8',
    )
    expect(css).toMatch(
      /input\[type=["']number["']\][\s\S]*-moz-appearance:\s*textfield/,
    )
    expect(css).toMatch(
      /::-webkit-(inner|outer)-spin-button[\s\S]*appearance:\s*none/,
    )
  })
})
