import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { buildSeed } from './data/seed'
import { getPref, isEmpty, replaceAll, setPref } from './data/store'

// Primeiro acesso: carrega dados de exemplo para explorar o sistema
if (isEmpty() && !getPref('seeded', false)) {
  replaceAll(buildSeed())
  setPref('seeded', true)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
