import { useState } from 'react'
import { SeriesList } from './components/SeriesList'
import { AddSeriesForm } from './components/AddSeriesForm'
import { EditSeriesForm } from './components/EditSeriesForm'
import { SearchFilter } from './components/SearchFilter'
import type { Series, SearchCriteria } from './types/series'

function App() {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<Series | null>(null)
  const [seriesListKey, setSeriesListKey] = useState(0)
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null)

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
      <SearchFilter onSearch={setCriteria} onClear={() => setCriteria(null)} />
      <SeriesList
        key={seriesListKey}
        onSeriesClick={setSelectedSeriesId}
        onAddClick={() => setIsAddFormOpen(true)}
        onEditClick={setEditingSeries}
        criteria={criteria ?? undefined}
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
