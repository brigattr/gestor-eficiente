import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/baloo-2/700.css'
import '@fontsource/baloo-2/800.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { buildSeed } from './data/seed'
import { getPref, initStore, isEmpty, replaceAll, setPref } from './data/store'
import { restoreSession } from './lib/auth'
import { initFiles } from './lib/files'
import { persistir } from './lib/idb'

async function boot() {
  await Promise.all([initStore(), initFiles()])
  // Primeiro acesso: carrega dados de exemplo para explorar o sistema
  if (isEmpty() && !getPref('seeded', false)) {
    replaceAll(buildSeed())
    setPref('seeded', true)
  }
  restoreSession()
  void persistir()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  )
}
void boot()
