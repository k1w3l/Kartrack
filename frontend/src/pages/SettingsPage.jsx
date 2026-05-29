import { useEffect, useState } from 'react'
import api from '../api'
import { useUI } from '../components/UIProvider'

const defaultNewUser = { name: '', email: '', password: '' }

export default function SettingsPage({ user, onUserUpdated }) {
  const { confirm, prompt, toast } = useUI()
  const [users, setUsers] = useState([])
  const [newUser, setNewUser] = useState(defaultNewUser)
  const [preferences, setPreferences] = useState({
    language: user?.language || 'pt-BR',
    unit_system: user?.unit_system || 'metric',
    currency: user?.currency || 'BRL',
  })

  const loadUsers = async () => {
    if (!user?.is_admin) return
    const { data } = await api.get('/users')
    setUsers(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    setPreferences({
      language: user?.language || 'pt-BR',
      unit_system: user?.unit_system || 'metric',
      currency: user?.currency || 'BRL',
    })
    loadUsers().catch(() => setUsers([]))
  }, [user?.id, user?.is_admin])

  const savePreferences = async () => {
    await api.put('/me/preferences', preferences)
    await onUserUpdated?.()
    toast.success('Preferências atualizadas com sucesso.')
  }

  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.warning('Preencha nome, e-mail e senha para criar o usuário.')
      return
    }
    try {
      await api.post('/users', newUser)
      setNewUser(defaultNewUser)
      await loadUsers()
      toast.success('Usuário criado com sucesso.')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Não foi possível criar o usuário.')
    }
  }

  const deleteUser = async (userId) => {
    const ok = await confirm({ title: 'Excluir usuário', message: 'Deseja excluir este usuário?', confirmLabel: 'Excluir', danger: true })
    if (!ok) return
    await api.delete(`/users/${userId}`)
    await loadUsers()
    toast.success('Usuário excluído.')
  }

  const resetPassword = async (userId) => {
    const next = await prompt({ title: 'Redefinir senha', label: 'Nova senha', inputType: 'password', minLength: 6, titleIcon: 'fa-solid fa-key', confirmLabel: 'Redefinir' })
    if (!next) return
    await api.post(`/users/${userId}/reset-password`, { new_password: next })
    toast.success('Senha redefinida com sucesso.')
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className="card card-body">
        <h4><i className="fa-solid fa-gear me-2" />Configurações</h4>
      </div>

      {user?.is_admin && (
        <div className="card card-body">
          <h5><i className="fa-solid fa-users-gear me-2" />Gestão de usuários</h5>

          <div className="row g-2 mt-1 align-items-end">
            <div className="col-md-4">
              <label className="form-label" htmlFor="new-user-name">Nome</label>
              <input id="new-user-name" className="form-control" placeholder="Nome" autoComplete="off" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="new-user-email">E-mail</label>
              <input id="new-user-email" className="form-control" placeholder="E-mail" type="email" inputMode="email" autoComplete="off" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="new-user-password">Senha</label>
              <input id="new-user-password" className="form-control" placeholder="Senha" type="password" autoComplete="new-password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
            </div>
            <div className="col-md-1"><button type="button" className="btn btn-primary w-100" onClick={createUser} aria-label="Adicionar usuário"><i className="fa-solid fa-plus" /></button></div>
          </div>

          <div className="table-responsive mt-3">
            <table className="table table-sm align-middle">
              <thead><tr><th>Nome</th><th>E-mail</th><th>Admin</th><th>Ações</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.is_admin ? 'Sim' : 'Não'}</td>
                    <td className="d-flex gap-2">
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => resetPassword(u.id)}><i className="fa-solid fa-key me-1" />Senha</button>
                      {!u.is_admin && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteUser(u.id)}><i className="fa-solid fa-trash me-1" />Excluir</button>}
                    </td>
                  </tr>
                ))}
                {!users.length && <tr><td colSpan={4} className="text-muted">Nenhum usuário disponível.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card card-body">
        <h5><i className="fa-solid fa-language me-2" />Idioma, unidades e moeda</h5>
        <div className="row g-2 mt-1">
          <div className="col-md-4">
            <label className="form-label">Idioma</label>
            <select className="form-select" value={preferences.language} onChange={(e) => setPreferences((p) => ({ ...p, language: e.target.value }))}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Unidades</label>
            <select className="form-select" value={preferences.unit_system} onChange={(e) => setPreferences((p) => ({ ...p, unit_system: e.target.value }))}>
              <option value="metric">Métrico (km, L)</option>
              <option value="imperial">Imperial (mi, gal)</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Moeda</label>
            <select className="form-select" value={preferences.currency} onChange={(e) => setPreferences((p) => ({ ...p, currency: e.target.value }))}>
              <option value="BRL">Real (BRL)</option>
              <option value="USD">Dollar (USD)</option>
            </select>
          </div>
        </div>
        <div className="mt-3 d-flex justify-content-end">
          <button type="button" className="btn btn-primary" onClick={savePreferences}><i className="fa-solid fa-floppy-disk me-2" />Salvar preferências</button>
        </div>
      </div>
    </div>
  )
}
