import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SettingsSection } from './SettingsSection'

describe('FRONTEND-097-AC-03: SettingsSection renders a title and its children', () => {
  it('renders the title as a heading and renders children', () => {
    render(
      <SettingsSection title="Example Section">
        <button type="button">Do a thing</button>
      </SettingsSection>,
    )

    expect(
      screen.getByRole('heading', { name: 'Example Section' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Do a thing' }),
    ).toBeInTheDocument()
  })
})
