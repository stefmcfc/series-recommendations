import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.env.DEV) {
  const [React, ReactDOM, axe] = await Promise.all([
    import('react'),
    import('react-dom'),
    import('@axe-core/react'),
  ])
  axe.default(React.default, ReactDOM.default, 1000)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
