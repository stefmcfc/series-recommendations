import { useState } from 'react'
import { SeriesList } from './components/SeriesList'

function App() {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)

  return (
    <main>
      <SeriesList onSeriesClick={setSelectedSeriesId} />
      {selectedSeriesId && <p>Selected series id: {selectedSeriesId}</p>}
    </main>
  )
}

export default App
