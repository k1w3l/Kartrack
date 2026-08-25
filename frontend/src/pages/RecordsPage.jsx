import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useUI } from '../components/UIProvider'
import FilterSheet from '../components/FilterSheet'
import Icon, { recordIconName } from '../components/Icon'
import MetricCard from '../components/MetricCard'
import OverflowMenu from '../components/OverflowMenu'
import { ButtonSpinner } from '../components/Loading'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatTipoRegistro(tipo) {
  const t = String(tipo || '').trim().toLowerCase()
  if (!t) return 'Registro'
  return t.charAt(0).toUpperCase() + t.slice(1)
}

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
  { key: 'fuel_location', label: 'Locais de abastecimento', placeholder: 'Ex.: Avenida Central, 123', parentKey: 'fuel_brand', parentLabel: 'Bandeira' },
  { key: 'expense_multa_tipo', label: 'Tipo da multa', placeholder: 'Ex.: Rodízio' },
  { key: 'expense_seguradora', label: 'Seguradora', placeholder: 'Ex.: Tokio Marine' },
  { key: 'expense_oficina', label: 'Oficina', placeholder: 'Ex.: Oficina do João' },
  { key: 'expense_peca', label: 'Peças', placeholder: 'Ex.: Pastilha de freio' },
  { key: 'expense_servico', label: 'Serviços', placeholder: 'Ex.: Troca de óleo' },
  { key: 'expense_financeira', label: 'Financeiras', placeholder: 'Ex.: Banco XYZ' },
  { key: 'expense_estacionamento_local', label: 'Locais de estacionamento', placeholder: 'Ex.: Estacionamento Centro' },
  { key: 'expense_imposto_tipo', label: 'Tipos de imposto', placeholder: 'Ex.: Taxa administrativa' },
]

