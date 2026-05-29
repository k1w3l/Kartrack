import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import api from '../api'
import { useUI } from './UIProvider'

const items = [
  { label: 'Início', url: '/', icon: 'fa-solid fa-house' },
  { label: 'Novo abastecimento', url: '/abastecimento', icon: 'fa-solid fa-gas-pump' },
  { label: 'Nova despesa', url: '/despesa', icon: 'fa-solid fa-receipt' },
  { label: 'Relatórios', url: '/relatorios', icon: 'fa-solid fa-chart-line' },
  { label: 'Meu veículo', url: '/veiculo', icon: 'fa-solid fa-car-side' },
  { label: 'Backup/Restore', url: '/backup-restore', icon: 'fa-solid fa-arrows-rotate' },
  { label: 'Registros', url: '/registros', icon: 'fa-solid fa-folder-open' },
  { label: 'Configurações', url: '/configuracoes', icon: 'fa-solid fa-gear' },
]

export default function Layout({ user, apiOrigin, children, onToggleTheme, darkMode, onLogout, menuOpen, onToggleMenu, onCloseMenu }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast, prompt } = useUI()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isMobileBrowser, setIsMobileBrowser] = useState(false)
  const userMenuRef = useRef(null)

  useEffect(() => {
    const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const mediaMobile = window.matchMedia('(max-width: 767px)').matches
    setIsMobileBrowser(uaMobile || mediaMobile)
  }, [])

  useEffect(() => {
    if (!userMenuOpen) return undefined
    const handlePointer = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setUserMenuOpen(false)
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [userMenuOpen])

  const handleChangePassword = async () => {
    setUserMenuOpen(false)
    const current = await prompt({ title: 'Trocar senha', label: 'Senha atual', inputType: 'password', titleIcon: 'fa-solid fa-key', confirmLabel: 'Continuar' })
    if (!current) return
    const next = await prompt({ title: 'Trocar senha', label: 'Nova senha', inputType: 'password', minLength: 6, titleIcon: 'fa-solid fa-key', confirmLabel: 'Alterar senha' })
    if (!next) return

    try {
      await api.post('/auth/change-password', { current_password: current, new_password: next })
      toast.success('Senha alterada com sucesso!')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Não foi possível alterar a senha.')
    }
  }

  return (
    <div className={`${darkMode ? 'theme-dark' : 'theme-light'} app-shell ${isMobileBrowser ? 'is-mobile-browser' : ''}`} data-bs-theme={darkMode ? 'dark' : 'light'}>
      <header className="app-header container-fluid d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-secondary btn-sm icon-btn d-md-none" onClick={onToggleMenu} title="Mostrar/ocultar menu">
            <i className="fa-solid fa-bars" />
          </button>
          <Link className="logo-link" to="/" title="Ir para a linha do tempo">
            <img
              className="app-logo me-2"
              src={`${apiOrigin}/uploads/${darkMode ? 'logo_dark.png' : 'logo_light.png'}`}
              alt="Kartrack"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </Link>
        </div>

        <div className="d-flex gap-2 align-items-center position-relative" ref={userMenuRef}>
          <button className="btn btn-outline-secondary btn-sm icon-btn" onClick={onToggleTheme} aria-pressed={darkMode} title={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}>
            <i className={`fa-solid ${darkMode ? 'fa-toggle-on' : 'fa-toggle-off'}`} />
          </button>

          <button className="btn btn-outline-secondary btn-sm icon-btn" onClick={() => setUserMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={userMenuOpen} title={user?.name || 'Usuário'}>
            <i className="fa-solid fa-circle-user" />
          </button>

          {userMenuOpen && (
            <div className="user-menu card shadow-sm">
              <div className="px-3 py-2 border-bottom fw-semibold">{user?.name || 'Usuário'}</div>
              <button className="dropdown-item" onClick={handleChangePassword}>
                <i className="fa-solid fa-key me-2" />Trocar senha
              </button>
              <button
                className="dropdown-item text-danger"
                onClick={() => {
                  setUserMenuOpen(false)
                  localStorage.removeItem('token')
                  onLogout?.()
                  navigate('/')
                }}
              >
                <i className="fa-solid fa-right-from-bracket me-2" />Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="container-fluid">
        <div className="row">
          <aside className={`col-md-3 col-lg-2 p-3 app-sidebar ${menuOpen ? 'show-mobile' : ''}`}>
            <nav className="nav flex-column gap-2">
              {items.map((item) => (
                <NavLink
                  key={item.url}
                  end={item.url === '/'}
                  className={({ isActive }) => `btn nav-btn text-start${isActive ? ' active' : ''}`}
                  to={item.url}
                  onClick={onCloseMenu}
                  title={item.label}
                >
                  {({ isActive }) => (
                    <>
                      <i className={`${item.icon} me-2`} />
                      <span className="nav-label">{item.label}</span>
                      {isActive && <span className="visually-hidden"> (página atual)</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </aside>
          <main className="col-12 col-md-9 col-lg-10 p-3 p-md-4">
            <div className="page-transition" key={location.pathname}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
