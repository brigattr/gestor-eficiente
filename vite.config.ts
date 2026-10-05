import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relativa: funciona no GitHub Pages, em subpasta ou abrindo localmente
export default defineConfig({
  base: './',
  plugins: [react()],
})
