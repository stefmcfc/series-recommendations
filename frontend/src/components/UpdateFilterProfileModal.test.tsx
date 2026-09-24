import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { UpdateFilterProfileModal } from './UpdateFilterProfileModal'

describe('FRONTEND-129-AC-06: UpdateFilterProfileModal pre-fills name and validates it', () => {
  it('shows an "Update Filter Profile" heading, matching SaveFilterProfileModal\'s shell', () => {
    render(
      <UpdateFilterProfileModal
        profile={{ id: '1', name: 'Weeknight', criteria: {} }}
        existingNames={['Weeknight', 'Other']}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('dialog', { name: /update filter profile/i }),
    ).toBeInTheDocument()
  })

  it("pre-fills the name field with the profile's current name", () => {
    render(
      <UpdateFilterProfileModal
        profile={{ id: '1', name: 'Weeknight', criteria: {} }}
        existingNames={['Weeknight', 'Other']}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/name/i)).toHaveValue('Weeknight')
  })

  it('notes that updating will overwrite the saved filters', () => {
    render(
      <UpdateFilterProfileModal
        profile={{ id: '1', name: 'Weeknight', criteria: {} }}
        existingNames={['Weeknight', 'Other']}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(/overwrite/i)).toBeInTheDocument()
  })

  it('does not flag the unchanged name as a duplicate of itself', () => {
    render(
      <UpdateFilterProfileModal
        profile={{ id: '1', name: 'Weeknight', criteria: {} }}
        existingNames={['Weeknight', 'Other']}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^update$/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it("rejects renaming to a different existing profile's name", () => {
    render(
      <UpdateFilterProfileModal
        profile={{ id: '1', name: 'Weeknight', criteria: {} }}
        existingNames={['Weeknight', 'Other']}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Other' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^update$/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i)
  })

  it('calls onUpdate with the trimmed (possibly renamed) name on a valid submission', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(
      <UpdateFilterProfileModal
        profile={{ id: '1', name: 'Weeknight', criteria: {} }}
        existingNames={['Weeknight', 'Other']}
        onUpdate={onUpdate}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: '  Weekend  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^update$/i }))
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('Weekend'))
  })

  it('shows an error inside the modal and keeps it open when onUpdate rejects', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('network'))
    render(
      <UpdateFilterProfileModal
        profile={{ id: '1', name: 'Weeknight', criteria: {} }}
        existingNames={['Weeknight']}
        onUpdate={onUpdate}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /^update$/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('FRONTEND-129-AC-06: cancel/escape close without updating', () => {
  it('Cancel calls onClose, not onUpdate', () => {
    const onClose = vi.fn()
    const onUpdate = vi.fn()
    render(
      <UpdateFilterProfileModal
        profile={{ id: '1', name: 'Weeknight', criteria: {} }}
        existingNames={['Weeknight']}
        onUpdate={onUpdate}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('Escape on the dialog calls onClose, not onUpdate', () => {
    const onClose = vi.fn()
    const onUpdate = vi.fn()
    render(
      <UpdateFilterProfileModal
        profile={{ id: '1', name: 'Weeknight', criteria: {} }}
        existingNames={['Weeknight']}
        onUpdate={onUpdate}
        onClose={onClose}
      />,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
