import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { NumberInput } from './NumberInput'

describe('FRONTEND-115-AC-02: renders themed increment/decrement buttons', () => {
  it('renders an input and two spinner buttons', () => {
    render(<NumberInput label="Year" value={2020} onChange={() => {}} />)
    expect(screen.getByRole('spinbutton', { name: 'Year' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /increment|increase/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /decrement|decrease/i }),
    ).toBeInTheDocument()
  })
})

describe('FRONTEND-115-AC-03: prop surface mirrors a plain number input', () => {
  it('calls onChange with the typed value', async () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="Min Rating"
        value={5}
        onChange={onChange}
        min={0}
        max={10}
        step={0.1}
      />,
    )
    await userEvent.clear(
      screen.getByRole('spinbutton', { name: 'Min Rating' }),
    )
    await userEvent.type(
      screen.getByRole('spinbutton', { name: 'Min Rating' }),
      '7.5',
    )
    expect(onChange).toHaveBeenCalled()
  })

  it('forwards min/max/step/disabled/id onto the native input', () => {
    render(
      <NumberInput
        id="custom-id"
        label="Min Rating"
        value={5}
        onChange={() => {}}
        min={0}
        max={10}
        step={0.1}
        disabled
      />,
    )
    const input = screen.getByRole('spinbutton', { name: 'Min Rating' })
    expect(input).toHaveAttribute('id', 'custom-id')
    expect(input).toHaveAttribute('min', '0')
    expect(input).toHaveAttribute('max', '10')
    expect(input).toHaveAttribute('step', '0.1')
    expect(input).toBeDisabled()
  })
})

describe('FRONTEND-115-AC-04: increment/decrement respects step and clamps to min/max', () => {
  it('increments by step and stops at max', async () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="Rating"
        value={9.9}
        onChange={onChange}
        max={10}
        step={0.1}
      />,
    )
    await userEvent.click(
      screen.getByRole('button', { name: /increment|increase/i }),
    )
    expect(onChange).toHaveBeenCalledWith(10)
    await userEvent.click(
      screen.getByRole('button', { name: /increment|increase/i }),
    )
    expect(onChange).not.toHaveBeenCalledWith(10.1)
  })

  it('decrements by step and stops at min', async () => {
    const onChange = vi.fn()
    render(
      <NumberInput
        label="Rating"
        value={0.1}
        onChange={onChange}
        min={0}
        step={0.1}
      />,
    )
    await userEvent.click(
      screen.getByRole('button', { name: /decrement|decrease/i }),
    )
    expect(onChange).toHaveBeenCalledWith(0)
    await userEvent.click(
      screen.getByRole('button', { name: /decrement|decrease/i }),
    )
    expect(onChange).not.toHaveBeenCalledWith(-0.1)
  })

  it('defaults step to 1 when omitted', async () => {
    const onChange = vi.fn()
    render(<NumberInput label="Count" value={5} onChange={onChange} />)
    await userEvent.click(
      screen.getByRole('button', { name: /increment|increase/i }),
    )
    expect(onChange).toHaveBeenCalledWith(6)
  })

  it('does not adjust the value when disabled', async () => {
    const onChange = vi.fn()
    render(<NumberInput label="Count" value={5} onChange={onChange} disabled />)
    expect(
      screen.getByRole('button', { name: /increment|increase/i }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /decrement|decrease/i }),
    ).toBeDisabled()
  })
})
