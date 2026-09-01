import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { SeriesFormFields } from './SeriesFormFields'
import { SeriesStatus } from '../types/series'
import type { SeriesFormFieldsValues } from './SeriesFormFields'

function makeFormValues(
  overrides: Partial<SeriesFormFieldsValues> = {},
): SeriesFormFieldsValues {
  return {
    year: '',
    genres: '',
    tags: '',
    totalSeasons: '',
    totalEpisodes: '',
    status: SeriesStatus.BACKLOG,
    imdbRating: '',
    rottenTomatoesRating: '',
    rottenTomatoesPopcornmeter: '',
    personalRating: '',
    personalNotes: '',
    posterUrl: '',
    excludeFromRecommendations: false,
    ...overrides,
  }
}

function renderFields(
  overrides: Partial<SeriesFormFieldsValues> = {},
  children?: React.ReactNode,
) {
  return render(
    <SeriesFormFields
      form={makeFormValues(overrides)}
      fieldErrors={{}}
      updateField={() => vi.fn()}
      onPersonalRatingChange={vi.fn()}
      onPosterUrlChange={vi.fn()}
      onPosterLoadError={vi.fn()}
      onExcludeFromRecommendationsChange={vi.fn()}
      posterPreviewError={false}
    >
      {children}
    </SeriesFormFields>,
  )
}

describe('TOOLING-005-AC-03: renders the shared field set', () => {
  it('renders every shared field with its existing id/label', () => {
    renderFields()
    for (const label of [
      /^year/i,
      /^genres/i,
      /^tags/i,
      /total seasons/i,
      /total episodes/i,
      /^status/i,
      /^imdb rating/i,
      /tomatometer/i,
      /popcornmeter/i,
      /personal rating/i,
      /personal notes/i,
      /poster url/i,
      /exclude from recommendations/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('renders children between Total Episodes and Status', () => {
    render(
      <SeriesFormFields
        form={makeFormValues()}
        fieldErrors={{}}
        updateField={() => vi.fn()}
        onPersonalRatingChange={vi.fn()}
        onPosterUrlChange={vi.fn()}
        onPosterLoadError={vi.fn()}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={false}
      >
        <div data-testid="edit-only-fields">Current Season/Episode</div>
      </SeriesFormFields>,
    )
    expect(screen.getByTestId('edit-only-fields')).toBeInTheDocument()
  })

  it('shows a field error message when one is passed', () => {
    render(
      <SeriesFormFields
        form={makeFormValues()}
        fieldErrors={{ year: 'Year must be between 1900 and 2027' }}
        updateField={() => vi.fn()}
        onPersonalRatingChange={vi.fn()}
        onPosterUrlChange={vi.fn()}
        onPosterLoadError={vi.fn()}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={false}
      />,
    )
    expect(
      screen.getByText('Year must be between 1900 and 2027'),
    ).toBeInTheDocument()
  })

  it('calls updateField with the field name on change', () => {
    const updateFieldSpy = vi.fn()
    const handler = vi.fn()
    updateFieldSpy.mockReturnValue(handler)
    render(
      <SeriesFormFields
        form={makeFormValues()}
        fieldErrors={{}}
        updateField={updateFieldSpy}
        onPersonalRatingChange={vi.fn()}
        onPosterUrlChange={vi.fn()}
        onPosterLoadError={vi.fn()}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={false}
      />,
    )
    fireEvent.change(screen.getByLabelText(/^genres/i), {
      target: { value: 'Drama' },
    })
    expect(updateFieldSpy).toHaveBeenCalledWith('genres')
    expect(handler).toHaveBeenCalled()
  })

  it('FRONTEND-013-AC-07/AC-08: renders an interactive StarRating wired to onPersonalRatingChange', () => {
    const onPersonalRatingChange = vi.fn()
    render(
      <SeriesFormFields
        form={makeFormValues({ personalRating: '2' })}
        fieldErrors={{}}
        updateField={() => vi.fn()}
        onPersonalRatingChange={onPersonalRatingChange}
        onPosterUrlChange={vi.fn()}
        onPosterLoadError={vi.fn()}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={false}
      />,
    )
    fireEvent.click(screen.getByLabelText('Rate 4 star(s)'))
    expect(onPersonalRatingChange).toHaveBeenCalledWith(4)
  })

  it('renders the poster preview and calls onPosterLoadError when it fails to load', () => {
    const onPosterLoadError = vi.fn()
    const { container } = render(
      <SeriesFormFields
        form={makeFormValues({ posterUrl: 'https://example.com/poster.jpg' })}
        fieldErrors={{}}
        updateField={() => vi.fn()}
        onPersonalRatingChange={vi.fn()}
        onPosterUrlChange={vi.fn()}
        onPosterLoadError={onPosterLoadError}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={false}
      />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    fireEvent.error(img!)
    expect(onPosterLoadError).toHaveBeenCalled()
  })

  it('does not render the poster preview once posterPreviewError is true', () => {
    const { container } = render(
      <SeriesFormFields
        form={makeFormValues({ posterUrl: 'https://example.com/poster.jpg' })}
        fieldErrors={{}}
        updateField={() => vi.fn()}
        onPersonalRatingChange={vi.fn()}
        onPosterUrlChange={vi.fn()}
        onPosterLoadError={vi.fn()}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={true}
      />,
    )
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })
})

describe('FRONTEND-034-AC-03/04: source=recommendation trims fields and locks Status', () => {
  it('hides Total Seasons, Total Episodes, IMDb Rating, and Rotten Tomatoes Rating fields', () => {
    render(
      <SeriesFormFields
        form={makeFormValues()}
        fieldErrors={{}}
        updateField={() => vi.fn()}
        onPersonalRatingChange={vi.fn()}
        onPosterUrlChange={vi.fn()}
        onPosterLoadError={vi.fn()}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={false}
        source="recommendation"
      />,
    )
    for (const label of [
      /total seasons/i,
      /total episodes/i,
      /^imdb rating/i,
      /tomatometer/i,
      /popcornmeter/i,
    ]) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument()
    }
  })

  it('renders Status as read-only text instead of a select', () => {
    render(
      <SeriesFormFields
        form={makeFormValues({ status: SeriesStatus.COMPLETED })}
        fieldErrors={{}}
        updateField={() => vi.fn()}
        onPersonalRatingChange={vi.fn()}
        onPosterUrlChange={vi.fn()}
        onPosterLoadError={vi.fn()}
        onExcludeFromRecommendationsChange={vi.fn()}
        posterPreviewError={false}
        source="recommendation"
      />,
    )
    expect(
      screen.queryByRole('combobox', { name: /^status/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(SeriesStatus.COMPLETED)).toBeInTheDocument()
  })

  it('renders the full field set with an editable Status select when source is omitted', () => {
    renderFields()
    expect(screen.getByLabelText(/total seasons/i)).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: /^status/i }),
    ).toBeInTheDocument()
  })
})
