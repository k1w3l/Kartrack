import { useState } from 'react'
import api, { API_BASE_URL } from '../api'

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
  const [preview, setPreview] = useState(null)

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
        alert(`Importação concluída (${mode}): ${JSON.stringify(data)}`)
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
        alert('Restore concluído com sucesso. A página será recarregada.')
        window.location.reload()
      },
    })
  }

  return (
    <div className="card card-body">
      <h4><i className="fa-solid fa-arrows-rotate me-2" />Backup/Restore</h4>

      <div className="row g-3 mt-1">
        <div className="col-lg-6">
          <div className="card card-body h-100">
            <h6><i className="fa-solid fa-file-import me-2" />Importação</h6>
            <div className="d-flex flex-column gap-2 mt-2">
              <label className="btn btn-outline-primary text-start"><i className="fa-solid fa-gas-pump me-2" />Importar abastecimentos<input type="file" className="d-none" accept=".csv" onChange={(e) => importCsv('abastecimentos', e.target.files?.[0])} /></label>
              <label className="btn btn-outline-primary text-start"><i className="fa-solid fa-receipt me-2" />Importar despesas<input type="file" className="d-none" accept=".csv" onChange={(e) => importCsv('despesas', e.target.files?.[0])} /></label>
              <label className="btn btn-outline-primary text-start"><i className="fa-solid fa-box-archive me-2" />Importar todos os registros<input type="file" className="d-none" accept=".csv" onChange={(e) => importCsv('todos', e.target.files?.[0])} /></label>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card card-body h-100">
            <h6><i className="fa-solid fa-file-export me-2" />Exportação</h6>
            <div className="d-flex flex-column gap-2 mt-2">
              <a className="btn btn-outline-success text-start" href={`${API_BASE_URL}/records/export?vehicle_id=${vehicleId}&mode=abastecimentos`} target="_blank" rel="noreferrer"><i className="fa-solid fa-gas-pump me-2" />Exportar abastecimentos</a>
              <a className="btn btn-outline-success text-start" href={`${API_BASE_URL}/records/export?vehicle_id=${vehicleId}&mode=despesas`} target="_blank" rel="noreferrer"><i className="fa-solid fa-receipt me-2" />Exportar despesas</a>
              <a className="btn btn-outline-success text-start" href={`${API_BASE_URL}/records/export?vehicle_id=${vehicleId}&mode=todos`} target="_blank" rel="noreferrer"><i className="fa-solid fa-box-archive me-2" />Exportar todos os registros</a>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card card-body">
            <h6><i className="fa-solid fa-file-csv me-2" />Modelos de importação</h6>
            <div className="d-flex flex-wrap gap-2 mt-2">
              <a className="btn btn-outline-secondary" href={`${API_BASE_URL}/records/template?mode=abastecimentos`} target="_blank" rel="noreferrer">Modelo abastecimentos</a>
              <a className="btn btn-outline-secondary" href={`${API_BASE_URL}/records/template?mode=despesas`} target="_blank" rel="noreferrer">Modelo despesas</a>
              <a className="btn btn-outline-secondary" href={`${API_BASE_URL}/records/template?mode=todos`} target="_blank" rel="noreferrer">Modelo completo</a>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card card-body">
            <h4><i className="fa-solid fa-server me-2" />Sistema</h4>
            <div className="d-flex flex-wrap gap-2 mt-2">
              <button type="button" className="btn btn-outline-dark" onClick={backupSystem}><i className="fa-solid fa-floppy-disk me-2" />Backup do sistema</button>
              <label className="btn btn-outline-dark mb-0"><i className="fa-solid fa-arrows-rotate me-2" />Restore do sistema<input type="file" className="d-none" accept="application/json,.json" onChange={(e) => restoreSystem(e.target.files?.[0])} /></label>
            </div>
          </div>
        </div>
      </div>

      {preview && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,.45)', zIndex: 9999 }}>
          <div className="card" style={{ width: 'min(560px, 92vw)' }}>
            <div className="card-body">
              <h5>{preview.title}</h5>
              <ul className="mb-3">{preview.rows.map((r) => <li key={r}>{r}</li>)}</ul>
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setPreview(null)}>Cancelar</button>
                <button type="button" className="btn btn-primary" onClick={async () => { await preview.action?.(); setPreview(null) }}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
