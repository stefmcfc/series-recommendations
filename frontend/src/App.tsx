import { useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  type NavLinkRenderProps,
} from 'react-router-dom'
import { SeriesList } from './components/SeriesList'
import { SeriesDetail } from './components/SeriesDetail'
import { AddSeriesForm } from './components/AddSeriesForm'
import { EditSeriesForm } from './components/EditSeriesForm'
import { ExportControls } from './components/ExportControls'
import { SearchFilter } from './components/SearchFilter'
import { RecommendationsList } from './components/RecommendationsList'
import { RecommendationControls } from './components/RecommendationControls'
import { KeywordsView } from './components/KeywordsView'
import type {
  Series,
  SearchCriteria,
  RecommendationQuery,
} from './types/series'
import styles from './App.module.css'

const navLinkClassName = ({ isActive }: NavLinkRenderProps) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink

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
                <NavLink to="/my-series" end className={navLinkClassName}>
                  My Series
                </NavLink>
                <NavLink to="/recommendations" className={navLinkClassName}>
                  Recommendations
                </NavLink>
                <NavLink to="/keywords" className={navLinkClassName}>
                  Keywords
                </NavLink>
              </div>
            </nav>

            <Routes>
              <Route path="/" element={<Navigate to="/my-series" replace />} />
              <Route
                path="/my-series"
                element={
                  <>
                    <SearchFilter
                      onSearch={setCriteria}
                      onClear={() => setCriteria(null)}
                    />
                    <ExportControls criteria={criteria ?? undefined} />
                    <SeriesList
                      key={seriesListKey}
                      onSeriesClick={setSelectedSeriesId}
                      onAddClick={() => setIsAddFormOpen(true)}
                      onEditClick={setEditingSeries}
                      criteria={criteria ?? undefined}
                    />
                  </>
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