const RECORDS_PAGE_SIZE = 10

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
  const [page, setPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)

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

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / RECORDS_PAGE_SIZE))
  const displayedRecords = useMemo(() => {
    const start = (page - 1) * RECORDS_PAGE_SIZE
    return filteredRecords.slice(start, start + RECORDS_PAGE_SIZE)
  }, [filteredRecords, page])
  const pageStart = filteredRecords.length ? (page - 1) * RECORDS_PAGE_SIZE + 1 : 0
  const pageEnd = Math.min(page * RECORDS_PAGE_SIZE, filteredRecords.length)

  useEffect(() => {
    setPage(1)
  }, [bulkFilter, vehicleId])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

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
    const count = records.length
    const single = count === 1 ? records[0] : null
    const ok = await confirm({
      title: count === 1 ? 'Excluir registro' : 'Excluir registros',
      message: single
        ? `Excluir o registro ${single.tipo_registro} #${single.id}? Esta ação não pode ser desfeita.`
        : `Excluir ${count} registros selecionados? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
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

  const addDataTypeValue = async (key, value, parentValue = '') => {
    const trimmed = String(value || '').trim()
    if (!trimmed) return null
    const parent = String(parentValue || '').trim()
    const field = DATA_TYPE_FIELDS.find((item) => item.key === key)
    if (field?.parentKey && !parent) {
      toast.error(`Selecione a ${String(field.parentLabel || 'opção').toLowerCase()}.`)
      return null
    }
    try {
      const { data } = await api.post('/lookup', { category: key, value: trimmed, parent_value: parent })
      setDataTypes((prev) => ({ ...prev, [key]: [...(prev[key] || []), data] }))
      return data
    } catch {
      toast.error('Item já cadastrado.')
      return null
    }
  }

  const removeDataTypeValue = async (key, item, label) => {
    if (!item?.id) return
    const ok = await confirm({
      title: 'Excluir cadastro',
      message: `Excluir "${item.parent_value ? `${item.parent_value} — ${item.value}` : item.value}" de ${label}? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await api.delete(`/lookup/${item.id}`)
    const next = (dataTypes[key] || []).filter((v) => v.id !== item.id)
    setDataTypes((prev) => ({ ...prev, [key]: next }))
    toast.success('Cadastro excluído.')
  }

  const editRecord = (record) => {
    navigate(record.tipo_registro === 'abastecimento' ? `/abastecimento?edit=${record.id}` : `/despesa?edit=${record.id}`)
  }

  if (!vehicleId) {
    return <div className="alert alert-info">Defina um veículo padrão para usar o menu Registros.</div>
  }

  return (
    <div className="stack-lg">
      <h1 className="page-title"><Icon name="folderOpen" />Registros</h1>

      <div className="timeline-toolbar">
        <button type="button" className="btn btn-primary" aria-expanded={filterOpen} aria-haspopup="dialog" onClick={() => setFilterOpen(true)}>
          <Icon name="filter" size={16} />
          Filtrar
          {bulkFilter !== 'todos' ? <span className="filter-count">1</span> : null}
        </button>
        <p className="muted small timeline-toolbar-summary">{bulkFilter === 'todos' ? 'Todos os tipos' : formatTipoRegistro(bulkFilter)}</p>
      </div>

      <div className="metric-grid" role="list">
        <MetricCard icon="list" title="Total visível" value={filteredRecords.length} />
        <MetricCard icon="checkCheck" title="Selecionados" value={selectedRecords.length} />
        <MetricCard icon="fuel" title="Abastecimentos" value={filteredRecords.filter((record) => record.tipo_registro === 'abastecimento').length} />
        <MetricCard icon="receipt" title="Despesas" value={filteredRecords.filter((record) => record.tipo_registro !== 'abastecimento').length} />
      </div>

      <div className="card">
        <h2 className="section-title"><Icon name="layers" size={16} />Edição em massa</h2>
        <div className="records-bulk-form">
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
          <div className="records-bulk-apply">
            <button type="button" className="btn btn-primary" onClick={applyBulkEdit} disabled={applyingBulk || bulkValue === ''}>
              {applyingBulk ? <><ButtonSpinner />Aplicando...</> : <><Icon name="wand" size={16} />Aplicar</>}
            </button>
          </div>
        </div>
        <div className="cluster cluster-end" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-danger btn-sm" disabled={!selectedRecords.length} onClick={() => deleteRecords(selectedRecords)}>
            <Icon name="trash" size={16} />Excluir selecionados
          </button>
        </div>
        {loadError ? <p className="alert alert-danger" style={{ marginTop: 12 }}>{loadError}</p> : <p className="muted small" style={{ marginTop: 12 }}>{isMixedTarget ? 'Para editar qualquer campo específico, filtre ou selecione registros de um único tipo.' : 'Você pode editar em massa qualquer campo disponível para o tipo selecionado.'}</p>}
      </div>

      <div className="card">
        <div className="cluster cluster-spread">
          <h2 className="section-title" style={{ marginBottom: 0 }}><Icon name="squarePen" size={16} />Editar registros</h2>
          <label className="check">
            <input
              type="checkbox"
              aria-label="Selecionar registros desta página"
              checked={!!displayedRecords.length && displayedRecords.every((record) => selectedIds.includes(`${record.tipo_registro}:${record.id}`))}
              onChange={toggleSelectAll}
            />
            Página
          </label>
        </div>
        {filteredRecords.length > RECORDS_PAGE_SIZE && (
          <p className="muted small">Mostrando {pageStart}–{pageEnd} de {filteredRecords.length} registros</p>
        )}
        <div className="timeline-log">
          {displayedRecords.map((record) => (
            <div className="hit-row" key={`${record.tipo_registro}-${record.id}`}>
              <input type="checkbox" checked={selectedIds.includes(`${record.tipo_registro}:${record.id}`)} onChange={() => toggleSelected(record)} aria-label={`Selecionar ${formatTipoRegistro(record.tipo_registro)} #${record.id}`} />
              <button type="button" className="timeline-hit" onClick={() => editRecord(record)}>
                <div className="timeline-main">
                  <strong className="cluster"><Icon name={recordIconName(record.tipo_registro)} size={16} />{formatTipoRegistro(record.tipo_registro)}</strong>
                  {record.quilometragem ? <span className="num">{Number(record.quilometragem).toFixed(0)} km</span> : null}
                  <span className="timeline-valor">{brl.format(record.valor || 0)}</span>
                </div>
                <p className="muted small">{[record.data, record.descricao].filter(Boolean).join(' • ') || `ID #${record.id}`}</p>
              </button>
              <OverflowMenu
                items={[
                  { label: 'Editar', icon: 'squarePen', onClick: () => editRecord(record) },
                  { label: 'Excluir', icon: 'trash', danger: true, onClick: () => deleteRecords([record]) },
                ]}
              />
            </div>
          ))}
          {!filteredRecords.length && <p className="muted">Nenhum registro encontrado para o filtro.</p>}
        </div>
        {filteredRecords.length > RECORDS_PAGE_SIZE && (
          <div className="cluster cluster-spread records-pager">
            <p className="muted small">Página {page} de {totalPages}</p>
            <div className="cluster">
              <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title"><Icon name="sliders" size={16} />Tipos de dados</h2>
        <p className="muted small" style={{ marginTop: -8 }}>Os itens cadastrados ficam no dropdown de cada tipo.</p>
        <div className="grid-3">
          {DATA_TYPE_FIELDS.map((field) => (
            <DataTypeEditor
              key={field.key}
              field={field}
              values={dataTypes[field.key] || []}
              parentOptions={field.parentKey ? (dataTypes[field.parentKey] || []) : []}
              onAdd={(v, parent) => addDataTypeValue(field.key, v, parent)}
              onRemove={(item) => removeDataTypeValue(field.key, item, field.label)}
            />
          ))}
        </div>
      </div>

      <div className="cluster cluster-end">
        <button type="button" className="btn btn-danger" onClick={deleteAllRecords}>
          <Icon name="trash" size={16} />Excluir todos os registros cadastrados
        </button>
      </div>

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)}>
        <label className="field">
          <span className="field-label">Tipo</span>
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
        </label>
      </FilterSheet>
    </div>
  )
}

