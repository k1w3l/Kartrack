import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import api from '../api'
import { useUI } from './UIProvider'
import Icon from './Icon'

const railGroups = [
  {
    label: 'Operar',
    items: [
      { label: 'Início', url: '/', icon: 'home' },
      { label: 'Abastecimento', url: '/abastecimento', icon: 'fuel' },
      { label: 'Despesa', url: '/despesa', icon: 'receipt' },
    ],
  },
  {
    label: 'Analisar',
    items: [
      { label: 'Relatórios', url: '/relatorios', icon: 'lineChart' },
      { label: 'Registros', url: '/registros', icon: 'folderOpen' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Veículo', url: '/veiculo', icon: 'car' },
      { label: 'Backup', url: '/backup-restore', icon: 'refresh' },
      { label: 'Configurações', url: '/configuracoes', icon: 'settings' },
    ],
  },
]

const bottomItems = [
  { label: 'Início', url: '/', icon: 'home' },
  { label: 'Abastecer', url: '/abastecimento', icon: 'fuel' },
  { label: 'Despesa', url: '/despesa', icon: 'receipt' },
  { label: 'Relatórios', url: '/relatorios', icon: 'lineChart' },
]

const moreItems = [
  { label: 'Meu veículo', url: '/veiculo', icon: 'car' },
  { label: 'Registros', url: '/registros', icon: 'folderOpen' },
  { label: 'Backup/Restore', url: '/backup-restore', icon: 'refresh' },
  { label: 'Configurações', url: '/configuracoes', icon: 'settings' },
]

const moreUrls = moreItems.map((item) => item.url)

export default function Layout({
  user,
  apiOrigin,
  children,
  onToggleTheme,
  darkMode,
  onLogout,
  vehicles = [],
  vehicleId,
  onSelectVehicle,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast, prompt } = useUI()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('kartrack_rail_collapsed') === '1')
  const userMenuRef = useRef(null)

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

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  const toggleRail = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('kartrack_rail_collapsed', next ? '1' : '0')
  }

  const handleChangePassword = async () => {
    setUserMenuOpen(false)
    const current = await prompt({ title: 'Trocar senha', label: 'Senha atual', inputType: 'password', titleIcon: 'key', confirmLabel: 'Continuar' })
    if (!current) return
    const next = await prompt({ title: 'Trocar senha', label: 'Nova senha', inputType: 'password', minLength: 6, titleIcon: 'key', confirmLabel: 'Alterar senha' })
    if (!next) return

    try {
      await api.post('/auth/change-password', { current_password: current, new_password: next })
      toast.success('Senha alterada com sucesso!')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Não foi possível alterar a senha.')
    }
  }

  const moreActive = moreUrls.includes(location.pathname)

  return (
    <div className={`app-shell${collapsed ? ' is-collapsed' : ''}`}>
      <header className="app-header">
        <div className="header-left">
          <button type="button" className="btn btn-ghost icon-btn rail-toggle" onClick={toggleRail} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
            <Icon name={collapsed ? 'panelOpen' : 'panelClose'} />
          </button>
          <Link className="logo-link" to="/" title="Ir para a linha do tempo">
            <img
              className="app-logo"
              src={`${apiOrigin}/uploads/${darkMode ? 'logo_dark.svg' : 'logo_light.svg'}`}
              alt="Kartrack"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </Link>
        </div>

        <div className="header-right" ref={userMenuRef}>
          {vehicles.length > 0 && (
            <select
              className="select vehicle-switcher"
              value={vehicleId || ''}
              onChange={(e) => onSelectVehicle?.(Number(e.target.value))}
              aria-label="Veículo ativo"
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.nome || vehicle.placa || `Veículo ${vehicle.id}`}</option>
              ))}
            </select>
          )}
          <button type="button" className="btn btn-ghost icon-btn" onClick={onToggleTheme} aria-pressed={darkMode} title={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}>
            <Icon name={darkMode ? 'sun' : 'moon'} />
          </button>
          <button type="button" className="btn btn-ghost icon-btn" onClick={() => setUserMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={userMenuOpen} title={user?.name || 'Usuário'}>
            <Icon name="circleUser" />
          </button>
          {userMenuOpen && (
            <div className="user-menu card">
              <div className="page-title" style={{ fontSize: '0.95rem', marginBottom: 8 }}>{user?.name || 'Usuário'}</div>
              <button className="dropdown-item" type="button" onClick={handleChangePassword}>
                <Icon name="key" size={16} />Trocar senha
              </button>
              <button
                className="dropdown-item is-danger"
                type="button"
                onClick={() => {
                  setUserMenuOpen(false)
                  localStorage.removeItem('token')
                  onLogout?.()
                  navigate('/')
                }}
              >
                <Icon name="logOut" size={16} />Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <aside className="app-rail">
        {railGroups.map((group) => (
          <div className="rail-group" key={group.label}>
            <div className="rail-label">{group.label}</div>
            <nav>
              {group.items.map((item) => (
                <NavLink
                  key={item.url}
                  end={item.url === '/'}
                  className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
                  to={item.url}
                  title={item.label}
                >
                  {({ isActive }) => (
                    <>
                      <Icon name={item.icon} size={18} />
                      <span className="nav-label">{item.label}</span>
                      {isActive && <span className="sr-only"> (página atual)</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </aside>

      <main className="app-main">
        <div className="page-transition" key={location.pathname}>{children}</div>
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {bottomItems.map((item) => (
          <NavLink key={item.url} end={item.url === '/'} to={item.url} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={item.icon} size={18} />
            {item.label}
          </NavLink>
        ))}
        <button type="button" className={moreActive || moreOpen ? 'active' : ''} onClick={() => setMoreOpen(true)}>
          <Icon name="more" size={18} />
          Mais
        </button>
      </nav>

      {moreOpen && (
        <div className="more-sheet-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMoreOpen(false) }}>
          <div className="more-sheet" role="dialog" aria-label="Mais opções">
            <h2>Mais</h2>
            <nav>
              {moreItems.map((item) => (
                <NavLink
                  key={item.url}
                  className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
                  to={item.url}
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon name={item.icon} size={18} />
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
