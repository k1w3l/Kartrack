import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'

const COMBUSTIVEIS_PADRAO = ['Gasolina Comum', 'Gasolina Aditivada', 'Gasolina Podium', 'Diesel', 'Etanol']
const BANDEIRAS_PADRAO = ['Ipiranga', 'SIM', 'BR', 'Shell', 'Outros']

export default function FuelPage({ vehicleId }) {
  const navigate = useNavigate()
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

    if (isEditing) await api.put(`/fuel/${editId}`, payload)
    else await api.post('/fuel', payload)
    restoreTimelineFilters()
    navigate(returnPath ? decodeURIComponent(returnPath) : '/')
  }

  const handleCancel = () => {
    restoreTimelineFilters()
    navigate(returnPath ? decodeURIComponent(returnPath) : -1)
  }

  const deleteCurrent = async () => {
    if (!editId || !window.confirm('Deseja excluir este abastecimento?')) return
    await api.delete(`/fuel/${editId}`)
    restoreTimelineFilters()
    navigate(returnPath ? decodeURIComponent(returnPath) : '/')
  }

  const valorLitro = form.litros ? Number(form.valor_total) / Number(form.litros) : 0

  return (
    <form className="card card-body" onSubmit={submit}>
      <h4><i className="fa-solid fa-gas-pump me-2" />{isEditing ? 'Editar abastecimento' : cloneId ? 'Clonar abastecimento' : 'Novo abastecimento'}</h4>
      <div className="row g-2">
        <Field label="Data" icon="fa-regular fa-calendar-days"><input className="form-control" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required /></Field>
        <Field label="Quilometragem do abastecimento" icon="fa-solid fa-road"><input className="form-control" value={form.quilometragem} onChange={(e) => setForm({ ...form, quilometragem: e.target.value })} required /></Field>
        <Field label="Tipo de combustível" icon="fa-solid fa-oil-can"><select className="form-select" value={form.tipo_combustivel} onChange={(e) => setForm({ ...form, tipo_combustivel: e.target.value })}>{combustiveis.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select><button type="button" className="btn btn-link btn-sm mt-1 px-0" onClick={() => setShowNovoCombustivel((v) => !v)}>{showNovoCombustivel ? 'Cancelar novo combustível' : 'Cadastrar novo combustível'}</button>{showNovoCombustivel && <div className="d-flex gap-2 mt-1"><input className="form-control form-control-sm" value={novoCombustivel} onChange={(e) => setNovoCombustivel(e.target.value)} placeholder="Ex.: GNV" /><button type="button" className="btn btn-sm btn-outline-primary" onClick={async () => { const value = novoCombustivel.trim(); if (!value) return; try { await api.post('/lookup', { category: 'fuel_type', value }); await loadCombustiveis(); setForm((prev) => ({ ...prev, tipo_combustivel: value })); setNovoCombustivel(''); setShowNovoCombustivel(false) } catch { alert('Combustível já cadastrado.') } }}>Adicionar</button></div>}</Field>
        <Field label="Litros abastecidos" icon="fa-solid fa-droplet"><input className="form-control" value={form.litros} onChange={(e) => setForm({ ...form, litros: e.target.value })} required /></Field>
        <Field label="Valor total" icon="fa-solid fa-money-bill-wave"><input className="form-control" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} required /></Field>
        <Field label="Tanque cheio" icon="fa-solid fa-gauge-high">
          <div className="form-check mt-2">
            <input className="form-check-input" id="tanque_cheio" type="checkbox" checked={form.tanque_cheio} onChange={(e) => setForm({ ...form, tanque_cheio: e.target.checked })} />
            <label className="form-check-label" htmlFor="tanque_cheio">Marcar quando o abastecimento completar o tanque</label>
          </div>
        </Field>
        <Field label="Bandeira" icon="fa-solid fa-flag"><select className="form-select" value={form.bandeira} onChange={(e) => setForm({ ...form, bandeira: e.target.value, local: '' })}>{bandeiras.map((bandeira) => <option key={bandeira} value={bandeira}>{bandeira}</option>)}</select><button type="button" className="btn btn-link btn-sm mt-1 px-0" onClick={() => setShowNovaBandeira((v) => !v)}>{showNovaBandeira ? 'Cancelar nova bandeira' : 'Cadastrar nova bandeira'}</button>{showNovaBandeira && <div className="d-flex gap-2 mt-1"><input className="form-control form-control-sm" value={novaBandeira} onChange={(e) => setNovaBandeira(e.target.value)} placeholder="Ex.: Ale" /><button type="button" className="btn btn-sm btn-outline-primary" onClick={async () => { const value = novaBandeira.trim(); if (!value) return; try { await api.post('/lookup', { category: 'fuel_brand', value }); await loadBandeiras(); setForm((prev) => ({ ...prev, bandeira: value, local: '' })); setNovaBandeira(''); setShowNovaBandeira(false) } catch { alert('Bandeira já cadastrada.') } }}>Adicionar</button></div>}</Field>
        <Field label="Local" icon="fa-solid fa-location-dot"><select className="form-select" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} required><option value="">Selecione o local</option>{locaisUnicos.map((local) => <option key={local} value={local}>{local}</option>)}</select><button type="button" className="btn btn-link btn-sm mt-1 px-0" onClick={() => setShowNovoLocal((v) => !v)}>{showNovoLocal ? 'Cancelar novo local' : 'Cadastrar novo local'}</button>{showNovoLocal && <div className="d-flex gap-2 mt-1"><input className="form-control form-control-sm" value={novoLocal} onChange={(e) => setNovoLocal(e.target.value)} placeholder="Ex.: Avenida Central, 123" /><button type="button" className="btn btn-sm btn-outline-primary" onClick={async () => { const value = novoLocal.trim(); if (!value || !form.bandeira) return; try { await api.post('/lookup', { category: 'fuel_location', value, parent_value: form.bandeira }); await loadLocais(form.bandeira); setForm((prev) => ({ ...prev, local: value })); setNovoLocal(''); setShowNovoLocal(false) } catch { alert('Local já cadastrado para esta bandeira.') } }}>Adicionar</button></div>}</Field>
        <Field label="Descrição" icon="fa-regular fa-note-sticky" colClass="col-12"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
      </div>
      <p className="mt-3"><i className="fa-solid fa-calculator me-2" />Valor do litro: <strong>R$ {valorLitro.toFixed(2)}</strong></p>
      <div className="d-flex gap-2 mt-2 flex-wrap">
        <button type="submit" className="btn btn-primary"><i className="fa-solid fa-floppy-disk me-2" />Salvar</button>
        <button type="button" className="btn btn-outline-secondary" onClick={handleCancel}><i className="fa-solid fa-arrow-left me-2" />Cancelar</button>
        {isEditing && <button type="button" className="btn btn-outline-danger" onClick={deleteCurrent}><i className="fa-solid fa-trash me-2" />Excluir registro</button>}
      </div>
    </form>
  )
}

function Field({ label, icon, children, colClass = 'col-md-6' }) {
  return <div className={colClass}><label className="form-label"><i className={`${icon} me-2`} />{label}</label>{children}</div>
}

function AutoGrowTextarea({ value, onChange, minRows = 2 }) {
  return (
    <textarea
      className="form-control"
      rows={minRows}
      style={{ resize: 'vertical' }}
      value={value}
      onInput={(e) => {
        e.currentTarget.style.height = 'auto'
        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
      }}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
