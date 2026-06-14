import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:3000', changeOrigin: true },
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/memoir': { target: 'http://localhost:3000', changeOrigin: true },
      '/ai': { target: 'http://localhost:3000', changeOrigin: true },
      '/oss': { target: 'http://localhost:3000', changeOrigin: true },
      '/friend': { target: 'http://localhost:3000', changeOrigin: true },
      '/hobby': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
      '/shared': { target: 'http://localhost:3000', changeOrigin: true },
      '/telecom': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
