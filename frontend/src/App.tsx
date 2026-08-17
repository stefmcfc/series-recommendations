import { useState } from 'react'
import { SeriesList } from './components/SeriesList'
import { AddSeriesForm } from './components/AddSeriesForm'

function App() {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)
  const [seriesListKey, setSeriesListKey] = useState(0)

  const handleAddSuccess = () => {
    setIsAddFormOpen(false)
    setSeriesListKey((key) => key + 1)
  }

  return (
    <main>
      <SeriesList
        key={seriesListKey}
        onSeriesClick={setSelectedSeriesId}
        onAddClick={() => setIsAddFormOpen(true)}
      />
      {selectedSeriesId && <p>Selected series id: {selectedSeriesId}</p>}
      {isAddFormOpen && (
        <AddSeriesForm
          onCancel={() => setIsAddFormOpen(false)}
          onSuccess={handleAddSuccess}
        />
      )}
    </main>
  )
}

export default App
