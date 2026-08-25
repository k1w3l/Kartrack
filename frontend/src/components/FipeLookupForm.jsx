import { useEffect, useState } from 'react'
import api from '../api'
import Field from './Field'
import Icon from './Icon'

const VEHICLE_TYPES = [
  { value: 'cars', label: 'Carros' },
  { value: 'motorcycles', label: 'Motos' },
  { value: 'trucks', label: 'Caminhões' },
]

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (error?.response?.status === 429) return 'Muitas consultas. Aguarde um momento e tente de novo.'
  return 'Não foi possível consultar a FIPE. Tente novamente.'
}

export default function FipeLookupForm() {
  const [vehicleType, setVehicleType] = useState('cars')
  const [brandId, setBrandId] = useState('')
  const [modelId, setModelId] = useState('')
  const [yearCode, setYearCode] = useState('')
  const [brands, setBrands] = useState([])
  const [models, setModels] = useState([])
  const [years, setYears] = useState([])
  const [result, setResult] = useState(null)
  const [loadingBrands, setLoadingBrands] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [loadingYears, setLoadingYears] = useState(false)
  const [loadingPrice, setLoadingPrice] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setBrandId('')
    setModelId('')
    setYearCode('')
    setModels([])
    setYears([])
    setResult(null)
    setError('')
    setLoadingBrands(true)
    api.get('/fipe/brands', { params: { vehicle_type: vehicleType } })
      .then(({ data }) => setBrands(Array.isArray(data) ? data : []))
      .catch((err) => {
        setBrands([])
        setError(getErrorMessage(err))
      })
      .finally(() => setLoadingBrands(false))
  }, [vehicleType])

  useEffect(() => {
    setModelId('')
    setYearCode('')
    setYears([])
    setResult(null)
    if (!brandId) {
      setModels([])
      return
    }
    setLoadingModels(true)
    setError('')
    api.get('/fipe/models', { params: { vehicle_type: vehicleType, brand_id: Number(brandId) } })
      .then(({ data }) => setModels(Array.isArray(data) ? data : []))
      .catch((err) => {
        setModels([])
        setError(getErrorMessage(err))
      })
      .finally(() => setLoadingModels(false))
  }, [vehicleType, brandId])

  useEffect(() => {
    setYearCode('')
    setResult(null)
    if (!brandId || !modelId) {
      setYears([])
      return
    }
    setLoadingYears(true)
    setError('')
    api.get('/fipe/years', {
      params: {
        vehicle_type: vehicleType,
        brand_id: Number(brandId),
        model_id: Number(modelId),
      },
    })
      .then(({ data }) => setYears(Array.isArray(data) ? data : []))
      .catch((err) => {
        setYears([])
        setError(getErrorMessage(err))
      })
      .finally(() => setLoadingYears(false))
  }, [vehicleType, brandId, modelId])

  useEffect(() => {
    if (!brandId || !modelId || !yearCode) {
      setResult(null)
      return
    }
    setLoadingPrice(true)
    setError('')
    api.get('/fipe/price', {
      params: {
        vehicle_type: vehicleType,
        brand_id: Number(brandId),
        model_id: Number(modelId),
        year_code: yearCode,
      },
    })
      .then(({ data }) => setResult(data || null))
      .catch((err) => {
        setResult(null)
        setError(getErrorMessage(err))
      })
      .finally(() => setLoadingPrice(false))
  }, [vehicleType, brandId, modelId, yearCode])

  return (
    <div className="stack">
      <Field label="Tipo" htmlFor="fipe-vehicle-type">
        <select
          id="fipe-vehicle-type"
          className="select"
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
        >
          {VEHICLE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Marca" htmlFor="fipe-brand">
        <select
          id="fipe-brand"
          className="select"
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          disabled={loadingBrands}
        >
          <option value="">{loadingBrands ? 'Carregando...' : 'Selecione'}</option>
          {brands.map((b) => (
            <option key={b.codigo} value={b.codigo}>{b.nome}</option>
          ))}
        </select>
      </Field>

      <Field label="Modelo" htmlFor="fipe-model">
        <select
          id="fipe-model"
          className="select"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          disabled={!brandId || loadingModels}
        >
          <option value="">{loadingModels ? 'Carregando...' : 'Selecione'}</option>
          {models.map((m) => (
            <option key={m.codigo} value={m.codigo}>{m.nome}</option>
          ))}
        </select>
      </Field>

      <Field label="Ano/combustível" htmlFor="fipe-year">
        <select
          id="fipe-year"
          className="select"
          value={yearCode}
          onChange={(e) => setYearCode(e.target.value)}
          disabled={!modelId || loadingYears}
        >
          <option value="">{loadingYears ? 'Carregando...' : 'Selecione'}</option>
          {years.map((y) => (
            <option key={y.codigo} value={y.codigo}>{y.nome}</option>
          ))}
        </select>
      </Field>

      {error && <div className="alert alert-danger">{error}</div>}

      {loadingPrice && (
        <div className="muted small cluster">
          <Icon name="loader" size={16} spin />Consultando valor FIPE...
        </div>
      )}

      {result && !loadingPrice && (
        <div className="alert alert-ok">
          <div className="fipe-lookup-price">{brl.format(Number(result.valor_fipe || 0))}</div>
          {(result.marca || result.modelo) && (
            <div className="small">
              {[result.marca, result.modelo].filter(Boolean).join(' · ')}
            </div>
          )}
          <div className="muted small">
            {result.ano_modelo != null && <span><strong>Ano:</strong> {result.ano_modelo}</span>}
            {result.combustivel && <span><strong>Combustível:</strong> {result.combustivel}</span>}
          </div>
          <div className="muted small">
            {result.fipe_reference && <span><strong>Tabela:</strong> {result.fipe_reference}</span>}
            {result.fipe_code && <span><strong>Código:</strong> {result.fipe_code}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
