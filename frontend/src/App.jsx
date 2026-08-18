import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import api, { API_BASE_URL } from './api'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import FuelPage from './pages/FuelPage'
import ExpensePage from './pages/ExpensePage'
import ReportsPage from './pages/ReportsPage'
import VehiclePage from './pages/VehiclePage'
import RecordsPage from './pages/RecordsPage'
import BackupRestorePage from './pages/BackupRestorePage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [vehicleId, setVehicleId] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') !== 'light')

  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, '')

  useEffect(() => {
    const el = document.documentElement
    el.classList.toggle('theme-dark', darkMode)
    el.classList.toggle('theme-light', !darkMode)
  }, [darkMode])

  useEffect(() => {
    const pageTitles = {
      '/': 'Kartrack | Timeline',
      '/abastecimento': 'Kartrack | Novo abastecimento',
      '/despesa': 'Kartrack | Nova despesa',
      '/relatorios': 'Kartrack | Relatórios',
      '/veiculo': 'Kartrack | Meu veículo',
      '/backup-restore': 'Kartrack | Backup/Restore',
      '/registros': 'Kartrack | Registros',
      '/configuracoes': 'Kartrack | Configurações',
    }
    document.title = pageTitles[location.pathname] || 'Kartrack'
  }, [location.pathname])

  useEffect(() => {
    const href = `${apiOrigin}/uploads/favicon.svg`
    let link = document.querySelector("link[rel='icon']")
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'icon')
      document.head.appendChild(link)
    }
    link.setAttribute('href', href)
    link.setAttribute('type', 'image/svg+xml')
    let shortcut = document.querySelector("link[rel='shortcut icon']")
    if (!shortcut) {
      shortcut = document.createElement('link')
      shortcut.setAttribute('rel', 'shortcut icon')
      document.head.appendChild(shortcut)
    }
    shortcut.setAttribute('href', href)
    shortcut.setAttribute('type', 'image/svg+xml')
  }, [apiOrigin])

  const loadUser = async () => {
    try {
      const me = await api.get('/me')
      setUser(me.data)
      const { data } = await api.get('/vehicles')
      const normalized = data.map((v) => ({ ...v, foto_url: v.foto_url ? `${apiOrigin}${v.foto_url}` : null }))
      setVehicles(normalized)
      setVehicleId((prev) => {
        if (prev && normalized.some((v) => v.id === prev)) return prev
        return normalized[0]?.id || null
      })
    } catch {
      setUser(null)
      setVehicleId(null)
      setVehicles([])
    }
  }

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (!user) return
    localStorage.setItem('cartrack_last_path', `${location.pathname}${location.search}`)
  }, [user, location.pathname, location.search])

  useEffect(() => {
    if (!user) return
    const lastPath = localStorage.getItem('cartrack_last_path')
    if (!lastPath || location.pathname !== '/' || lastPath === '/') return
    navigate(lastPath, { replace: true })
  }, [user, location.pathname, navigate])

  const currentVehicle = useMemo(() => {
    const v = vehicles.find((x) => x.id === vehicleId) || vehicles[0] || null
    if (!v) return null
    return v
  }, [vehicles, vehicleId])

  const toggleTheme = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setVehicleId(null)
    setVehicles([])
  }

  useEffect(() => {
    const handleUnauthorized = () => logout()
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  if (!user) return <LoginPage onLogin={loadUser} darkMode={darkMode} onToggleTheme={toggleTheme} />

  return (
    <Layout
      user={user}
      apiOrigin={apiOrigin}
      onToggleTheme={toggleTheme}
      darkMode={darkMode}
      onLogout={logout}
      vehicles={vehicles}
      vehicleId={vehicleId}
      onSelectVehicle={setVehicleId}
    >
      <Routes>
        <Route path="/" element={<DashboardPage vehicleId={vehicleId} currentVehicle={currentVehicle} />} />
        <Route path="/abastecimento" element={<FuelPage vehicleId={vehicleId} />} />
        <Route path="/despesa" element={<ExpensePage vehicleId={vehicleId} />} />
        <Route path="/relatorios" element={<ReportsPage vehicleId={vehicleId} darkMode={darkMode} />} />
        <Route path="/veiculo" element={<VehiclePage onSaved={loadUser} activeVehicleId={vehicleId} setActiveVehicleId={setVehicleId} />} />
        <Route path="/backup-restore" element={<BackupRestorePage vehicleId={vehicleId} />} />
        <Route path="/registros" element={<RecordsPage vehicleId={vehicleId} />} />
        <Route path="/configuracoes" element={<SettingsPage user={user} onUserUpdated={loadUser} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
