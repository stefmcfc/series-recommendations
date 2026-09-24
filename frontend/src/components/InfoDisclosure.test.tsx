import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { InfoDisclosure } from './InfoDisclosure'

describe('FRONTEND-131-AC-01: InfoDisclosure toggles its description', () => {
  it('starts closed, with the description absent from the DOM', () => {
    render(
      <InfoDisclosure
        label="About Watch Region"
        description="Explains streaming availability."
      />,
    )
    const button = screen.getByRole('button', { name: 'About Watch Region' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByText('Explains streaming availability.'),
    ).not.toBeInTheDocument()
  })

  it('opens on click, showing the description, and closes again on a second click', () => {
    render(
      <InfoDisclosure
        label="About Watch Region"
        description="Explains streaming availability."
      />,
    )
    const button = screen.getByRole('button', { name: 'About Watch Region' })
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByText('Explains streaming availability.'),
    ).toBeInTheDocument()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByText('Explains streaming availability.'),
    ).not.toBeInTheDocument()
  })
})

describe('FRONTEND-131-AC-02: aria-controls links the button to its description', () => {
  it("sets aria-controls to the open description paragraph's id", () => {
    render(
      <InfoDisclosure
        label="About Watch Region"
        description="Explains streaming availability."
      />,
    )
    const button = screen.getByRole('button', { name: 'About Watch Region' })
    fireEvent.click(button)
    const description = screen.getByText('Explains streaming availability.')
    expect(button).toHaveAttribute('aria-controls', description.id)
    expect(description.id).not.toBe('')
  })
})
