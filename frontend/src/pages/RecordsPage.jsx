import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useUI } from '../components/UIProvider'
import Icon from '../components/Icon'
import { ButtonSpinner } from '../components/Loading'

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
  const { confirm, toast } = useUI()
  const [applyingBulk, setApplyingBulk] = useState(false)
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
    if (!targetRecords.length || bulkValue === '' || applyingBulk) return
    setApplyingBulk(true)
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

      toast.success('Edição em massa aplicada com sucesso.')
      setBulkValue('')
      setSelectedIds([])
      await loadTimeline()
    } catch {
      toast.error('Falha ao aplicar edição em massa.')
    } finally {
      setApplyingBulk(false)
    }
  }

  const deleteRecords = async (records) => {
    if (!records.length) return
    const ok = await confirm({ title: 'Excluir registros', message: `Deseja excluir ${records.length} registro(s)?`, confirmLabel: 'Excluir', danger: true })
    if (!ok) return
    for (const record of records) {
      if (record.tipo_registro === 'abastecimento') await api.delete(`/fuel/${record.id}`)
      else await api.delete(`/expenses/${record.id}`)
    }
    setSelectedIds([])
    await loadTimeline()
    toast.success(`${records.length} registro(s) excluído(s).`)
  }

  const deleteAllRecords = async () => {
    const ok = await confirm({ title: 'Excluir todos os registros', message: 'Deseja excluir TODOS os registros cadastrados? Esta ação não pode ser desfeita.', confirmLabel: 'Excluir tudo', danger: true })
    if (!ok) return
    await api.delete('/records/all')
    setSelectedIds([])
    await loadTimeline()
    toast.success('Todos os registros foram excluídos.')
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
      toast.error('Item já cadastrado.')
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
    <div className="stack-lg">
      <h1 className="page-title"><Icon name="folderOpen" />Registros</h1>

      <div className="records-summary">
        <SummaryCard icon="list" label="Total visível" value={filteredRecords.length} />
        <SummaryCard icon="checkCheck" label="Selecionados" value={selectedRecords.length} />
        <SummaryCard icon="fuel" label="Abastecimentos" value={filteredRecords.filter((record) => record.tipo_registro === 'abastecimento').length} />
        <SummaryCard icon="receipt" label="Despesas" value={filteredRecords.filter((record) => record.tipo_registro !== 'abastecimento').length} />
      </div>

      <div className="card">
        <h2 className="section-title"><Icon name="layers" size={16} />Edição em massa</h2>
        <div className="grid-2">
          <div className="field">
            <label className="field-label">Filtro de tipo</label>
            <select className="select" value={bulkFilter} onChange={(e) => setBulkFilter(e.target.value)}>
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
          <div className="field">
            <label className="field-label">Campo</label>
            <select className="select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
              {bulkFieldOptions.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Novo valor</label>
            <BulkValueInput field={bulkFieldConfig} value={bulkValue} onChange={setBulkValue} />
          </div>
          <div className="field">
            <button type="button" className="btn btn-primary w-full" onClick={applyBulkEdit} disabled={applyingBulk}>
              {applyingBulk ? <><ButtonSpinner />Aplicando...</> : <><Icon name="wand" size={16} />Aplicar</>}
            </button>
          </div>
        </div>
        <div className="cluster cluster-end" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteRecords(selectedRecords)}>
            <Icon name="trash" size={16} />Excluir selecionados
          </button>
        </div>
        {loadError ? <p className="alert alert-danger" style={{ marginTop: 12 }}>{loadError}</p> : <p className="muted small" style={{ marginTop: 12 }}>{isMixedTarget ? 'Para editar qualquer campo específico, filtre ou selecione registros de um único tipo.' : 'Você pode editar em massa qualquer campo disponível para o tipo selecionado.'}</p>}
      </div>

      <div className="card">
        <h2 className="section-title"><Icon name="squarePen" size={16} />Editar registros</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={!!displayedRecords.length && displayedRecords.every((record) => selectedIds.includes(`${record.tipo_registro}:${record.id}`))} onChange={toggleSelectAll} /></th>
                <th>Registro</th>
                <th>Data</th>
                <th>Km</th>
                <th>Valor</th>
                <th>Descrição</th>
                <th className="end">Ações</th>
              </tr>
            </thead>
            <tbody>
              {displayedRecords.map((record) => (
                <tr key={`${record.tipo_registro}-${record.id}`}>
                  <td><input type="checkbox" checked={selectedIds.includes(`${record.tipo_registro}:${record.id}`)} onChange={() => toggleSelected(record)} /></td>
                  <td>
                    <div className="stack">
                      <span className={`badge${record.tipo_registro === 'abastecimento' ? ' badge-accent' : ''}`}>{record.tipo_registro}</span>
                      <span className="muted small">ID #{record.id}</span>
                    </div>
                  </td>
                  <td>{record.data}</td>
                  <td>{record.quilometragem ? `${Number(record.quilometragem).toFixed(0)} km` : '-'}</td>
                  <td className="num">R$ {Number(record.valor || 0).toFixed(2)}</td>
                  <td>{record.descricao || '-'}</td>
                  <td className="end">
                    <div className="cluster cluster-end">
                      <button type="button" className="btn btn-sm btn-accent" onClick={() => navigate(record.tipo_registro === 'abastecimento' ? `/abastecimento?edit=${record.id}` : `/despesa?edit=${record.id}`)}>
                        <Icon name="pencil" size={14} />Editar
                      </button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteRecords([record])}>
                        <Icon name="trash" size={14} />Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredRecords.length && <tr><td colSpan={7} className="muted">Nenhum registro encontrado para o filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title"><Icon name="sliders" size={16} />Tipos de dados</h2>
        <div className="grid-3">
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

      <div className="cluster cluster-end">
        <button type="button" className="btn btn-danger" onClick={deleteAllRecords}>
          <Icon name="trash" size={16} />Excluir todos os registros cadastrados
        </button>
      </div>
    </div>
  )
}

function DataTypeEditor({ field, values, onAdd, onRemove }) {
  const [newValue, setNewValue] = useState('')

  return (
    <div className="card">
      <div className="section-title">{field.label}</div>
      <div className="inline-add">
        <input className="input" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={field.placeholder} />
        <button type="button" className="btn btn-sm btn-accent" onClick={() => { onAdd(newValue); setNewValue('') }}>Adicionar</button>
      </div>
      <div className="cluster" style={{ marginTop: 8 }}>
        {values.map((item) => (
          <span key={item.id || item.value} className="chip">
            {item.value}
            <button type="button" className="chip-btn" onClick={() => onRemove(item)} title="Remover" aria-label="Remover">
              <Icon name="x" size={14} />
            </button>
          </span>
        ))}
        {!values.length && <span className="muted small">Nenhum item cadastrado.</span>}
      </div>
    </div>
  )
}

function BulkValueInput({ field, value, onChange }) {
  if (field?.input === 'boolean') {
    return (
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    )
  }

  return (
    <input
      className="input"
      type={field?.input || 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Informe o novo valor"
    />
  )
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="metric-card">
      <div className="label"><Icon name={icon} size={14} />{label}</div>
      <div className="value">{value}</div>
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
