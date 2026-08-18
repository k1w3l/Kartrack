import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import { useUI } from '../components/UIProvider'
import Field, { AutoGrowTextarea } from '../components/Field'
import Icon from '../components/Icon'
import { ButtonSpinner } from '../components/Loading'

const COMBUSTIVEIS_PADRAO = ['Gasolina Comum', 'Gasolina Aditivada', 'Gasolina Podium', 'Diesel', 'Etanol']
const BANDEIRAS_PADRAO = ['Ipiranga', 'SIM', 'BR', 'Shell', 'Outros']

export default function FuelPage({ vehicleId }) {
  const navigate = useNavigate()
  const { confirm, toast } = useUI()
  const [submitting, setSubmitting] = useState(false)
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const cloneId = searchParams.get('clone')
  const returnPath = searchParams.get('return')
  const returnFilters = searchParams.get('filters')
  const isEditing = Boolean(editId)

  const restoreTimelineFilters = () => {
    if (returnFilters && vehicleId) {
      try {
        localStorage.setItem(`kartrack_timeline_filters_${vehicleId}`, decodeURIComponent(returnFilters))
      } catch {}
    }
  }

  const [combustiveis, setCombustiveis] = useState(COMBUSTIVEIS_PADRAO)
  const [bandeiras, setBandeiras] = useState(BANDEIRAS_PADRAO)
  const [postos, setPostos] = useState([])
  const [novoCombustivel, setNovoCombustivel] = useState('')
  const [novaBandeira, setNovaBandeira] = useState('')
  const [novoLocal, setNovoLocal] = useState('')
  const [showNovoCombustivel, setShowNovoCombustivel] = useState(false)
  const [showNovaBandeira, setShowNovaBandeira] = useState(false)
  const [showNovoLocal, setShowNovoLocal] = useState(false)

  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    quilometragem: 0,
    tipo_combustivel: COMBUSTIVEIS_PADRAO[0],
    litros: 0,
    valor_total: 0,
    tanque_cheio: false,
    bandeira: BANDEIRAS_PADRAO[0],
    local: '',
    descricao: '',
  })

  const loadCombustiveis = async () => {
    const { data } = await api.get('/lookup', { params: { category: 'fuel_type' } })
    setCombustiveis((Array.isArray(data) ? data.map((item) => item.value) : []).filter(Boolean))
  }

  const loadBandeiras = async () => {
    const { data } = await api.get('/lookup', { params: { category: 'fuel_brand' } })
    const values = (Array.isArray(data) ? data.map((item) => item.value) : []).filter(Boolean)
    setBandeiras(values)
    setForm((prev) => ({ ...prev, bandeira: values.includes(prev.bandeira) ? prev.bandeira : (values[0] || '') }))
  }

  const loadLocais = async (bandeira) => {
    if (!bandeira) { setPostos([]); return }
    const { data } = await api.get('/lookup', { params: { category: 'fuel_location', parent_value: bandeira } })
    setPostos(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    loadCombustiveis().catch(() => {})
    loadBandeiras().catch(() => {})
  }, [])

  useEffect(() => {
    loadLocais(form.bandeira).catch(() => setPostos([]))
  }, [form.bandeira])

  useEffect(() => {
    if (!vehicleId || isEditing) return
    api.get('/fuel/last', { params: { vehicle_id: vehicleId } }).then(({ data }) => {
      if (!data) return
      const [bandeira, ...rest] = String(data.posto || '').split(' - ')
      const local = rest.join(' - ')
      setForm((prev) => ({
        ...prev,
        tipo_combustivel: data.tipo_combustivel || prev.tipo_combustivel,
        quilometragem: data.quilometragem || prev.quilometragem,
        tanque_cheio: Boolean(data.tanque_cheio),
        bandeira: bandeiras.includes(bandeira) ? bandeira : prev.bandeira,
        local: local || prev.local,
      }))
    }).catch(() => {})
  }, [vehicleId, bandeiras, isEditing])

  useEffect(() => {
    if (!vehicleId || (!editId && !cloneId)) return
    api.get(`/fuel/${editId || cloneId}`).then(({ data }) => {
      const [bandeira, ...rest] = String(data.posto || '').split(' - ')
      const local = rest.join(' - ')
      setForm({
        data: String(data.data || '').slice(0, 10) || new Date().toISOString().slice(0,10),
        quilometragem: isEditing ? (data.quilometragem || 0) : '',
        tipo_combustivel: data.tipo_combustivel || COMBUSTIVEIS_PADRAO[0],
        litros: isEditing ? (data.litros || 0) : '',
        valor_total: isEditing ? (data.valor_total || 0) : '',
        tanque_cheio: Boolean(data.tanque_cheio),
        bandeira: bandeira || BANDEIRAS_PADRAO[0],
        local: local || '',
        descricao: data.descricao || '',
      })
    }).catch(() => navigate('/'))
  }, [vehicleId, editId, cloneId, navigate, isEditing])

  const locaisUnicos = useMemo(() => [...new Set((postos || []).map((p) => p.value).filter(Boolean))], [postos])

  const submit = async (e) => {
    e.preventDefault()
    if (submitting) return
    const dataIso = form.data

    const payload = {
      data: dataIso,
      quilometragem: Number(form.quilometragem),
      tipo_combustivel: form.tipo_combustivel,
      litros: Number(form.litros),
      valor_total: Number(form.valor_total),
      tanque_cheio: Boolean(form.tanque_cheio),
      posto: `${form.bandeira} - ${form.local}`,
      descricao: form.descricao,
      vehicle_id: vehicleId,
    }

    setSubmitting(true)
    try {
      if (isEditing) await api.put(`/fuel/${editId}`, payload)
      else await api.post('/fuel', payload)
      toast.success(isEditing ? 'Abastecimento atualizado.' : 'Abastecimento salvo.')
      restoreTimelineFilters()
      navigate(returnPath ? decodeURIComponent(returnPath) : '/')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Não foi possível salvar o abastecimento.')
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    restoreTimelineFilters()
    navigate(returnPath ? decodeURIComponent(returnPath) : -1)
  }

  const deleteCurrent = async () => {
    if (!editId) return
    const ok = await confirm({ title: 'Excluir abastecimento', message: 'Deseja excluir este abastecimento?', confirmLabel: 'Excluir', danger: true })
    if (!ok) return
    await api.delete(`/fuel/${editId}`)
    toast.success('Abastecimento excluído.')
    restoreTimelineFilters()
    navigate(returnPath ? decodeURIComponent(returnPath) : '/')
  }

  const valorLitro = form.litros ? Number(form.valor_total) / Number(form.litros) : 0

  return (
    <form className="card" onSubmit={submit}>
      <h1 className="page-title"><Icon name="fuel" />{isEditing ? 'Editar abastecimento' : cloneId ? 'Clonar abastecimento' : 'Novo abastecimento'}</h1>
      <div className="grid-2">
        <Field label="Data" icon="calendar"><input className="input" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required /></Field>
        <Field label="Quilometragem do abastecimento" icon="route"><input className="input" type="number" inputMode="numeric" min="0" value={form.quilometragem} onChange={(e) => setForm({ ...form, quilometragem: e.target.value })} required /></Field>
        <Field label="Tipo de combustível" icon="droplets">
          <select className="select" value={form.tipo_combustivel} onChange={(e) => setForm({ ...form, tipo_combustivel: e.target.value })}>{combustiveis.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select>
          <button type="button" className="btn btn-link btn-sm" onClick={() => setShowNovoCombustivel((v) => !v)}>{showNovoCombustivel ? 'Cancelar novo combustível' : 'Cadastrar novo combustível'}</button>
          {showNovoCombustivel && (
            <div className="inline-add">
              <input className="input" value={novoCombustivel} onChange={(e) => setNovoCombustivel(e.target.value)} placeholder="Ex.: GNV" />
              <button type="button" className="btn btn-accent btn-sm" onClick={async () => { const value = novoCombustivel.trim(); if (!value) return; try { await api.post('/lookup', { category: 'fuel_type', value }); await loadCombustiveis(); setForm((prev) => ({ ...prev, tipo_combustivel: value })); setNovoCombustivel(''); setShowNovoCombustivel(false) } catch { toast.error('Combustível já cadastrado.') } }}>Adicionar</button>
            </div>
          )}
        </Field>
        <Field label="Litros abastecidos" icon="droplet"><input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={form.litros} onChange={(e) => setForm({ ...form, litros: e.target.value })} required /></Field>
        <Field label="Valor total" icon="banknote"><input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} required /></Field>
        <Field label="Tanque cheio" icon="gauge">
          <label className="check">
            <input id="tanque_cheio" type="checkbox" checked={form.tanque_cheio} onChange={(e) => setForm({ ...form, tanque_cheio: e.target.checked })} />
            Marcar quando o abastecimento completar o tanque
          </label>
        </Field>
        <Field label="Bandeira" icon="flag">
          <select className="select" value={form.bandeira} onChange={(e) => setForm({ ...form, bandeira: e.target.value, local: '' })}>{bandeiras.map((bandeira) => <option key={bandeira} value={bandeira}>{bandeira}</option>)}</select>
          <button type="button" className="btn btn-link btn-sm" onClick={() => setShowNovaBandeira((v) => !v)}>{showNovaBandeira ? 'Cancelar nova bandeira' : 'Cadastrar nova bandeira'}</button>
          {showNovaBandeira && (
            <div className="inline-add">
              <input className="input" value={novaBandeira} onChange={(e) => setNovaBandeira(e.target.value)} placeholder="Ex.: Ale" />
              <button type="button" className="btn btn-accent btn-sm" onClick={async () => { const value = novaBandeira.trim(); if (!value) return; try { await api.post('/lookup', { category: 'fuel_brand', value }); await loadBandeiras(); setForm((prev) => ({ ...prev, bandeira: value, local: '' })); setNovaBandeira(''); setShowNovaBandeira(false) } catch { toast.error('Bandeira já cadastrada.') } }}>Adicionar</button>
            </div>
          )}
        </Field>
        <Field label="Local" icon="mapPin">
          <select className="select" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} required>
            <option value="">Selecione o local</option>
            {locaisUnicos.map((local) => <option key={local} value={local}>{local}</option>)}
          </select>
          <button type="button" className="btn btn-link btn-sm" onClick={() => setShowNovoLocal((v) => !v)}>{showNovoLocal ? 'Cancelar novo local' : 'Cadastrar novo local'}</button>
          {showNovoLocal && (
            <div className="inline-add">
              <input className="input" value={novoLocal} onChange={(e) => setNovoLocal(e.target.value)} placeholder="Ex.: Avenida Central, 123" />
              <button type="button" className="btn btn-accent btn-sm" onClick={async () => { const value = novoLocal.trim(); if (!value || !form.bandeira) return; try { await api.post('/lookup', { category: 'fuel_location', value, parent_value: form.bandeira }); await loadLocais(form.bandeira); setForm((prev) => ({ ...prev, local: value })); setNovoLocal(''); setShowNovoLocal(false) } catch { toast.error('Local já cadastrado para esta bandeira.') } }}>Adicionar</button>
            </div>
          )}
        </Field>
        <Field label="Descrição" icon="stickyNote" span><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
      </div>
      <p style={{ marginTop: 16 }} className="cluster"><Icon name="calculator" size={16} />Valor do litro: <strong className="num">R$ {valorLitro.toFixed(2)}</strong></p>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? <><ButtonSpinner />Salvando...</> : <><Icon name="save" size={16} />Salvar</>}
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={submitting}><Icon name="arrowLeft" size={16} />Cancelar</button>
        {isEditing && <button type="button" className="btn btn-danger" onClick={deleteCurrent}><Icon name="trash" size={16} />Excluir registro</button>}
      </div>
    </form>
  )
}
