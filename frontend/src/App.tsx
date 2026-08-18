import { useState } from 'react'
import { SeriesList } from './components/SeriesList'
import { AddSeriesForm } from './components/AddSeriesForm'
import { EditSeriesForm } from './components/EditSeriesForm'
import { ExportControls } from './components/ExportControls'
import type { Series } from './types/series'

function App() {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<Series | null>(null)
  const [seriesListKey, setSeriesListKey] = useState(0)

  const handleAddSuccess = () => {
    setIsAddFormOpen(false)
    setSeriesListKey((key) => key + 1)
  }

  const handleEditSuccess = () => {
    setEditingSeries(null)
    setSeriesListKey((key) => key + 1)
  }

  return (
    <main>
      <ExportControls />
      <SeriesList
        key={seriesListKey}
        onSeriesClick={setSelectedSeriesId}
        onAddClick={() => setIsAddFormOpen(true)}
        onEditClick={setEditingSeries}
      />
      {selectedSeriesId && <p>Selected series id: {selectedSeriesId}</p>}
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
