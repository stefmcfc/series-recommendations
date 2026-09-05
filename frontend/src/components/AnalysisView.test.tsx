import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AnalysisView } from './AnalysisView'
import { seriesApi } from '../services/seriesApi'

vi.mock('../services/seriesApi')
const mockGetKeywordStats = vi.mocked(seriesApi.getKeywordStats)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetKeywordStats.mockResolvedValue([])
})

// FRONTEND-087-AC-03/04: AnalysisView reads the `tab` param off the URL --
// rendered here inside the same <Route path="/analysis/:tab"> shape it's
// mounted under in App.tsx, with the starting path seeded via
// window.history.pushState (matching App.test.tsx's own routing-test
// convention) so window.location assertions reflect real navigation.
function renderAnalysisView(route: string) {
  window.history.pushState({}, '', route)
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/analysis/:tab" element={<AnalysisView />} />
      </Routes>
    </BrowserRouter>,
  )
}

describe('FRONTEND-087-AC-03/04: tab sub-nav and content', () => {
  it('renders the Keywords sub-nav tab and KeywordsView content', async () => {
    renderAnalysisView('/analysis/keywords')

    expect(
      screen.getByRole('link', { name: /^keywords$/i }),
    ).toBeInTheDocument()
    expect(await screen.findByTestId('keywords-view')).toBeInTheDocument()
  })

  it('renders the sub-nav with an accessible "Analysis" label', () => {
    renderAnalysisView('/analysis/keywords')

    expect(
      screen.getByRole('navigation', { name: /^analysis$/i }),
    ).toBeInTheDocument()
  })

  it('redirects an unrecognized tab to keywords', async () => {
    renderAnalysisView('/analysis/not-a-real-tab')

    await waitFor(() =>
      expect(window.location.pathname).toBe('/analysis/keywords'),
    )
    expect(await screen.findByTestId('keywords-view')).toBeInTheDocument()
  })
})
