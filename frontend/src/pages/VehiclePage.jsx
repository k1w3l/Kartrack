import { useEffect, useState } from 'react'
import api, { API_BASE_URL } from '../api'
import { useUI } from '../components/UIProvider'
import Icon from '../components/Icon'
import { ButtonSpinner } from '../components/Loading'

const emptyForm = {
  id: null,
  nome: '',
  marca: '',
  modelo: '',
  ano: 2020,
  placa: '',
  combustivel_principal: 'Gasolina',
  tipo_veiculo: 'cars',
  quilometragem_atual: 0,
  valor_fipe: 0,
  fipe_brand_id: '',
  fipe_model_id: '',
  fipe_year_code: '',
  fipe_code: '',
  fipe_reference: '',
  foto_url: '',
}

export default function VehiclePage({ onSaved, activeVehicleId, setActiveVehicleId }) {
  const { confirm, toast } = useUI()
  const [submitting, setSubmitting] = useState(false)
  const [syncingId, setSyncingId] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null)
  const [brands, setBrands] = useState([])
  const [models, setModels] = useState([])
  const [years, setYears] = useState([])
  const [fipePreview, setFipePreview] = useState(null)

  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, '')

  const loadVehicles = async () => {
    const { data } = await api.get('/vehicles')
    setVehicles(
      data
        .map((v) => ({ ...v, foto_url: v.foto_url ? `${apiOrigin}${v.foto_url}` : null })),
    )
  }

  useEffect(() => {
    loadVehicles()
  }, [])

  useEffect(() => {
    api.get('/fipe/brands', { params: { vehicle_type: 'cars' } })
      .then(({ data }) => setBrands(Array.isArray(data) ? data : []))
      .catch(() => setBrands([]))
  }, [])

  useEffect(() => {
    if (!form.fipe_brand_id) { setModels([]); return }
    api.get('/fipe/models', { params: { vehicle_type: 'cars', brand_id: Number(form.fipe_brand_id) } })
      .then(({ data }) => setModels(Array.isArray(data) ? data : []))
      .catch(() => setModels([]))
  }, [form.fipe_brand_id])

  useEffect(() => {
    if (!form.fipe_brand_id || !form.fipe_model_id) { setYears([]); return }
    api.get('/fipe/years', { params: { vehicle_type: 'cars', brand_id: Number(form.fipe_brand_id), model_id: Number(form.fipe_model_id) } })
      .then(({ data }) => setYears(Array.isArray(data) ? data : []))
      .catch(() => setYears([]))
  }, [form.fipe_brand_id, form.fipe_model_id])

  useEffect(() => {
    if (!form.fipe_brand_id || !form.fipe_model_id || !form.fipe_year_code) { setFipePreview(null); return }
    api.get('/fipe/price', { params: { vehicle_type: 'cars', brand_id: Number(form.fipe_brand_id), model_id: Number(form.fipe_model_id), year_code: form.fipe_year_code } })
      .then(({ data }) => {
        setFipePreview(data || null)
        setForm((prev) => ({
          ...prev,
          valor_fipe: Number(data?.valor_fipe || 0),
          fipe_code: data?.fipe_code || prev.fipe_code,
          fipe_reference: data?.fipe_reference || prev.fipe_reference,
          marca: data?.marca || prev.marca,
          modelo: data?.modelo || prev.modelo,
          ano: Number(data?.ano_modelo || prev.ano || 0),
          combustivel_principal: data?.combustivel || prev.combustivel_principal,
        }))
      })
      .catch(() => setFipePreview(null))
  }, [form.fipe_brand_id, form.fipe_model_id, form.fipe_year_code])

  const loadToEdit = (vehicle) => {
    setSelectedPhotoFile(null)
    setForm({
      id: vehicle.id,
      nome: vehicle.nome,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      ano: vehicle.ano,
      placa: vehicle.placa,
      combustivel_principal: vehicle.combustivel_principal,
      tipo_veiculo: 'cars',
      quilometragem_atual: vehicle.quilometragem_atual,
      valor_fipe: vehicle.valor_fipe,
      fipe_brand_id: vehicle.fipe_brand_id || '',
      fipe_model_id: vehicle.fipe_model_id || '',
      fipe_year_code: vehicle.fipe_year_code || '',
      fipe_code: vehicle.fipe_code || '',
      fipe_reference: vehicle.fipe_reference || '',
      foto_url: vehicle.foto_url || '',
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!form.fipe_brand_id || !form.fipe_model_id || !form.fipe_year_code) {
      toast.warning('Selecione Marca, Modelo e Ano/combustível para consultar a FIPE.')
      return
    }
    const payload = {
      nome: form.nome,
      marca: form.marca || fipePreview?.marca || '',
      modelo: form.modelo || fipePreview?.modelo || '',
      ano: Number(form.ano || fipePreview?.ano_modelo || 2000),
      placa: form.placa,
      combustivel_principal: form.combustivel_principal || fipePreview?.combustivel || 'Gasolina',
      tipo_veiculo: 'cars',
      quilometragem_atual: Number(form.quilometragem_atual || 0),
      valor_fipe: Number(form.valor_fipe),
      fipe_brand_id: form.fipe_brand_id ? Number(form.fipe_brand_id) : null,
      fipe_model_id: form.fipe_model_id ? Number(form.fipe_model_id) : null,
      fipe_year_code: form.fipe_year_code || null,
      fipe_code: form.fipe_code || null,
      fipe_reference: form.fipe_reference || null,
    }

    setSubmitting(true)
    try {
      let savedVehicle
      if (form.id) {
        const { data } = await api.put(`/vehicles/${form.id}`, payload)
        savedVehicle = data
      } else {
        const { data } = await api.post('/vehicles', payload)
        savedVehicle = data
      }

      if (selectedPhotoFile && savedVehicle?.id) {
        const fd = new FormData()
        fd.append('file', selectedPhotoFile)
        const { data } = await api.post(`/vehicles/${savedVehicle.id}/photo`, fd)
        savedVehicle = data
      }

      if (savedVehicle?.id) setActiveVehicleId?.(Number(savedVehicle.id))
      setForm(emptyForm)
      setSelectedPhotoFile(null)
      await loadVehicles()
      onSaved?.()
      toast.success(form.id ? 'Veículo atualizado.' : 'Veículo cadastrado.')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Não foi possível salvar o veículo.')
    } finally {
      setSubmitting(false)
    }
  }

  const setDefault = async (id) => {
    setActiveVehicleId?.(id)
    await loadVehicles()
    onSaved?.()
  }

  const removeVehicle = async (id) => {
    const ok = await confirm({ title: 'Excluir veículo', message: 'Deseja excluir este veículo? Esta ação remove também abastecimentos e despesas vinculadas.', confirmLabel: 'Excluir', danger: true })
    if (!ok) return
    await api.delete(`/vehicles/${id}`)
    toast.success('Veículo excluído.')
    await loadVehicles()
    if (Number(activeVehicleId) === Number(id)) {
      const { data } = await api.get('/vehicles')
      const next = Array.isArray(data) && data.length ? Number(data[0].id) : null
      setActiveVehicleId?.(next)
    }
    onSaved?.()
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedPhotoFile(file)
    e.target.value = ''
  }

  return (
    <div className="stack-lg">
      <div className="card">
        <h1 className="page-title"><Icon name="car" />Veículos cadastrados</h1>
        <div className="vehicle-grid">
          {vehicles.map((vehicle) => (
            <div className={`card vehicle-card${vehicle.id === activeVehicleId ? ' is-active' : ''}`} key={vehicle.id}>
              <div className="vehicle-card-main">
                {vehicle.foto_url ? (
                  <img src={vehicle.foto_url} alt={vehicle.nome} className="vehicle-thumb" />
                ) : (
                  <div className="vehicle-thumb"><Icon name="car" /></div>
                )}
                <div className="stack">
                  <h3>{vehicle.nome}</h3>
                  <p className="muted small">{vehicle.marca} {vehicle.modelo} • {vehicle.ano}</p>
                  <p className="muted small"><strong>Placa:</strong> {vehicle.placa}</p>
                  <p className="muted small"><strong>Combustível:</strong> {vehicle.combustivel_principal}</p>
                  <p className="muted small"><strong>Km atual:</strong> {vehicle.quilometragem_atual}</p>
                  <p className="muted small"><strong>FIPE:</strong> R$ {Number(vehicle.valor_fipe || 0).toFixed(2)}</p>
                  {vehicle.fipe_reference && <p className="muted small"><strong>Tabela:</strong> {vehicle.fipe_reference}</p>}
                  {vehicle.fipe_code && <p className="muted small"><strong>Código FIPE:</strong> {vehicle.fipe_code}</p>}
                </div>
              </div>
              <div className="cluster">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => loadToEdit(vehicle)} title="Editar">
                  <Icon name="squarePen" size={14} />Editar
                </button>
                <button type="button" className="btn btn-sm btn-ok" disabled={syncingId === vehicle.id} onClick={async () => { setSyncingId(vehicle.id); try { await api.post(`/vehicles/${vehicle.id}/fipe-sync`); await loadVehicles(); onSaved?.(); toast.success('Valor FIPE atualizado.') } catch (err) { toast.error(err?.response?.data?.detail || 'Falha ao atualizar a FIPE.') } finally { setSyncingId(null) } }} title="Atualizar FIPE">
                  <Icon name="refresh" size={14} spin={syncingId === vehicle.id} />FIPE
                </button>
                {vehicle.id !== activeVehicleId && (
                  <button type="button" className="btn btn-sm btn-accent" onClick={() => setDefault(vehicle.id)} title="Selecionar veículo">
                    <Icon name="star" size={14} />Selecionar
                  </button>
                )}
                {vehicle.id === activeVehicleId && <span className="badge badge-accent" title="Veículo ativo"><Icon name="star" size={14} /></span>}
                <button type="button" className="btn btn-sm btn-danger" onClick={() => removeVehicle(vehicle.id)} title="Deletar">
                  <Icon name="trash" size={14} />Deletar
                </button>
              </div>
            </div>
          ))}
          {!vehicles.length && <p className="muted">Nenhum veículo cadastrado.</p>}
        </div>
      </div>

      <form className="card" onSubmit={submit}>
        <h2 className="page-title"><Icon name={form.id ? 'squarePen' : 'plus'} />
          {form.id ? 'Editar veículo' : 'Cadastrar novo veículo'}
        </h2>
        <div className="grid-2">
          {[
            ['nome', 'Nome'],
            ['placa', 'Placa'],
          ].map(([key, label]) => (
            <div className="field" key={key}>
              <label className="field-label"><Icon name="info" size={14} />{label}</label>
              <input className="input" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={key !== 'valor_fipe'} />
            </div>
          ))}
          <div className="field">
            <label className="field-label"><Icon name="factory" size={14} />Marca</label>
            <select className="select" value={form.fipe_brand_id} onChange={(e) => setForm({ ...form, fipe_brand_id: e.target.value, fipe_model_id: '', fipe_year_code: '' })}>
              <option value="">Selecione</option>
              {brands.map((b) => <option key={b.codigo} value={b.codigo}>{b.nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label"><Icon name="car" size={14} />Modelo</label>
            <select className="select" value={form.fipe_model_id} onChange={(e) => setForm({ ...form, fipe_model_id: e.target.value, fipe_year_code: '' })} disabled={!form.fipe_brand_id}>
              <option value="">Selecione</option>
              {models.map((m) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label"><Icon name="calendar" size={14} />Ano/combustível</label>
            <select className="select" value={form.fipe_year_code} onChange={(e) => setForm({ ...form, fipe_year_code: e.target.value })} disabled={!form.fipe_model_id}>
              <option value="">Selecione</option>
              {years.map((y) => <option key={y.codigo} value={y.codigo}>{y.nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label"><Icon name="wallet" size={14} />Valor FIPE</label>
            <input className="input" value={form.valor_fipe} readOnly />
          </div>

          <div className="field">
            <label className="field-label"><Icon name="image" size={14} />Foto do veículo</label>
            <input className="input" type="file" accept="image/*" onChange={handlePhotoChange} />
            {selectedPhotoFile && (
              <p className="muted small">
                Arquivo selecionado: {selectedPhotoFile.name}
              </p>
            )}
          </div>

        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <><ButtonSpinner />Salvando...</> : <><Icon name="save" size={16} />Salvar veículo</>}
          </button>
          {form.id && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setForm(emptyForm)
                setSelectedPhotoFile(null)
              }}
            >
              <Icon name="x" size={16} />Cancelar edição
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
