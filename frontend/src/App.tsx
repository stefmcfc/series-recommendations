import { useMemo, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useParams,
  type NavLinkRenderProps,
} from 'react-router-dom'
import { SeriesList } from './components/SeriesList'
import { SeriesDetail } from './components/SeriesDetail'
import { AddSeriesForm } from './components/AddSeriesForm'
import { EditSeriesForm } from './components/EditSeriesForm'
import { SearchFilter } from './components/SearchFilter'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { RecommendationsList } from './components/RecommendationsList'
import { RecommendationControls } from './components/RecommendationControls'
import { KeywordsView } from './components/KeywordsView'
import { SettingsPage } from './components/SettingsPage'
import {
  SeriesStatus,
  type Series,
  type SearchCriteria,
  type RecommendationQuery,
} from './types/series'
import styles from './App.module.css'

const navLinkClassName = ({ isActive }: NavLinkRenderProps) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink

// FRONTEND-056-AC-02: maps the lowercase :statusTab route param to the
// uppercase SeriesStatus enum value SeriesSearchCriteria.status expects.
// The bare /my-series route (statusTab undefined) and any unrecognized
// segment both fall through to "All" (status undefined).
function statusFromTabParam(statusTab?: string): SeriesStatus | undefined {
  switch (statusTab) {
    case 'watching':
      return SeriesStatus.WATCHING
    case 'completed':
      return SeriesStatus.COMPLETED
    case 'backlog':
      return SeriesStatus.BACKLOG
    case 'dropped':
      return SeriesStatus.DROPPED
    default:
      return undefined
  }
}

interface MySeriesViewProps {
  readonly criteria: SearchCriteria | null
  readonly onSearch: (criteria: SearchCriteria) => void
  readonly onClear: () => void
  readonly seriesListKey: number
  readonly onSeriesClick: (id: string) => void
  readonly onAddClick: () => void
  readonly onEditClick: (series: Series) => void
}

// FRONTEND-056-AC-01/02/05: renders the status tab bar plus the existing
// SearchFilter/ExportControls/SeriesList block, for both the bare
// /my-series route and the /my-series/:statusTab route. Status is derived
// purely from the URL here and merged into whatever SearchFilter itself
// produces -- SearchFilter no longer owns status at all (see
// frontend_spec_056's Design Decisions).
function MySeriesView({
  criteria,
  onSearch,
  onClear,
  seriesListKey,
  onSeriesClick,
  onAddClick,
  onEditClick,
}: MySeriesViewProps) {
  const { statusTab } = useParams<{ statusTab?: string }>()
  const status = statusFromTabParam(statusTab)
  // FRONTEND-073-AC-03/04: the live Title search box's raw value lives here
  // -- MySeriesView is the shared parent of SeriesList (which renders the
  // box) and effectiveCriteria (which needs the debounced value) -- debounced
  // 350ms before it drives a fetch, so a fetch isn't fired on every keystroke.
  const [rawTitle, setRawTitle] = useState('')
  const debouncedTitle = useDebouncedValue(rawTitle, 350)
  // Memoized so SeriesList's own effect (keyed on criteria object identity,
  // not deep equality) doesn't re-fetch on every unrelated App re-render --
  // only when criteria, the route-derived status, or the debounced title
  // actually change.
  const effectiveCriteria: SearchCriteria = useMemo(
    () => ({ ...criteria, status, title: debouncedTitle || undefined }),
    [criteria, status, debouncedTitle],
  )
  // FRONTEND-071-AC-09: the filter sheet's open/closed state is lifted here
  // -- the shared parent of the trigger (SeriesList) and the panel
  // (SearchFilter), which are otherwise unrelated siblings.
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  // FRONTEND-073-AC-06: derived from sheet-owned `criteria` only (set via
  // SearchFilter's onSearch) -- the live title box's rawTitle/debouncedTitle
  // deliberately never factors in here, since the funnel's dot signals
  // filters hidden inside the sheet, and title isn't hidden anywhere anymore.
  const hasActiveFilters = criteria != null && Object.keys(criteria).length > 0

  return (
    <>
      <nav className={styles.navLinks} aria-label="Status">
        <NavLink to="/my-series" end className={navLinkClassName}>
          All
        </NavLink>
        <NavLink to="/my-series/watching" className={navLinkClassName}>
          Watching
        </NavLink>
        <NavLink to="/my-series/completed" className={navLinkClassName}>
          Completed
        </NavLink>
        <NavLink to="/my-series/backlog" className={navLinkClassName}>
          Backlog
        </NavLink>
        <NavLink to="/my-series/dropped" className={navLinkClassName}>
          Dropped
        </NavLink>
      </nav>
      <SearchFilter
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        onSearch={onSearch}
        onClear={onClear}
      />
      <SeriesList
        key={seriesListKey}
        onSeriesClick={onSeriesClick}
        onAddClick={onAddClick}
        onEditClick={onEditClick}
        criteria={effectiveCriteria}
        isFiltersOpen={isFiltersOpen}
        onOpenFilters={() => setIsFiltersOpen(true)}
        hasActiveFilters={hasActiveFilters}
        titleSearch={rawTitle}
        onTitleSearchChange={setRawTitle}
      />
    </>
  )
}

