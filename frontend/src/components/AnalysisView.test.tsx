import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AnalysisView } from './AnalysisView'
import { seriesApi } from '../services/seriesApi'

vi.mock('../services/seriesApi')
const mockGetKeywordStats = vi.mocked(seriesApi.getKeywordStats)
const mockGetGenreStats = vi.mocked(seriesApi.getGenreStats)
const mockGetCountryStats = vi.mocked(seriesApi.getCountryStats)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetKeywordStats.mockResolvedValue([])
  mockGetGenreStats.mockResolvedValue([])
  mockGetCountryStats.mockResolvedValue([])
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

describe('FRONTEND-088-AC-05: Genres tab', () => {
  it('renders the Genres sub-nav tab and GenreStatsView when the genres tab is active', async () => {
    renderAnalysisView('/analysis/genres')

    expect(screen.getByRole('link', { name: /^genres$/i })).toBeInTheDocument()
    expect(await screen.findByTestId('genre-stats-view')).toBeInTheDocument()
  })

  it('still renders the Keywords sub-nav tab and content when genres is active', async () => {
    renderAnalysisView('/analysis/genres')

    expect(
      screen.getByRole('link', { name: /^keywords$/i }),
    ).toBeInTheDocument()
    expect(await screen.findByTestId('genre-stats-view')).toBeInTheDocument()
  })

  it('does not redirect away from the genres tab', async () => {
    renderAnalysisView('/analysis/genres')

    expect(await screen.findByTestId('genre-stats-view')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/analysis/genres')
  })
})

describe('FRONTEND-089-AC-06: Country of Origin tab', () => {
  it('renders CountryStatsView when the country-of-origin tab is active', async () => {
    renderAnalysisView('/analysis/country-of-origin')

    expect(
      screen.getByRole('link', { name: /^country of origin$/i }),
    ).toBeInTheDocument()
    expect(await screen.findByTestId('country-stats-view')).toBeInTheDocument()
  })

  it('still renders the Keywords and Genres sub-nav tabs when country-of-origin is active', async () => {
    renderAnalysisView('/analysis/country-of-origin')

    expect(
      screen.getByRole('link', { name: /^keywords$/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^genres$/i })).toBeInTheDocument()
    expect(await screen.findByTestId('country-stats-view')).toBeInTheDocument()
  })

  it('does not redirect away from the country-of-origin tab', async () => {
    renderAnalysisView('/analysis/country-of-origin')

    expect(await screen.findByTestId('country-stats-view')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/analysis/country-of-origin')
  })
})

describe('FRONTEND-096-AC-11/12/13: filter/sort/panel state persists across tab switches', () => {
  it('keeps an applied filter value visible after switching from Keywords to Genres', async () => {
    renderAnalysisView('/analysis/keywords')
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))
    fireEvent.change(screen.getByLabelText('Min Series Count'), {
      target: { value: '5' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))
    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ minSeriesCount: 5 }),
      ),
    )

    fireEvent.click(screen.getByRole('link', { name: /^genres$/i }))

    await waitFor(() =>
      expect(mockGetGenreStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ minSeriesCount: 5 }),
      ),
    )
    expect(screen.getByLabelText('Min Series Count')).toHaveValue(5)
  })

  it('keeps the sort column/direction after switching tabs', async () => {
    renderAnalysisView('/analysis/keywords')
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('columnheader', { name: /series count/i }))
    await waitFor(() =>
      expect(mockGetKeywordStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'seriesCount' }),
      ),
    )

    fireEvent.click(screen.getByRole('link', { name: /country of origin/i }))

    await waitFor(() =>
      expect(mockGetCountryStats).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'seriesCount' }),
      ),
    )
  })

  it('keeps the filters panel open after switching tabs', async () => {
    renderAnalysisView('/analysis/keywords')
    await waitFor(() => expect(mockGetKeywordStats).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /analysis filters/i }))

    fireEvent.click(screen.getByRole('link', { name: /^genres$/i }))

    await waitFor(() => expect(mockGetGenreStats).toHaveBeenCalled())
    expect(
      screen.getByRole('button', { name: /analysis filters/i }),
    ).toHaveAttribute('aria-expanded', 'true')
  })
})
