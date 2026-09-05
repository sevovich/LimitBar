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

  it('provides global window toggles and Claude source selection', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    expect(screen.getByLabelText(/Show 5-hour limits/)).toBeChecked()
    expect(screen.getByLabelText(/Show weekly limits/)).toBeChecked()
    expect(screen.getByRole('radio', { name: 'OAuth' })).toBeChecked()

    fireEvent.click(screen.getByRole('radio', { name: 'Local' }))
    expect(screen.getByRole('radio', { name: 'Local' })).toBeChecked()
  })
})