function DataTypeEditor({ field, values, parentOptions = [], onAdd, onRemove }) {
  const [newValue, setNewValue] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [parentValue, setParentValue] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!values.some((item) => String(item.id) === String(selectedId))) {
      setSelectedId(values[0] ? String(values[0].id) : '')
    }
  }, [values, selectedId])

  const selectedItem = values.find((item) => String(item.id) === String(selectedId))
  const itemLabel = (item) => (item.parent_value ? `${item.parent_value} — ${item.value}` : item.value)

  const submitNewValue = async () => {
    const created = await onAdd(newValue, parentValue)
    setNewValue('')
    setAdding(false)
    if (created?.id) setSelectedId(String(created.id))
  }

  return (
    <div className="records-data-type">
      <div className="records-data-type-label">{field.label} <span className="muted">({values.length})</span></div>
      <div className="records-data-type-list">
        <select
          className="select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={!values.length}
          aria-label={`Itens cadastrados em ${field.label}`}
        >
          {!values.length && <option value="">Nenhum item cadastrado</option>}
          {values.map((item) => (
            <option key={item.id || item.value} value={item.id}>{itemLabel(item)}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-ghost icon-btn"
          aria-label={adding ? 'Cancelar cadastro' : `Cadastrar em ${field.label}`}
          aria-expanded={adding}
          onClick={() => setAdding((open) => !open)}
        >
          <Icon name={adding ? 'x' : 'plus'} />
        </button>
        <button
          type="button"
          className="btn btn-ghost icon-btn"
          disabled={!selectedItem}
          onClick={() => onRemove(selectedItem)}
          title="Excluir item selecionado"
          aria-label={`Excluir ${selectedItem ? itemLabel(selectedItem) : 'item'}`}
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
      {field.parentKey && adding && (
        <select
          className="select"
          value={parentValue}
          onChange={(e) => setParentValue(e.target.value)}
          aria-label={`Selecione a ${String(field.parentLabel || 'opção').toLowerCase()}`}
        >
          <option value="">{`Selecione a ${String(field.parentLabel || 'opção').toLowerCase()}`}</option>
          {parentOptions.map((item) => (
            <option key={item.id || item.value} value={item.value}>{item.value}</option>
          ))}
        </select>
      )}
      {adding && (
        <div className="inline-add">
          <input
            className="input"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitNewValue()
              }
            }}
            placeholder={field.placeholder}
          />
          <button type="button" className="btn btn-sm btn-accent" onClick={submitNewValue}>
            Adicionar
          </button>
        </div>
      )}
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
