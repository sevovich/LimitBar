import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../src/renderer/App'

describe('LimitBar renderer', () => {
  it('shows remaining Codex and Claude limits', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Codex' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Claude' })).toBeInTheDocument()
    expect(screen.getAllByText('68')[0]).toBeInTheDocument()
    expect(screen.getAllByText('53')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Weekly')).toHaveLength(2)
  })

  it('provides global window and reset toggles', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    expect(screen.getByLabelText(/Show 5-hour limits/)).toBeChecked()
    expect(screen.getByLabelText(/Show 5-hour reset/)).not.toBeChecked()
    expect(screen.getByLabelText(/Show weekly limits/)).toBeChecked()
    expect(screen.getByLabelText(/Show weekly reset/)).not.toBeChecked()

    fireEvent.click(screen.getByLabelText(/Show 5-hour reset/))
    expect(screen.getByLabelText(/Show 5-hour reset/)).toBeChecked()
  })

  it('keeps both provider windows visible when a menu bar window is hidden', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByLabelText(/Show weekly limits/))

    expect(screen.getAllByText('Weekly')).toHaveLength(2)
    expect(screen.getByText('39', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('27', { exact: true })).toBeInTheDocument()
  })
})
