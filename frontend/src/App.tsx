import { useState } from 'react'
import { SeriesList } from './components/SeriesList'
import { SeriesDetail } from './components/SeriesDetail'
import { AddSeriesForm } from './components/AddSeriesForm'
import { EditSeriesForm } from './components/EditSeriesForm'
import type { Series } from './types/series'

function App() {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<Series | null>(null)
  const [seriesListKey, setSeriesListKey] = useState(0)
  const [seriesDetailKey, setSeriesDetailKey] = useState(0)

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
        <SeriesList
          key={seriesListKey}
          onSeriesClick={setSelectedSeriesId}
          onAddClick={() => setIsAddFormOpen(true)}
          onEditClick={setEditingSeries}
        />
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
