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

describe('FRONTEND-101-AC-05/08: optional icon is decorative', () => {
  it('renders an icon with aria-hidden and keeps the accessible name as the title alone', () => {
    render(
      <SettingsSection title="Example" icon={<svg data-testid="icon" />}>
        <button type="button">Do a thing</button>
      </SettingsSection>,
    )

    expect(screen.getByTestId('icon').closest('[aria-hidden]')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Example' })).toBeInTheDocument()
  })

  it('renders with no icon at all when the prop is omitted', () => {
    render(
      <SettingsSection title="No Icon">
        <button type="button">Do a thing</button>
      </SettingsSection>,
    )

    expect(screen.getByRole('heading', { name: 'No Icon' })).toBeInTheDocument()
  })
})
