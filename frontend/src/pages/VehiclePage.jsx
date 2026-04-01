import { useEffect, useState } from 'react'
import api, { API_BASE_URL } from '../api'

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
    if (!form.fipe_brand_id || !form.fipe_model_id || !form.fipe_year_code) {
      alert('Selecione Marca, Modelo e Ano/combustível para consultar a FIPE.')
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
  }

  const setDefault = async (id) => {
    setActiveVehicleId?.(id)
    await loadVehicles()
    onSaved?.()
  }

  const removeVehicle = async (id) => {
    if (!window.confirm('Deseja excluir este veículo? Esta ação remove também abastecimentos e despesas vinculadas.')) return
    await api.delete(`/vehicles/${id}`)
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
    <div className="d-flex flex-column gap-3">
      <div className="card card-body">
        <h4><i className="fa-solid fa-car-side me-2" />Veículos cadastrados</h4>
        <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3 mt-1">
          {vehicles.map((vehicle) => (
            <div className="col" key={vehicle.id}>
              <div className={`card h-100 ${vehicle.id === activeVehicleId ? 'border-primary' : ''}`}>
                <div className="card-body d-flex flex-column gap-2">
                  <div className="vehicle-card-main d-flex align-items-start gap-3">
                    {vehicle.foto_url ? (
                      <img src={vehicle.foto_url} alt={vehicle.nome} className="vehicle-thumb" />
                    ) : (
                      <div className="vehicle-thumb d-flex align-items-center justify-content-center"><i className="fa-solid fa-car" /></div>
                    )}
                    <div className="d-flex flex-column gap-1">
                      <h6 className="mb-0">{vehicle.nome}</h6>
                      <small>{vehicle.marca} {vehicle.modelo} • {vehicle.ano}</small>
                      <small><strong>Placa:</strong> {vehicle.placa}</small>
                      <small><strong>Combustível:</strong> {vehicle.combustivel_principal}</small>
                      <small><strong>Km atual:</strong> {vehicle.quilometragem_atual}</small>
                      <small><strong>FIPE:</strong> R$ {Number(vehicle.valor_fipe || 0).toFixed(2)}</small>
                      {vehicle.fipe_reference && <small><strong>Tabela:</strong> {vehicle.fipe_reference}</small>}
                      {vehicle.fipe_code && <small><strong>Código FIPE:</strong> {vehicle.fipe_code}</small>}
                    </div>
                  </div>
                  <div className="d-flex gap-2 mt-2 flex-wrap">
                    <button type="button" className="btn btn-sm btn-outline-secondary vehicle-action-btn" onClick={() => loadToEdit(vehicle)} title="Editar">
                      <i className="fa-solid fa-pen-to-square me-1" /><span className="action-text">Editar</span>
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-success vehicle-action-btn" onClick={async () => { await api.post(`/vehicles/${vehicle.id}/fipe-sync`); await loadVehicles(); onSaved?.() }} title="Atualizar FIPE">
                      <i className="fa-solid fa-arrows-rotate me-1" /><span className="action-text">FIPE</span>
                    </button>
                    {vehicle.id !== activeVehicleId && (
                      <button type="button" className="btn btn-sm btn-outline-primary vehicle-action-btn" onClick={() => setDefault(vehicle.id)} title="Selecionar veículo">
                        <i className="fa-solid fa-star me-1" /><span className="action-text">Selecionar</span>
                      </button>
                    )}
                    {vehicle.id === activeVehicleId && <span className="badge text-bg-primary" title="Veículo ativo"><i className="fa-solid fa-star" /></span>}
                    <button type="button" className="btn btn-sm btn-outline-danger ms-auto vehicle-action-btn" onClick={() => removeVehicle(vehicle.id)} title="Deletar">
                      <i className="fa-solid fa-trash me-1" /><span className="action-text">Deletar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!vehicles.length && <p className="text-muted">Nenhum veículo cadastrado.</p>}
        </div>
      </div>

      <form className="card card-body" onSubmit={submit}>
        <h4>
          <i className={`fa-solid ${form.id ? 'fa-pen-to-square' : 'fa-plus'} me-2`} />
          {form.id ? 'Editar veículo' : 'Cadastrar novo veículo'}
        </h4>
        <div className="row g-2">
          {[
            ['nome', 'Nome'],
            ['placa', 'Placa'],
          ].map(([key, label]) => (
            <div className="col-md-6" key={key}>
              <label className="form-label"><i className="fa-solid fa-circle-info me-2" />{label}</label>
              <input className="form-control" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={key !== 'valor_fipe'} />
            </div>
          ))}
          <div className="col-md-6">
            <label className="form-label"><i className="fa-solid fa-industry me-2" />Marca</label>
            <select className="form-select" value={form.fipe_brand_id} onChange={(e) => setForm({ ...form, fipe_brand_id: e.target.value, fipe_model_id: '', fipe_year_code: '' })}>
              <option value="">Selecione</option>
              {brands.map((b) => <option key={b.codigo} value={b.codigo}>{b.nome}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label"><i className="fa-solid fa-car-side me-2" />Modelo</label>
            <select className="form-select" value={form.fipe_model_id} onChange={(e) => setForm({ ...form, fipe_model_id: e.target.value, fipe_year_code: '' })} disabled={!form.fipe_brand_id}>
              <option value="">Selecione</option>
              {models.map((m) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label"><i className="fa-solid fa-calendar me-2" />Ano/combustível</label>
            <select className="form-select" value={form.fipe_year_code} onChange={(e) => setForm({ ...form, fipe_year_code: e.target.value })} disabled={!form.fipe_model_id}>
              <option value="">Selecione</option>
              {years.map((y) => <option key={y.codigo} value={y.codigo}>{y.nome}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label"><i className="fa-solid fa-sack-dollar me-2" />Valor FIPE</label>
            <input className="form-control" value={form.valor_fipe} readOnly />
          </div>

          <div className="col-md-6">
            <label className="form-label"><i className="fa-solid fa-image me-2" />Foto do veículo</label>
            <input className="form-control" type="file" accept="image/*" onChange={handlePhotoChange} />
            {selectedPhotoFile && (
              <small className="text-muted d-block mt-1">
                Arquivo selecionado: {selectedPhotoFile.name}
              </small>
            )}
          </div>

        </div>
        <div className="mt-3 d-flex gap-2">
          <button type="submit" className="btn btn-primary"><i className="fa-solid fa-floppy-disk me-2" />Salvar veículo</button>
          {form.id && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                setForm(emptyForm)
                setSelectedPhotoFile(null)
              }}
            >
              <i className="fa-solid fa-xmark me-2" />Cancelar edição
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
