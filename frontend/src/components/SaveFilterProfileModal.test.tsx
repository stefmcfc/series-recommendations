import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { SaveFilterProfileModal } from './SaveFilterProfileModal'

describe('FRONTEND-108-AC-04: SaveFilterProfileModal pre-fills a suggested name', () => {
  it('shows the suggested name on open', () => {
    render(
      <SaveFilterProfileModal
        area="MY_SERIES"
        criteria={{ genres: ['Comedy'] }}
        existingNames={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/profile name/i)).toHaveValue('Comedy')
  })
})

describe('FRONTEND-108-AC-05: submit validates locally, handles a 409 from onSave', () => {
  it('does not call onSave when the name is a client-side duplicate', () => {
    const onSave = vi.fn()
    render(
      <SaveFilterProfileModal
        area="MY_SERIES"
        criteria={{}}
        existingNames={['Weeknight']}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText(/profile name/i), {
      target: { value: 'Weeknight' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i)
  })

  it('shows a duplicate message when onSave rejects with a 409', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error(), { status: 409 }))
    render(
      <SaveFilterProfileModal
        area="MY_SERIES"
        criteria={{}}
        existingNames={[]}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText(/profile name/i), {
      target: { value: 'New' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already exists/i,
    )
  })

  it('calls onSave with the trimmed name on a valid submission', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <SaveFilterProfileModal
        area="MY_SERIES"
        criteria={{}}
        existingNames={[]}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText(/profile name/i), {
      target: { value: '  New Profile  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(onSave).toHaveBeenCalledWith('New Profile')
  })
})

describe('FRONTEND-108-AC-06: cancel/escape close without saving', () => {
  it('Cancel calls onClose, not onSave', () => {
    const onClose = vi.fn()
    const onSave = vi.fn()
    render(
      <SaveFilterProfileModal
        area="MY_SERIES"
        criteria={{}}
        existingNames={[]}
        onSave={onSave}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('Escape on the dialog calls onClose, not onSave', () => {
    const onClose = vi.fn()
    const onSave = vi.fn()
    render(
      <SaveFilterProfileModal
        area="MY_SERIES"
        criteria={{}}
        existingNames={[]}
        onSave={onSave}
        onClose={onClose}
      />,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