function App() {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<Series | null>(null)
  const [seriesListKey, setSeriesListKey] = useState(0)
  const [seriesDetailKey, setSeriesDetailKey] = useState(0)
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null)
  const [recommendationQuery, setRecommendationQuery] = useState<
    RecommendationQuery | undefined
  >(undefined)
  // FRONTEND-040-AC-06: mirrors RecommendationsList's own loading state
  // upward so RecommendationControls can lock itself while a request it
  // triggered (directly via mode change, or via Apply Filters) is in flight.
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)

  const handleAddSuccess = () => {
    setIsAddFormOpen(false)
    setSeriesListKey((key) => key + 1)
  }

  const handleEditSuccess = () => {
    setEditingSeries(null)
    setSeriesListKey((key) => key + 1)
    setSeriesDetailKey((key) => key + 1)
  }

  const handleBackToList = () => {
    setSelectedSeriesId(null)
  }

  return (
    <BrowserRouter>
      <main>
        {selectedSeriesId ? (
          <SeriesDetail
            key={seriesDetailKey}
            id={selectedSeriesId}
            onBack={handleBackToList}
            onDeleted={handleBackToList}
            onEditClick={setEditingSeries}
          />
        ) : (
          <>
            <nav className={styles.nav}>
              <NavLink
                to="/my-series"
                data-testid="app-logo"
                className={styles.logo}
              >
                TV Series Tracker
              </NavLink>
              <div className={styles.navLinks}>
                <NavLink to="/my-series" className={navLinkClassName}>
                  My Series
                </NavLink>
                <NavLink to="/recommendations" className={navLinkClassName}>
                  Recommendations
                </NavLink>
                <NavLink to="/keywords" className={navLinkClassName}>
                  Keywords
                </NavLink>
                <NavLink to="/settings" className={navLinkClassName}>
                  Settings
                </NavLink>
              </div>
            </nav>

            <Routes>
              <Route path="/" element={<Navigate to="/my-series" replace />} />
              <Route
                path="/my-series"
                element={
                  <MySeriesView
                    criteria={criteria}
                    onSearch={setCriteria}
                    onClear={() => setCriteria(null)}
                    seriesListKey={seriesListKey}
                    onSeriesClick={setSelectedSeriesId}
                    onAddClick={() => setIsAddFormOpen(true)}
                    onEditClick={setEditingSeries}
                  />
                }
              />
              <Route
                path="/my-series/:statusTab"
                element={
                  <MySeriesView
                    criteria={criteria}
                    onSearch={setCriteria}
                    onClear={() => setCriteria(null)}
                    seriesListKey={seriesListKey}
                    onSeriesClick={setSelectedSeriesId}
                    onAddClick={() => setIsAddFormOpen(true)}
                    onEditClick={setEditingSeries}
                  />
                }
              />
              <Route
                path="/recommendations"
                element={
                  <>
                    <RecommendationControls
                      onQueryChange={setRecommendationQuery}
                      loading={recommendationsLoading}
                    />
                    <RecommendationsList
                      query={recommendationQuery}
                      onLoadingChange={setRecommendationsLoading}
                    />
                  </>
                }
              />
              <Route path="/keywords" element={<KeywordsView />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/my-series" replace />} />
            </Routes>
          </>
        )}
        {isAddFormOpen && (
          <AddSeriesForm
            onCancel={() => setIsAddFormOpen(false)}
            onSuccess={handleAddSuccess}
          />
        )}
        {editingSeries && (
          <EditSeriesForm
            series={editingSeries}
            onCancel={() => setEditingSeries(null)}
            onSuccess={handleEditSuccess}
          />
        )}
      </main>
    </BrowserRouter>
  )
}

export default App
