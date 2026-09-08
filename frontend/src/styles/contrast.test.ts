import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Expands 3-digit hex shorthand (e.g. `#fff`) to its 6-digit form (`#ffffff`)
// so relativeLuminance can treat both notations identically. `--bg`'s light-mode
// value in index.css is written as the 3-digit shorthand `#fff`, which the
// original 6-digit-only regex below wouldn't match.
function expandHex(hex: string): string {
  if (hex.length === 4) {
    return `#${[...hex.slice(1)].map((c) => c + c).join('')}`
  }
  return hex
}

function relativeLuminance(hex: string): number {
  const full = expandHex(hex)
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(full.slice(i, i + 2), 16) / 255,
  )
  const linear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  const [lr, lg, lb] = [r, g, b].map(linear)
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

function contrastRatio(hexA: string, hexB: string): number {
  const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort(
    (a, b) => b - a,
  )
  return (l1 + 0.05) / (l2 + 0.05)
}

function extractVar(
  cssText: string,
  blockSelector: string,
  varName: string,
): string {
  const blockRe = new RegExp(`${blockSelector}\\s*\\{([^}]*)\\}`, 's')
  const block = blockRe.exec(cssText)?.[1] ?? ''
  return (
    new RegExp(`${varName}:\\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})`).exec(
      block,
    )?.[1] ?? ''
  )
}

describe('FRONTEND-103-AC-03/04: --control-border passes 3:1 against --bg in both themes', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8')

  it('light mode: --control-border vs --bg is >= 3:1', () => {
    const border = extractVar(css, ':root', '--control-border')
    const bg = extractVar(css, ':root', '--bg')
    expect(contrastRatio(border, bg)).toBeGreaterThanOrEqual(3)
  })

  it('dark mode: --control-border vs --bg is >= 3:1', () => {
    const border = extractVar(
      css,
      ":root\\[data-theme='dark'\\]",
      '--control-border',
    )
    const bg = extractVar(css, ":root\\[data-theme='dark'\\]", '--bg')
    expect(contrastRatio(border, bg)).toBeGreaterThanOrEqual(3)
  })
})

describe('FRONTEND-103-AC-05: --border is unchanged', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8')

  it('light --border stays #e5e4e7, dark stays #2e303a', () => {
    expect(extractVar(css, ':root', '--border')).toBe('#e5e4e7')
    expect(extractVar(css, ":root\\[data-theme='dark'\\]", '--border')).toBe(
      '#2e303a',
    )
  })
})
