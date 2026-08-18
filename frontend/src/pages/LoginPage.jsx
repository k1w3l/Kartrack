import { useState } from 'react'
import api, { API_BASE_URL } from '../api'
import FipeLookupForm from '../components/FipeLookupForm'
import Icon from '../components/Icon'

function getApiErrorMessage(error, isRegister) {
  const fallback = isRegister ? 'Falha no cadastro' : 'Falha no login'
  const status = error?.response?.status
  const payload = error?.response?.data

  if (!payload) {
    if (status === 401) return 'Usuário ou senha inválidos'
    if (status === 500) return 'Erro interno no servidor. Tente novamente.'
    return fallback
  }

  if (typeof payload.detail === 'string') return payload.detail

  if (Array.isArray(payload.detail) && payload.detail.length) {
    const first = payload.detail[0]
    if (first?.msg) return first.msg
  }

  return fallback
}

export default function LoginPage({ onLogin, darkMode, onToggleTheme }) {
  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, '')
  const [activeTab, setActiveTab] = useState('login')
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const goToLoginMode = () => {
    setIsRegister(false)
    setForm((prev) => ({ ...prev, name: '', password: '' }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (isRegister) {
        await api.post('/auth/register', {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        })

        setSuccess('Cadastro realizado com sucesso. Você foi direcionado para o login.')
        goToLoginMode()
        return
      }

      const { data } = await api.post('/auth/login', {
        email: form.email.trim(),
        password: form.password,
      })

      localStorage.setItem('token', data.access_token)
      onLogin()
    } catch (err) {
      setError(getApiErrorMessage(err, isRegister))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen relative">
      <button
        type="button"
        className="btn btn-ghost icon-btn login-theme"
        onClick={onToggleTheme}
        aria-pressed={darkMode}
        title={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
      >
        <Icon name={darkMode ? 'sun' : 'moon'} />
      </button>
      <div className="login-panel">
        <div className="login-logo">
          <img
            src={`${apiOrigin}/uploads/${darkMode ? 'logo_dark.svg' : 'logo_light.svg'}`}
            alt="Kartrack"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>

        <div className="login-tabs" role="tablist" aria-label="Acesso e consulta FIPE">
          <button
            type="button"
            role="tab"
            className={`login-tab ${activeTab === 'login' ? 'active' : ''}`}
            aria-selected={activeTab === 'login'}
            onClick={() => setActiveTab('login')}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            className={`login-tab ${activeTab === 'fipe' ? 'active' : ''}`}
            aria-selected={activeTab === 'fipe'}
            onClick={() => setActiveTab('fipe')}
          >
            Consultar FIPE
          </button>
        </div>

        {activeTab === 'login' ? (
          <form className="card stack" onSubmit={submit} role="tabpanel">
            {isRegister && (
              <div className="field">
                <label className="field-label" htmlFor="login-name">Nome</label>
                <input
                  id="login-name"
                  className="input"
                  placeholder="Seu nome"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  minLength={2}
                  required
                />
              </div>
            )}
            <div className="field">
              <label className="field-label" htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                className="input"
                placeholder="voce@exemplo.com"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="login-password">Senha</label>
              <div className="input-row">
                <input
                  id="login-password"
                  className="input"
                  placeholder="Sua senha"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={6}
                  required
                />
                <button type="button" className="btn btn-ghost icon-btn" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </div>
            </div>
            {isRegister && <p className="muted small">A senha deve conter pelo menos 6 caracteres.</p>}

            {success && <div className="alert alert-ok">{success}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Processando...' : isRegister ? 'Cadastrar' : 'Entrar'}
            </button>
            <button
              type="button"
              className="btn btn-link"
              style={{ justifyContent: 'center' }}
              onClick={() => {
                setError('')
                setSuccess('')
                setIsRegister(!isRegister)
              }}
            >
              {isRegister ? 'Já tenho conta' : 'Primeiro acesso? Crie sua conta.'}
            </button>
          </form>
        ) : (
          <div className="card stack" role="tabpanel">
            <p className="muted small">Consulte o valor de mercado na tabela FIPE sem precisar entrar na conta.</p>
            <FipeLookupForm />
          </div>
        )}
      </div>
    </div>
  )
}
