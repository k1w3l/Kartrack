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

// Sessão expirada/invalida: limpa o token e notifica o App para voltar ao login.
// Ignora as rotas de autenticação (o 401 ali é tratado na própria tela de login).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url = error?.config?.url || ''
    if (status === 401 && !url.includes('/auth/') && !url.includes('/fipe/')) {
      localStorage.removeItem('token')
      window.dispatchEvent(new Event('auth:unauthorized'))
    }
    return Promise.reject(error)
  },
)

export default api