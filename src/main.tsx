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
import { detectarModo } from './lib/api'
import { configurarServidor } from './lib/sync'

async function boot() {
  // Com a API do Cloudflare disponível, os dados ficam no servidor; senão, no navegador
  if ((await detectarModo()) === 'servidor') {
    configurarServidor()
    await restoreSession()
  } else {
    await Promise.all([initStore(), initFiles()])
    // Primeiro acesso local: dados de exemplo para explorar o sistema
    if (isEmpty() && !getPref('seeded', false)) {
      void replaceAll(buildSeed())
      setPref('seeded', true)
    }
    await restoreSession()
    void persistir()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  )
}
void boot()
