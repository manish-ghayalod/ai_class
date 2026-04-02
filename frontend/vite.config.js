import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Set VITE_BASE to your GitHub Pages repo path, e.g. /my-repo-name
  // Leave unset (or set to /) if deploying to a root domain
  base: process.env.VITE_BASE || '/',
  server: {
    host: true,   // exposes dev server to your local network so phones can connect
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
