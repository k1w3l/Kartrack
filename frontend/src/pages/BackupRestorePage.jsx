import { useState } from 'react'
import api, { API_BASE_URL } from '../api'
import Modal from '../components/Modal'
import { useUI } from '../components/UIProvider'
import Icon from '../components/Icon'
import { ButtonSpinner } from '../components/Loading'

const BACKUP_KEYS = [
  'cartrack_vehicle_meta', 'cartrack_combustiveis', 'cartrack_bandeiras', 'cartrack_postos',
  'cartrack_oficinas', 'cartrack_pecas', 'cartrack_servicos', 'cartrack_locais_estacionamento', 'cartrack_locais_estetica',
  'cartrack_tipos_multa', 'cartrack_tipos_imposto', 'cartrack_seguradoras', 'theme',
]

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function BackupRestorePage({ vehicleId }) {
  const { toast } = useUI()
  const [preview, setPreview] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const importCsv = async (mode, file) => {
    if (!file || !vehicleId) return
    const text = await file.text()
    const lines = text.trim().split(/\r?\n/)
    const dataLines = Math.max(0, lines.length - 1)
    setPreview({
      title: 'Preview de importação',
      rows: [`Arquivo: ${file.name}`, `Modo: ${mode}`, `Registros detectados: ${dataLines}`],
      action: async () => {
        const fd = new FormData()
        fd.append('file', file)
        const { data } = await api.post(`/records/import?vehicle_id=${vehicleId}&mode=${mode}`, fd)
        toast.success(`Importação concluída (${mode}): ${JSON.stringify(data)}`, { timeout: 6000 })
      },
    })
  }

  const backupSystem = async () => {
    const { data: dbBackup } = await api.get('/system/backup')
    const settings = {}
    BACKUP_KEYS.forEach((k) => { settings[k] = localStorage.getItem(k) })
    setPreview({
      title: 'Preview de exportação (backup)',
      rows: [
        `Veículos: ${(dbBackup.vehicles || []).length}`,
        `Abastecimentos: ${(dbBackup.fuels || []).length}`,
        `Despesas: ${(dbBackup.expenses || []).length}`,
      ],
      action: async () => downloadJson(`cartrack_backup_${new Date().toISOString().slice(0, 10)}.json`, { dbBackup, settings }),
    })
  }

  const restoreSystem = async (file) => {
    if (!file) return
    const parsed = JSON.parse(await file.text())
    const dbBackup = parsed.dbBackup || {}
    setPreview({
      title: 'Preview de restore',
      rows: [
        `Veículos: ${(dbBackup.vehicles || []).length}`,
        `Abastecimentos: ${(dbBackup.fuels || []).length}`,
        `Despesas: ${(dbBackup.expenses || []).length}`,
      ],
      action: async () => {
        await api.post('/system/restore', dbBackup)
        Object.entries(parsed.settings || {}).forEach(([k, v]) => {
          if (v === null || v === undefined) localStorage.removeItem(k)
          else localStorage.setItem(k, v)
        })
        toast.success('Restore concluído com sucesso. A página será recarregada.')
        setTimeout(() => window.location.reload(), 800)
      },
    })
  }

  return (
    <div className="stack-lg">
      <h1 className="page-title"><Icon name="refresh" />Backup/Restore</h1>

      <div className="grid-2">
        <div>
          <div className="card">
            <h2 className="section-title"><Icon name="fileInput" size={16} />Importação</h2>
            <div className="stack">
              <label className="btn btn-accent"><Icon name="fuel" size={16} />Importar abastecimentos<input type="file" className="file-hidden" accept=".csv" onChange={(e) => importCsv('abastecimentos', e.target.files?.[0])} /></label>
              <label className="btn btn-accent"><Icon name="receipt" size={16} />Importar despesas<input type="file" className="file-hidden" accept=".csv" onChange={(e) => importCsv('despesas', e.target.files?.[0])} /></label>
              <label className="btn btn-accent"><Icon name="archive" size={16} />Importar todos os registros<input type="file" className="file-hidden" accept=".csv" onChange={(e) => importCsv('todos', e.target.files?.[0])} /></label>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <h2 className="section-title"><Icon name="fileOutput" size={16} />Exportação</h2>
            <div className="stack">
              <a className="btn btn-ok" href={`${API_BASE_URL}/records/export?vehicle_id=${vehicleId}&mode=abastecimentos`} target="_blank" rel="noreferrer"><Icon name="fuel" size={16} />Exportar abastecimentos</a>
              <a className="btn btn-ok" href={`${API_BASE_URL}/records/export?vehicle_id=${vehicleId}&mode=despesas`} target="_blank" rel="noreferrer"><Icon name="receipt" size={16} />Exportar despesas</a>
              <a className="btn btn-ok" href={`${API_BASE_URL}/records/export?vehicle_id=${vehicleId}&mode=todos`} target="_blank" rel="noreferrer"><Icon name="archive" size={16} />Exportar todos os registros</a>
            </div>
          </div>
        </div>

        <div className="span-2">
          <div className="card">
            <h2 className="section-title"><Icon name="fileSpreadsheet" size={16} />Modelos de importação</h2>
            <div className="cluster">
              <a className="btn btn-ghost" href={`${API_BASE_URL}/records/template?mode=abastecimentos`} target="_blank" rel="noreferrer">Modelo abastecimentos</a>
              <a className="btn btn-ghost" href={`${API_BASE_URL}/records/template?mode=despesas`} target="_blank" rel="noreferrer">Modelo despesas</a>
              <a className="btn btn-ghost" href={`${API_BASE_URL}/records/template?mode=todos`} target="_blank" rel="noreferrer">Modelo completo</a>
            </div>
          </div>
        </div>

        <div className="span-2">
          <div className="card">
            <h2 className="section-title"><Icon name="server" size={16} />Sistema</h2>
            <div className="cluster">
              <button type="button" className="btn btn-ghost" onClick={backupSystem}><Icon name="save" size={16} />Backup do sistema</button>
              <label className="btn btn-ghost"><Icon name="refresh" size={16} />Restore do sistema<input type="file" className="file-hidden" accept="application/json,.json" onChange={(e) => restoreSystem(e.target.files?.[0])} /></label>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(preview)}
        onClose={() => { if (!confirming) setPreview(null) }}
        title={preview?.title}
        titleIcon="clipboardCheck"
        footer={(
          <>
            <button type="button" className="btn btn-ghost" disabled={confirming} onClick={() => setPreview(null)}>Cancelar</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={confirming}
              onClick={async () => {
                setConfirming(true)
                try {
                  await preview.action?.()
                  setPreview(null)
                } catch (err) {
                  toast.error(err?.response?.data?.detail || 'Não foi possível concluir a operação.')
                } finally {
                  setConfirming(false)
                }
              }}
            >
              {confirming ? <><ButtonSpinner />Processando...</> : 'Confirmar'}
            </button>
          </>
        )}
      >
        {preview && <ul>{preview.rows.map((r) => <li key={r}>{r}</li>)}</ul>}
      </Modal>
    </div>
  )
}
