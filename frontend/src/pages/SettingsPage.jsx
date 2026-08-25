import { useEffect, useState } from 'react'
import api from '../api'
import { useUI } from '../components/UIProvider'
import Field from '../components/Field'
import Icon from '../components/Icon'
import OverflowMenu from '../components/OverflowMenu'

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
    const next = await prompt({ title: 'Redefinir senha', label: 'Nova senha', inputType: 'password', minLength: 6, titleIcon: 'key', confirmLabel: 'Redefinir' })
    if (!next) return
    await api.post(`/users/${userId}/reset-password`, { new_password: next })
    toast.success('Senha redefinida com sucesso.')
  }

  return (
    <div className="stack-lg">
      <div className="card">
        <h1 className="page-title"><Icon name="settings" />Configurações</h1>
      </div>

      {user?.is_admin && (
        <div className="card">
          <h2 className="section-title"><Icon name="users" size={16} />Gestão de usuários</h2>

          <div className="grid-2">
            <Field label="Nome" htmlFor="new-user-name">
              <input id="new-user-name" className="input" placeholder="Nome" autoComplete="off" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field label="E-mail" htmlFor="new-user-email">
              <input id="new-user-email" className="input" placeholder="E-mail" type="email" inputMode="email" autoComplete="off" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
            </Field>
            <Field label="Senha" htmlFor="new-user-password">
              <input id="new-user-password" className="input" placeholder="Senha" type="password" autoComplete="new-password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
            </Field>
            <div className="field"><button type="button" className="btn btn-primary w-full" onClick={createUser} aria-label="Adicionar usuário"><Icon name="plus" /></button></div>
          </div>

          <div className="timeline-log">
            {users.map((u) => (
              <div className="hit-row is-plain" key={u.id}>
                <div>
                  <div className="timeline-main">
                    <strong>{u.name}</strong>
                    {u.is_admin ? <span className="badge badge-accent">Admin</span> : null}
                  </div>
                  <p className="muted small">{u.email}</p>
                </div>
                <OverflowMenu
                  items={[
                    { label: 'Redefinir senha', icon: 'key', onClick: () => resetPassword(u.id) },
                    !u.is_admin && { label: 'Excluir', icon: 'trash', danger: true, onClick: () => deleteUser(u.id) },
                  ]}
                />
              </div>
            ))}
            {!users.length && <p className="muted">Nenhum usuário disponível.</p>}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="section-title"><Icon name="languages" size={16} />Idioma, unidades e moeda</h2>
        <div className="grid-2">
          <Field label="Idioma">
            <select className="select" value={preferences.language} onChange={(e) => setPreferences((p) => ({ ...p, language: e.target.value }))}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
            </select>
          </Field>
          <Field label="Unidades">
            <select className="select" value={preferences.unit_system} onChange={(e) => setPreferences((p) => ({ ...p, unit_system: e.target.value }))}>
              <option value="metric">Métrico (km, L)</option>
              <option value="imperial">Imperial (mi, gal)</option>
            </select>
          </Field>
          <Field label="Moeda">
            <select className="select" value={preferences.currency} onChange={(e) => setPreferences((p) => ({ ...p, currency: e.target.value }))}>
              <option value="BRL">Real (BRL)</option>
              <option value="USD">Dollar (USD)</option>
            </select>
          </Field>
        </div>
        <div className="form-actions cluster-end">
          <button type="button" className="btn btn-primary" onClick={savePreferences}><Icon name="save" size={16} />Salvar preferências</button>
        </div>
      </div>
    </div>
  )
}
