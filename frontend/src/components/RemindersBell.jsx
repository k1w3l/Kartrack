import { useEffect, useMemo, useState } from 'react'
import api from '../api'
import Icon from './Icon'
import Modal from './Modal'
import { useUI } from './UIProvider'

let didAnnounceUrgent = false

function parseReminder(raw) {
  const [id, text] = String(raw).split('::')
  const days = Number((String(text).match(/faltam\s+(-?\d+)\s+dias/i) || [])[1])
  const kms = Number((String(text).match(/faltam\s+(-?\d+)\s+km/i) || [])[1])
  const isDanger = Number.isFinite(days) ? days <= 30 : Number.isFinite(kms) ? kms <= 1000 : false
  const isWarning = !isDanger && (Number.isFinite(days) ? days <= 60 : Number.isFinite(kms) ? kms <= 2000 : false)
  return { id, raw, text, isDanger, isWarning }
}

export default function RemindersBell({ vehicleId }) {
  const { toast } = useUI()
  const [lembretes, setLembretes] = useState([])
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [confirming, setConfirming] = useState(false)

  const load = async () => {
    if (!vehicleId) return
    const { data } = await api.get('/dashboard', { params: { vehicle_id: vehicleId } })
    setLembretes(Array.isArray(data?.lembretes) ? data.lembretes : [])
  }

  useEffect(() => {
    if (!vehicleId) {
      setLembretes([])
      return undefined
    }
    load()
    const it = setInterval(() => {
      if (!document.hidden) load()
    }, 10000)
    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(it)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [vehicleId])

  useEffect(() => {
    setSelectedIds([])
  }, [vehicleId, lembretes.length])

  const parsed = useMemo(() => lembretes.map(parseReminder), [lembretes])
  const urgentItems = useMemo(() => parsed.filter((item) => item.isDanger), [parsed])
  const urgent = urgentItems.length > 0
  const count = parsed.length

  useEffect(() => {
    if (didAnnounceUrgent || !urgentItems.length) return
    didAnnounceUrgent = true
    const message = urgentItems.length === 1
      ? urgentItems[0].text
      : `Você tem ${urgentItems.length} lembretes urgentes de manutenção.`
    toast.error(message, {
      timeout: 6000,
      onClick: () => setOpen(true),
    })
  }, [urgentItems, toast])

  if (!vehicleId) return null

  const confirmSelected = async () => {
    setConfirming(true)
    try {
      for (const id of selectedIds) await api.post(`/expenses/${id}/confirm-reminder`)
      setSelectedIds([])
      await load()
    } finally {
      setConfirming(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`btn btn-ghost icon-btn notif-btn${urgent ? ' is-danger' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={count ? `Lembretes de manutenção (${count})` : 'Lembretes de manutenção'}
        title="Lembretes de manutenção"
      >
        <Icon name="bell" />
        {count > 0 && (
          <span className={`notif-badge${urgent ? ' is-danger' : ''}`}>{count > 9 ? '9+' : count}</span>
        )}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Lembretes de manutenção"
        titleIcon="bell"
        width="min(560px, 94vw)"
        footer={selectedIds.length ? (
          <button type="button" className="btn btn-danger btn-sm" disabled={confirming} onClick={confirmSelected}>
            <Icon name="check" size={16} />Confirmar exclusão dos lembretes
          </button>
        ) : null}
      >
        {parsed.length ? (
          <div className="lamp-list">
            {parsed.map((item) => (
              <label key={item.raw} className={`lamp-item${item.isDanger ? ' is-danger' : item.isWarning ? ' is-warn' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  title="Marcar lembrete para exclusão"
                  onChange={(e) => setSelectedIds((prev) => (
                    e.target.checked ? [...new Set([...prev, item.id])] : prev.filter((id) => id !== item.id)
                  ))}
                />
                {item.isDanger ? <Icon name="triangleAlert" size={16} /> : null}
                <span>{item.text}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="muted">Sem lembretes por enquanto.</p>
        )}
      </Modal>
    </>
  )
}
