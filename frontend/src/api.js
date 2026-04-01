import axios from 'axios'

function resolveApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_URL || '').trim()

  if (configured) return configured

  return '/api'
}

export const API_BASE_URL = resolveApiBaseUrl()

const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api