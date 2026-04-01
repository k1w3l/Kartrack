import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const COMMON_BULK_FIELDS = [
  { value: 'data', label: 'Data', input: 'date', apiField: 'data' },
  { value: 'quilometragem', label: 'Quilometragem', input: 'number', apiField: 'quilometragem' },
  { value: 'valor', label: 'Valor', input: 'number', apiField: 'valor' },
  { value: 'descricao', label: 'Descrição', input: 'text', apiField: 'descricao' },
]

const FUEL_BULK_FIELDS = [
  { value: 'data', label: 'Data', input: 'date', apiField: 'data' },
  { value: 'quilometragem', label: 'Quilometragem', input: 'number', apiField: 'quilometragem' },
  { value: 'valor_total', label: 'Valor total', input: 'number', apiField: 'valor_total' },
  { value: 'descricao', label: 'Descrição', input: 'text', apiField: 'descricao' },
  { value: 'tipo_combustivel', label: 'Tipo de combustível', input: 'text', apiField: 'tipo_combustivel' },
  { value: 'litros', label: 'Litros', input: 'number', apiField: 'litros' },
  { value: 'tanque_cheio', label: 'Tanque cheio', input: 'boolean', apiField: 'tanque_cheio' },
  { value: 'posto', label: 'Posto', input: 'text', apiField: 'posto' },
]

const EXPENSE_BULK_FIELDS = [
  ...COMMON_BULK_FIELDS,
  { value: 'tipo', label: 'Tipo', input: 'text', apiField: 'tipo' },
  { value: 'local', label: 'Local', input: 'text', apiField: 'local' },
  { value: 'vencimento', label: 'Vencimento', input: 'date', apiField: 'vencimento' },
  { value: 'status', label: 'Status', input: 'text', apiField: 'status' },
  { value: 'validade_km', label: 'Validade em km', input: 'number', apiField: 'validade_km' },
  { value: 'validade_dias', label: 'Validade em dias', input: 'number', apiField: 'validade_dias' },
]

const DATA_TYPE_FIELDS = [
  { key: 'fuel_type', label: 'Tipo de combustível', placeholder: 'Ex.: Gasolina Comum' },
  { key: 'fuel_brand', label: 'Bandeira', placeholder: 'Ex.: Ipiranga' },
  { key: 'expense_multa_tipo', label: 'Tipo da multa', placeholder: 'Ex.: Rodízio' },
  { key: 'expense_seguradora', label: 'Seguradora', placeholder: 'Ex.: Tokio Marine' },
  { key: 'expense_oficina', label: 'Oficina', placeholder: 'Ex.: Oficina do João' },
  { key: 'expense_peca', label: 'Peças', placeholder: 'Ex.: Pastilha de freio' },
  { key: 'expense_servico', label: 'Serviços', placeholder: 'Ex.: Troca de óleo' },
  { key: 'expense_financeira', label: 'Financeiras', placeholder: 'Ex.: Banco XYZ' },
  { key: 'expense_estacionamento_local', label: 'Locais de estacionamento', placeholder: 'Ex.: Estacionamento Centro' },
  { key: 'expense_imposto_tipo', label: 'Tipos de imposto', placeholder: 'Ex.: Taxa administrativa' },
]

