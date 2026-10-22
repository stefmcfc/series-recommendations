import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PillToggle } from './PillToggle'
import btn from '../styles/buttons.module.css'

describe('FRONTEND-139-AC-01: PillToggle rendering', () => {
  it('renders pressed with btnPrimary composed and aria-pressed true', () => {
    render(
      <PillToggle pressed onChange={vi.fn()}>
        Example
      </PillToggle>,
    )
    const button = screen.getByRole('button', { name: 'Example' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button.className).toContain(btn.btnPrimary)
  })

  it('renders unpressed with btnSecondary composed and aria-pressed false', () => {
    render(
      <PillToggle pressed={false} onChange={vi.fn()}>
        Example
      </PillToggle>,
    )
    const button = screen.getByRole('button', { name: 'Example' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button.className).toContain(btn.btnSecondary)
  })
})

describe('FRONTEND-139-AC-02: PillToggle onChange', () => {
  it('clicking calls onChange with the negated pressed value', () => {
    const onChange = vi.fn()
    render(
      <PillToggle pressed={false} onChange={onChange}>
        Example
      </PillToggle>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Example' }))
    expect(onChange).toHaveBeenCalledWith(true)

    onChange.mockClear()
    render(
      <PillToggle pressed onChange={onChange}>
        Example 2
      </PillToggle>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Example 2' }))
    expect(onChange).toHaveBeenCalledWith(false)
  })
})
