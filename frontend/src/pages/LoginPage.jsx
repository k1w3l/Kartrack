import { useState } from 'react'
import api, { API_BASE_URL } from '../api'

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

export default function LoginPage({ onLogin }) {
  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, '')
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div className="container py-5" style={{ maxWidth: 500 }}>
      <div className="text-center mb-4">
        <div className="login-logo">
          <img src={`${apiOrigin}/uploads/logo_light.png`} alt="Kartrack" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        </div>
      </div>
      <form className="login-form-panel" onSubmit={submit}>
        {isRegister && (
          <input
            className="form-control mb-2"
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            minLength={2}
            required
          />
        )}
        <input
          className="form-control mb-2"
          placeholder="E-mail"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          className={`form-control ${isRegister ? 'mb-1' : 'mb-3'}`}
          placeholder="Senha"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          minLength={6}
          required
        />
        {isRegister && <small className="text-muted d-block mt-2 mb-3">A senha deve conter pelo menos 6 caracteres.</small>}

        {success && <div className="alert alert-success py-2">{success}</div>}
        {error && <div className="alert alert-danger py-2">{error}</div>}

        <button className="btn btn-primary w-100" disabled={loading}>
          {loading ? 'Processando...' : isRegister ? 'Cadastrar' : 'Entrar'}
        </button>
        <button
          type="button"
          className="btn btn-link mt-2 w-100 text-center"
          onClick={() => {
            setError('')
            setSuccess('')
            setIsRegister(!isRegister)
          }}
        >
          {isRegister ? 'Já tenho conta' : 'Primeiro acesso? Crie sua conta.'}
        </button>
      </form>
    </div>
  )
}