export default function RecordsPage({ vehicleId }) {
  const navigate = useNavigate()
  const [timeline, setTimeline] = useState([])
  const [bulkFilter, setBulkFilter] = useState('todos')
  const [bulkAction, setBulkAction] = useState('descricao')
  const [bulkValue, setBulkValue] = useState('')
  const [dataTypes, setDataTypes] = useState({})
  const [loadError, setLoadError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  const loadTimeline = async () => {
    if (!vehicleId) return
    try {
      setLoadError('')
      const { data } = await api.get('/timeline', { params: { vehicle_id: vehicleId } })
      setTimeline(Array.isArray(data) ? data.filter((item) => item.tipo_registro !== 'fipe') : [])
    } catch {
      setTimeline([])
      setLoadError('Não foi possível carregar os registros neste momento.')
    }
  }

  useEffect(() => {
    loadTimeline()
    ;(async () => {
      const loaded = {}
      for (const field of DATA_TYPE_FIELDS) {
        const { data } = await api.get('/lookup', { params: { category: field.key } })
        loaded[field.key] = Array.isArray(data) ? data : []
      }
      setDataTypes(loaded)
    })().catch(() => setDataTypes({}))
  }, [vehicleId])

  const filteredRecords = useMemo(() => {
    if (bulkFilter === 'todos') return timeline
    return timeline.filter((r) => r.tipo_registro === bulkFilter)
  }, [timeline, bulkFilter])
  const displayedRecords = useMemo(() => filteredRecords, [filteredRecords])

  const selectedRecords = useMemo(
    () => filteredRecords.filter((record) => selectedIds.includes(`${record.tipo_registro}:${record.id}`)),
    [filteredRecords, selectedIds],
  )

  const targetRecords = selectedRecords.length ? selectedRecords : filteredRecords
  const targetKinds = useMemo(
    () => [...new Set(targetRecords.map((record) => record.tipo_registro === 'abastecimento' ? 'fuel' : 'expense'))],
    [targetRecords],
  )
  const isMixedTarget = targetKinds.length > 1
  const bulkFieldOptions = useMemo(() => {
    if (isMixedTarget) return COMMON_BULK_FIELDS
    if (targetKinds[0] === 'fuel') return FUEL_BULK_FIELDS
    return EXPENSE_BULK_FIELDS
  }, [isMixedTarget, targetKinds])

  useEffect(() => {
    if (!bulkFieldOptions.some((field) => field.value === bulkAction)) {
      setBulkAction(bulkFieldOptions[0]?.value || 'descricao')
      setBulkValue('')
    }
  }, [bulkFieldOptions, bulkAction])

  const bulkFieldConfig = bulkFieldOptions.find((field) => field.value === bulkAction) || bulkFieldOptions[0]

  const applyBulkEdit = async () => {
    if (!targetRecords.length || bulkValue === '') return
    try {
      for (const record of targetRecords) {
        if (record.tipo_registro === 'abastecimento') {
          const { data } = await api.get(`/fuel/${record.id}`)
          const payload = { ...data }
          payload[getApiFieldForRecord(bulkFieldConfig, record)] = normalizeBulkValue(bulkFieldConfig, bulkValue)
          await api.put(`/fuel/${record.id}`, payload)
        } else {
          const { data } = await api.get(`/expenses/${record.id}`)
          const payload = { ...data }
          payload[getApiFieldForRecord(bulkFieldConfig, record)] = bulkAction === 'tipo'
            ? String(bulkValue).toLowerCase()
            : normalizeBulkValue(bulkFieldConfig, bulkValue)
          await api.put(`/expenses/${record.id}`, payload)
        }
      }

      alert('Edição em massa aplicada com sucesso.')
      setBulkValue('')
      setSelectedIds([])
      await loadTimeline()
    } catch {
      alert('Falha ao aplicar edição em massa.')
    }
  }

  const deleteRecords = async (records) => {
    if (!records.length) return
    if (!window.confirm(`Deseja excluir ${records.length} registro(s)?`)) return
    for (const record of records) {
      if (record.tipo_registro === 'abastecimento') await api.delete(`/fuel/${record.id}`)
      else await api.delete(`/expenses/${record.id}`)
    }
    setSelectedIds([])
    await loadTimeline()
  }

  const deleteAllRecords = async () => {
    if (!window.confirm('Deseja excluir TODOS os registros cadastrados?')) return
    await api.delete('/records/all')
    setSelectedIds([])
    await loadTimeline()
  }

  const toggleSelected = (record) => {
    const key = `${record.tipo_registro}:${record.id}`
    setSelectedIds((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key])
  }

  const toggleSelectAll = () => {
    const displayedIds = displayedRecords.map((record) => `${record.tipo_registro}:${record.id}`)
    const allDisplayedSelected = displayedIds.length > 0 && displayedIds.every((id) => selectedIds.includes(id))

    if (allDisplayedSelected) {
      setSelectedIds((prev) => prev.filter((id) => !displayedIds.includes(id)))
      return
    }

    setSelectedIds((prev) => [...new Set([...prev, ...displayedIds])])
  }

  const addDataTypeValue = async (key, value) => {
    const trimmed = String(value || '').trim()
    if (!trimmed) return
    try {
      const { data } = await api.post('/lookup', { category: key, value: trimmed })
      setDataTypes((prev) => ({ ...prev, [key]: [...(prev[key] || []), data] }))
    } catch {
      alert('Item já cadastrado.')
    }
  }

  const removeDataTypeValue = async (key, item) => {
    if (!item?.id) return
    await api.delete(`/lookup/${item.id}`)
    const next = (dataTypes[key] || []).filter((v) => v.id !== item.id)
    setDataTypes((prev) => ({ ...prev, [key]: next }))
  }

  if (!vehicleId) {
    return <div className="alert alert-info">Defina um veículo padrão para usar o menu Registros.</div>
  }

  return (
    <div className="card card-body">
      <h4><i className="fa-solid fa-folder-open me-2" />Registros</h4>

      <div className="row g-3 mt-1">
        <div className="col-12">
          <div className="row g-3 records-summary-row">
            <SummaryCard icon="fa-solid fa-list" label="Total visível" value={filteredRecords.length} />
            <SummaryCard icon="fa-solid fa-check-double" label="Selecionados" value={selectedRecords.length} />
            <SummaryCard icon="fa-solid fa-gas-pump" label="Abastecimentos" value={filteredRecords.filter((record) => record.tipo_registro === 'abastecimento').length} />
            <SummaryCard icon="fa-solid fa-receipt" label="Despesas" value={filteredRecords.filter((record) => record.tipo_registro !== 'abastecimento').length} />
          </div>
        </div>

        <div className="col-12">
          <div className="card card-body records-panel">
            <h6><i className="fa-solid fa-layer-group me-2" />Edição em massa</h6>
            <div className="row g-2 mt-1">
              <div className="col-md-3">
                <label className="form-label">Filtro de tipo</label>
                <select className="form-select" value={bulkFilter} onChange={(e) => setBulkFilter(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="abastecimento">Abastecimento</option>
                  <option value="manutenção">Manutenção</option>
                  <option value="multa">Multa</option>
                  <option value="financiamento">Financiamento</option>
                  <option value="impostos">Impostos</option>
                  <option value="seguro">Seguro</option>
                  <option value="acessórios">Acessórios</option>
                  <option value="estacionamento">Estacionamento</option>
                  <option value="estética">Estética</option>
                  <option value="pedágio">Pedágio</option>
                  <option value="km inicial">KM inicial</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Campo</label>
                <select className="form-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
                  {bulkFieldOptions.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Novo valor</label>
                <BulkValueInput
                  field={bulkFieldConfig}
                  value={bulkValue}
                  onChange={setBulkValue}
                />
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <button type="button" className="btn btn-primary w-100" onClick={applyBulkEdit}>
                  <i className="fa-solid fa-wand-magic-sparkles me-2" />Aplicar
                </button>
              </div>
            </div>
            <div className="d-flex justify-content-end mt-2">
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => deleteRecords(selectedRecords)}>
                <i className="fa-solid fa-trash me-2" />Excluir selecionados
              </button>
            </div>
            {loadError ? <small className="text-danger mt-2">{loadError}</small> : <small className="text-muted mt-2">{isMixedTarget ? 'Para editar qualquer campo específico, filtre ou selecione registros de um único tipo.' : 'Você pode editar em massa qualquer campo disponível para o tipo selecionado.'}</small>}
          </div>
        </div>

        <div className="col-12">
          <div className="card card-body records-panel">
            <h6><i className="fa-solid fa-pen-to-square me-2" />Editar registros</h6>
            <div className="table-responsive mt-2">
              <table className="table table-sm align-middle records-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" checked={!!displayedRecords.length && displayedRecords.every((record) => selectedIds.includes(`${record.tipo_registro}:${record.id}`))} onChange={toggleSelectAll} /></th>
                    <th>Registro</th>
                    <th>Data</th>
                    <th>Km</th>
                    <th>Valor</th>
                    <th>Descrição</th>
                    <th className="text-end">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRecords.map((record) => (
                    <tr key={`${record.tipo_registro}-${record.id}`} className="records-row">
                      <td><input type="checkbox" checked={selectedIds.includes(`${record.tipo_registro}:${record.id}`)} onChange={() => toggleSelected(record)} /></td>
                      <td>
                        <div className="d-flex flex-column gap-1">
                          <span className={`badge rounded-pill ${record.tipo_registro === 'abastecimento' ? 'text-bg-primary' : 'text-bg-secondary'} records-type-badge`}>{record.tipo_registro}</span>
                          <small className="text-muted">ID #{record.id}</small>
                        </div>
                      </td>
                      <td>{record.data}</td>
                      <td>{record.quilometragem ? `${Number(record.quilometragem).toFixed(0)} km` : '-'}</td>
                      <td>R$ {Number(record.valor || 0).toFixed(2)}</td>
                      <td className="records-description-cell">{record.descricao || '-'}</td>
                      <td className="text-end">
                        <button type="button" className="btn btn-sm btn-outline-primary me-2" onClick={() => navigate(record.tipo_registro === 'abastecimento' ? `/abastecimento?edit=${record.id}` : `/despesa?edit=${record.id}`)}>
                          <i className="fa-solid fa-pen me-1" />Editar
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteRecords([record])}>
                          <i className="fa-solid fa-trash me-1" />Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!filteredRecords.length && <tr><td colSpan={7} className="text-muted">Nenhum registro encontrado para o filtro.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card card-body">
            <h6><i className="fa-solid fa-sliders me-2" />Tipos de dados</h6>
            <div className="row g-3 mt-1">
              {DATA_TYPE_FIELDS.map((field) => (
                <DataTypeEditor
                  key={field.key}
                  field={field}
                  values={dataTypes[field.key] || []}
                  onAdd={(v) => addDataTypeValue(field.key, v)}
                  onRemove={(v) => removeDataTypeValue(field.key, v)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="col-12 d-flex justify-content-end">
          <button type="button" className="btn btn-danger" onClick={deleteAllRecords}>
            <i className="fa-solid fa-trash me-2" />Excluir todos os registros cadastrados
          </button>
        </div>
      </div>
    </div>
  )
}

function DataTypeEditor({ field, values, onAdd, onRemove }) {
  const [newValue, setNewValue] = useState('')

  return (
    <div className="col-md-6 col-xl-4">
      <div className="border rounded-3 p-2 h-100">
        <div className="fw-semibold mb-2">{field.label}</div>
        <div className="d-flex gap-2 mb-2">
          <input className="form-control form-control-sm" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={field.placeholder} />
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { onAdd(newValue); setNewValue('') }}>Adicionar</button>
        </div>
        <div className="d-flex flex-wrap gap-1">
          {values.map((item) => (
            <span key={item.id || item.value} className="badge text-bg-light border">
              {item.value}
              <button type="button" className="btn btn-sm py-0 px-1 ms-1" onClick={() => onRemove(item)} title="Remover"><i className="fa-solid fa-xmark" /></button>
            </span>
          ))}
          {!values.length && <small className="text-muted">Nenhum item cadastrado.</small>}
        </div>
      </div>
    </div>
  )
}

function BulkValueInput({ field, value, onChange }) {
  if (field?.input === 'boolean') {
    return (
      <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    )
  }

  return (
    <input
      className="form-control"
      type={field?.input || 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Informe o novo valor"
    />
  )
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="card h-100 records-summary-card">
        <div className="card-body">
          <small className="text-muted d-block mb-1"><i className={`${icon} me-2`} />{label}</small>
          <h5 className="mb-0">{value}</h5>
        </div>
      </div>
    </div>
  )
}

function normalizeBulkValue(field, value) {
  if (!field) return value
  if (field.input === 'boolean') return value === 'true'
  if (field.input === 'number') return value === '' ? null : Number(value)
  return value
}

function getApiFieldForRecord(field, record) {
  if (record?.tipo_registro === 'abastecimento' && field?.value === 'valor') return 'valor_total'
  return field?.apiField || field?.value
}
