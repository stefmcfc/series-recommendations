import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SettingsPage } from './SettingsPage'

describe('FRONTEND-070-AC-03: SettingsPage renders placeholder content', () => {
  it('renders a heading and placeholder copy', () => {
    render(<SettingsPage />)

    expect(screen.getByTestId('settings-view')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/no settings/i)).toBeInTheDocument()
  })
})
