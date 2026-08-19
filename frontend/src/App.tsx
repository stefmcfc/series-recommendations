import { useState } from 'react'
import { SeriesList } from './components/SeriesList'
import { SeriesDetail } from './components/SeriesDetail'
import { AddSeriesForm } from './components/AddSeriesForm'
import { EditSeriesForm } from './components/EditSeriesForm'
import { ExportControls } from './components/ExportControls'
import { SearchFilter } from './components/SearchFilter'
import { RecommendationsList } from './components/RecommendationsList'
import type { Series, SearchCriteria } from './types/series'

type MainView = 'list' | 'recommendations'

function App() {
  const [mainView, setMainView] = useState<MainView>('list')
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<Series | null>(null)
  const [seriesListKey, setSeriesListKey] = useState(0)
  const [seriesDetailKey, setSeriesDetailKey] = useState(0)
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null)

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
          <nav>
            <button
              type="button"
              aria-pressed={mainView === 'list'}
              onClick={() => setMainView('list')}
            >
              My Series
            </button>
            <button
              type="button"
              aria-pressed={mainView === 'recommendations'}
              onClick={() => setMainView('recommendations')}
            >
              Recommendations
            </button>
          </nav>

          {mainView === 'recommendations' ? (
            <RecommendationsList />
          ) : (
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
          )}
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
  )
}

export default App
