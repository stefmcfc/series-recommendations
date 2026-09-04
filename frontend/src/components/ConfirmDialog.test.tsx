import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('FRONTEND-043-AC-01: ConfirmDialog renders message and actions', () => {
  it('renders as an alertdialog with default labels', () => {
    render(
      <ConfirmDialog
        message="Discard changes?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAccessibleDescription('Discard changes?')
    expect(
      screen.getByRole('button', { name: /^discard$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /keep editing/i }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-043-AC-02: ConfirmDialog button and Escape wiring', () => {
  it('calls onConfirm/onCancel appropriately, and Escape stops propagation', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const outerKeyDown = vi.fn()
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- test-only stand-in for an outer dialog's own onKeyDown handler, per FRONTEND-043-AC-02's test contract.
      <div onKeyDown={outerKeyDown}>
        <ConfirmDialog
          message="Discard changes?"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }))
    expect(onConfirm).toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
    expect(outerKeyDown).not.toHaveBeenCalled()
  })
})

describe('FRONTEND-043-AC-01/02: custom labels and cancel click', () => {
  it('renders custom confirmLabel/cancelLabel and calls onCancel on cancel click', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        message="Overwrite manually-corrected fields?"
        confirmLabel="Overwrite"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect(
      screen.getByRole('button', { name: /^overwrite$/i }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
