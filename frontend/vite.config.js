import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
const allowedHosts = process.env.ALLOWED_HOST
  ? process.env.ALLOWED_HOST.split(',').map((h) => h.trim())
  : 'all'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
