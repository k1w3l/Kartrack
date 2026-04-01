import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatDateBR(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pt-BR')
}

function getRecordIcon(tipo) {
  const t = (tipo || '').toLowerCase()
  if (t.includes('abastecimento')) return 'fa-solid fa-gas-pump'
  if (t.includes('fipe')) return 'fa-solid fa-tags'
  if (t.includes('manutenção')) return 'fa-solid fa-screwdriver-wrench'
  if (t.includes('multa')) return 'fa-solid fa-file-circle-exclamation'
  return 'fa-solid fa-wallet'
}

function formatTipoRegistro(tipo) {
  const t = String(tipo || '').trim().toLowerCase()
  if (!t) return 'Registro'
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function getInstallmentLabel(description) {
  const text = String(description || '')
  const parcela = text.match(/Parcela\s+\d+\/\d+/i)
  if (parcela) return parcela[0]
  const total = text.match(/Parcelas:\s*(\d+)/i)
  if (total) return `${total[1]} parcelas`
  return ''
}

function compactCurrency(value) {
  return brl.format(Number(value || 0))
}

function joinFilled(parts) {
  return parts.filter((part) => part !== null && part !== undefined && String(part).trim() !== '').join(' • ')
}

function parseMoney(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  if (raw.includes(',') && raw.includes('.')) return Number(raw.replace(/\./g, '').replace(',', '.')) || 0
  if (raw.includes(',')) return Number(raw.replace(',', '.')) || 0
  return Number(raw) || 0
}

function parseMaintenanceDescription(description) {
  const text = String(description || '')
  const parts = text.split(' • ').map((part) => part.trim())
  const getValue = (prefix) => parts.find((part) => part.startsWith(prefix))?.slice(prefix.length).trim() || ''
  const parseItems = (raw) => {
    if (!raw || raw === '-') return []
    return raw.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
      const match = item.match(/^(.*?)\s*\(R\$\s*([\d.,]+)\)$/)
      return {
        nome: match?.[1]?.trim() || item,
        valor: parseMoney(match?.[2] || 0),
      }
    })
  }

  return {
    pecas: parseItems(getValue('Peças: ')),
    servicos: parseItems(getValue('Serviços: ')),
    descricaoServico: getValue('Descrição: '),
    valorPecas: parseMoney(getValue('Valor peças: ')),
    valorServicos: parseMoney(getValue('Valor serviços: ')),
  }
}

function buildTimelineDescription(item) {
  const tipo = String(item.tipo_registro || '').toLowerCase()
  const maintenanceDetails = tipo.includes('manutenção') ? parseMaintenanceDescription(item.descricao) : null

  if (tipo.includes('financiamento') || tipo.includes('seguro')) {
    const inst = getInstallmentLabel(item.descricao)
    return joinFilled([formatDateBR(item.data), inst])
  }

  if (tipo.includes('manutenção')) {
    return joinFilled([
      formatDateBR(item.data),
      item.quilometragem ? `${item.quilometragem} km` : '',
      item.local,
      compactCurrency(item.valor),
    ])
  }

  if (tipo.includes('abastecimento')) {
    return joinFilled([
      formatDateBR(item.data),
      item.quilometragem ? `${item.quilometragem} km` : '',
      item.descricao,
      item.local,
    ])
  }

  return joinFilled([formatDateBR(item.data), item.local, item.descricao])
}

function buildHoverDetails(item) {
  const tipo = String(item.tipo_registro || '').toLowerCase()
  if (tipo.includes('manutenção')) {
    const details = parseMaintenanceDescription(item.descricao)
    return [
      item.local && `Oficina: ${item.local}`,
      details.pecas.length ? `Peças: ${details.pecas.map((p) => `${p.nome} (${compactCurrency(p.valor)})`).join(', ')}` : '',
      details.servicos.length ? `Serviços: ${details.servicos.map((s) => `${s.nome} (${compactCurrency(s.valor)})`).join(', ')}` : '',
      details.valorPecas ? `Valor peças: ${compactCurrency(details.valorPecas)}` : '',
      details.valorServicos ? `Valor serviços: ${compactCurrency(details.valorServicos)}` : '',
      details.descricaoServico && details.descricaoServico !== '-' ? `Descrição: ${details.descricaoServico}` : '',
      `Total: ${compactCurrency(item.valor)}`,
    ].filter(Boolean)
  }
  if (tipo.includes('abastecimento')) {
    return [
      item.bandeira ? `Bandeira: ${item.bandeira}` : '',
      item.tipo_combustivel ? `Tipo de combustível: ${item.tipo_combustivel}` : '',
      Number.isFinite(Number(item.litros)) ? `Litros abastecidos: ${Number(item.litros).toFixed(2)} L` : '',
      Number.isFinite(Number(item.valor_litro)) ? `Valor do litro: ${compactCurrency(item.valor_litro)}` : '',
      `Valor total: ${compactCurrency(item.valor)}`,
      Number.isFinite(Number(item.consumo_km_l)) ? `Média: ${Number(item.consumo_km_l).toFixed(2)} km/l` : '',
      item.observacao ? `Descrição: ${item.observacao}` : '',
    ].filter(Boolean)
  }
  if (tipo.includes('fipe')) {
    return [
      `Valor de referência: ${compactCurrency(item.valor)}`,
      item.fipe_referencia ? `Tabela: ${item.fipe_referencia}` : '',
      item.local ? `Veículo: ${item.local}` : '',
    ].filter(Boolean)
  }

  return [item.local, item.descricao, `Total: ${compactCurrency(item.valor)}`].filter(Boolean)
}

function buildFieldRows(record, timelineItem) {
  const fields = [
    ['Tipo', formatTipoRegistro(timelineItem.tipo_registro)],
    ['Data', formatDateBR(timelineItem.data)],
    ['Quilometragem', timelineItem.quilometragem ? `${timelineItem.quilometragem} km` : ''],
    ['Valor', compactCurrency(timelineItem.valor)],
  ]

  if (timelineItem.tipo_registro === 'abastecimento') {
    fields.push(['Posto', record.posto], ['Tipo de combustível', record.tipo_combustivel], ['Litros', record.litros ? `${record.litros} L` : ''], ['Tanque cheio', record.tanque_cheio ? 'Sim' : 'Não'], ['Descrição', record.descricao])
  } else {
    const maintenanceDetails = String(timelineItem.tipo_registro).toLowerCase().includes('manutenção') ? parseMaintenanceDescription(record.descricao) : null
    fields.push(['Local', record.local], ['Vencimento', record.vencimento ? formatDateBR(record.vencimento) : ''], ['Validade em km', record.validade_km ? `${record.validade_km} km` : ''], ['Validade em dias', record.validade_dias ? `${record.validade_dias} dias` : ''])
    const tipo = String(timelineItem.tipo_registro || '').toLowerCase()
    if (!['acessórios', 'estacionamento', 'impostos', 'seguro'].includes(tipo)) {
      fields.push(['Status', record.status])
    }
    if (tipo === 'acessórios') {
      fields.push(['Nome', record.local || ''])
    }
    if (maintenanceDetails) {
      fields.push(
        ['Peças', maintenanceDetails.pecas.length ? maintenanceDetails.pecas.map((p) => `${p.nome} (${compactCurrency(p.valor)})`).join(', ') : ''],
        ['Serviços', maintenanceDetails.servicos.length ? maintenanceDetails.servicos.map((s) => `${s.nome} (${compactCurrency(s.valor)})`).join(', ') : ''],
        ['Valor peças', maintenanceDetails.valorPecas ? compactCurrency(maintenanceDetails.valorPecas) : ''],
        ['Valor serviços', maintenanceDetails.valorServicos ? compactCurrency(maintenanceDetails.valorServicos) : ''],
        ['Descrição dos serviços', maintenanceDetails.descricaoServico && maintenanceDetails.descricaoServico !== '-' ? maintenanceDetails.descricaoServico : ''],
      )
    } else {
      fields.push(['Descrição', record.descricao])
    }
  }

  return fields.filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
}

export default function DashboardPage({ vehicleId, currentVehicle }) {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [timeline, setTimeline] = useState([])

  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [periodMode, setPeriodMode] = useState('historico')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedReminderIds, setSelectedReminderIds] = useState([])
  const [filtersHydrated, setFiltersHydrated] = useState(false)
  const [detailModal, setDetailModal] = useState(null)
  const printAreaRef = useRef(null)

  const load = async () => {
    if (!vehicleId) return
    const [d, t] = await Promise.all([
      api.get('/dashboard', { params: { vehicle_id: vehicleId } }),
      api.get('/timeline', { params: { vehicle_id: vehicleId } }),
    ])
    setDashboard(d.data)
    setTimeline(Array.isArray(t.data) ? t.data.filter((item) => item.tipo_registro !== 'fipe') : [])
  }

  useEffect(() => {
    if (!vehicleId) return
    load()
    const it = setInterval(load, 10000)
    return () => clearInterval(it)
  }, [vehicleId])

  useEffect(() => {
    setSelectedReminderIds([])
  }, [vehicleId, dashboard?.lembretes?.length])

  useEffect(() => {
    if (!vehicleId) return
    const saved = localStorage.getItem(`kartrack_timeline_filters_${vehicleId}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setMonth(parsed.month || String(now.getMonth() + 1).padStart(2, '0'))
        setYear(parsed.year || String(now.getFullYear()))
        setPeriodMode(parsed.periodMode || 'historico')
        setFromDate(parsed.fromDate || '')
        setToDate(parsed.toDate || '')
        setSearch(parsed.search || '')
        setTipoFiltro(parsed.tipoFiltro || 'todos')
        setPage(Number(parsed.page || 1))
        setPageSize(Number(parsed.pageSize || 10))
      } catch {}
    }
    setFiltersHydrated(true)
  }, [vehicleId])

  useEffect(() => {
    if (!vehicleId || !filtersHydrated) return
    localStorage.setItem(`kartrack_timeline_filters_${vehicleId}`, JSON.stringify({ month, year, periodMode, fromDate, toDate, search, tipoFiltro, page, pageSize }))
  }, [vehicleId, filtersHydrated, month, year, periodMode, fromDate, toDate, search, tipoFiltro, page, pageSize])

  const timelineFiltrada = useMemo(() => {
    if (!timeline.length) return []

    const inMonth = (item) => {
      const d = new Date(`${item.data}T00:00:00`)
      return String(d.getMonth() + 1).padStart(2, '0') === month && String(d.getFullYear()) === year
    }

    if (periodMode === 'historico') return timeline

    if (periodMode === 'periodo') {
      const fromIso = String(fromDate || '').trim()
      const toIso = String(toDate || '').trim()
      if (fromIso && toIso) {
        const from = new Date(`${fromIso}T00:00:00`)
        const to = new Date(`${toIso}T23:59:59`)
        return timeline.filter((item) => {
          const d = new Date(`${item.data}T00:00:00`)
          return d >= from && d <= to
        })
      }
    }

    return timeline.filter(inMonth)
  }, [timeline, periodMode, month, year, fromDate, toDate])

  const timelineExibida = useMemo(() => {
    const query = String(search || '').trim().toLowerCase()
    if (!query) return timelineFiltrada.filter((item) => tipoFiltro === 'todos' || item.tipo_registro === tipoFiltro)

    return timelineFiltrada.filter((item) => {
      const haystack = [
        item.tipo_registro,
        item.data,
        item.observacao,
        item.descricao,
        item.local,
        item.valor,
        item.quilometragem,
        item.consumo_km_l,
        buildTimelineDescription(item),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const sameType = tipoFiltro === 'todos' || item.tipo_registro === tipoFiltro
      return haystack.includes(query) && sameType
    })
  }, [timelineFiltrada, search, tipoFiltro])

  const paginatedTimeline = useMemo(() => {
    const start = (page - 1) * pageSize
    return timelineExibida.slice(start, start + pageSize)
  }, [timelineExibida, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(timelineExibida.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const metricas = useMemo(() => {
    const despesas = timelineExibida.filter((r) => r.tipo_registro !== 'abastecimento' && r.tipo_registro !== 'fipe')
    const abastecimentos = timelineExibida.filter((r) => r.tipo_registro === 'abastecimento')
    const totalDespesas = despesas.reduce((sum, r) => sum + Number(r.valor || 0), 0)
    const totalAbastecimentos = abastecimentos.reduce((sum, r) => sum + Number(r.valor || 0), 0)
    const consumos = abastecimentos.map((r) => Number(r.consumo_km_l)).filter((v) => Number.isFinite(v) && v >= 0)
    const mediaConsumo = consumos.length ? consumos.reduce((a, b) => a + b, 0) / consumos.length : 0
    const kms = timelineExibida
      .filter((r) => !String(r.descricao || '').includes('Desconsiderar KM: sim'))
      .map((r) => Number(r.quilometragem))
      .filter((v) => Number.isFinite(v) && v > 0)
    const quilometragemMensal = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0
    const custoTotal = totalDespesas + totalAbastecimentos
    return { totalDespesas, totalAbastecimentos, mediaConsumo, quilometragemMensal, custoTotal }
  }, [timelineExibida])

  const editRecord = (item) => {
    const returnPath = encodeURIComponent(window.location.pathname)
    const returnFilter = encodeURIComponent(localStorage.getItem(`kartrack_timeline_filters_${vehicleId}`) || '')
    if (item.tipo_registro === 'fipe') return
    if (item.tipo_registro === 'abastecimento') return navigate(`/abastecimento?edit=${item.id}&return=${returnPath}&filters=${returnFilter}`)
    navigate(`/despesa?edit=${item.id}&return=${returnPath}&filters=${returnFilter}`)
  }

  const cloneRecord = (item) => {
    const returnPath = encodeURIComponent(window.location.pathname)
    const returnFilter = encodeURIComponent(localStorage.getItem(`kartrack_timeline_filters_${vehicleId}`) || '')
    if (item.tipo_registro === 'fipe') return
    if (item.tipo_registro === 'abastecimento') return navigate(`/abastecimento?clone=${item.id}&return=${returnPath}&filters=${returnFilter}`)
    navigate(`/despesa?clone=${item.id}&return=${returnPath}&filters=${returnFilter}`)
  }

  const viewRecord = async (item) => {
    if (item.tipo_registro === 'fipe') {
      setDetailModal({ item, data: { descricao: item.descricao, local: item.local, valor: item.valor } })
      return
    }
    const { data } = item.tipo_registro === 'abastecimento'
      ? await api.get(`/fuel/${item.id}`)
      : await api.get(`/expenses/${item.id}`)

    setDetailModal({ item, data })
  }

  const deleteRecord = async (item) => {
    if (item.tipo_registro === 'fipe') return
    if (!window.confirm('Deseja realmente excluir este registro?')) return
    if (item.tipo_registro === 'abastecimento') await api.delete(`/fuel/${item.id}`)
    else await api.delete(`/expenses/${item.id}`)
    await load()
  }

  const exportTimelinePdf = () => {
    const content = printAreaRef.current?.innerHTML
    if (!content) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>Timeline Kartrack</title></head><body>${content}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  if (!vehicleId) return <div className="alert alert-info">Cadastre um veículo em "Meu veículo".</div>
  if (!dashboard) return <div>Carregando...</div>

  return (
    <>
      <div className="timeline-header mb-3">
        <div className="d-flex gap-2 flex-wrap align-items-stretch">
          <div className="vehicle-chip vehicle-photo-card card">
            <div className="card-body p-2 d-flex align-items-center justify-content-center">
              {currentVehicle?.foto_url ? (
                <img src={currentVehicle.foto_url} alt={currentVehicle.nome} className="vehicle-thumb" />
              ) : (
                <div className="vehicle-thumb d-flex align-items-center justify-content-center"><i className="fa-solid fa-car" /></div>
              )}
            </div>
          </div>
          <div className="vehicle-chip vehicle-info-card card">
            <div className="card-body p-2">
              <div className="d-flex flex-column gap-1 vehicle-chip-info">
                <h6 className="mb-0">{currentVehicle?.nome || 'Não definido'}</h6>
                <small>{currentVehicle?.marca} {currentVehicle?.modelo} • {currentVehicle?.ano}</small>
                <small><strong>Placa:</strong> {currentVehicle?.placa || '-'}</small>
                <small><strong>Combustível:</strong> {currentVehicle?.combustivel_principal || '-'}</small>
                <small><strong>Km atual:</strong> {dashboard.quilometragem_atual} km</small>
                <small><strong>FIPE:</strong> {brl.format(Number(currentVehicle?.valor_fipe || 0))}</small>
              </div>
            </div>
          </div>
        </div>

        <div className="timeline-filters">
          <input
            className="form-control form-control-sm timeline-search-input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar"
            aria-label="Pesquisar registros da timeline"
          />
          <select className="form-select form-select-sm" value={periodMode} onChange={(e) => setPeriodMode(e.target.value)}>
            <option value="mes">Mês/ano</option>
            <option value="periodo">Período</option>
            <option value="historico">Histórico completo</option>
          </select>
          {periodMode === 'mes' && (
            <>
              <select className="form-select form-select-sm" value={month} onChange={(e) => setMonth(e.target.value)}>{Array.from({ length: 12 }).map((_, i) => { const m = String(i + 1).padStart(2, '0'); return <option key={m} value={m}>{m}</option> })}</select>
              <select className="form-select form-select-sm" value={year} onChange={(e) => setYear(e.target.value)}>{Array.from({ length: 8 }).map((_, i) => { const y = String(now.getFullYear() - i); return <option key={y} value={y}>{y}</option> })}</select>
            </>
          )}
          {periodMode === 'periodo' && (
            <>
              <input className="form-control form-control-sm" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <input className="form-control form-control-sm" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </>
          )}
          <select className="form-select form-select-sm" value={tipoFiltro} onChange={(e) => { setTipoFiltro(e.target.value); setPage(1) }}>
            <option value="todos">Todos os tipos</option>
            {[...new Set(timeline.map((i) => i.tipo_registro))].map((tipo) => <option key={tipo} value={tipo}>{formatTipoRegistro(tipo)}</option>)}
          </select>
          <select className="form-select form-select-sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
            <option value={10}>10 por página</option>
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
          </select>
          <button type="button" className="btn btn-sm btn-outline-dark" onClick={exportTimelinePdf}><i className="fa-solid fa-file-pdf me-1" />PDF</button>
        </div>
      </div>

      <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 row-cols-xxl-5 g-3 mb-4">
        <Card icon="fa-solid fa-sack-dollar" title="Despesas" value={brl.format(metricas.totalDespesas)} />
        <Card icon="fa-solid fa-gas-pump" title="Abastecimentos" value={brl.format(metricas.totalAbastecimentos)} />
        <Card icon="fa-solid fa-sack-dollar" title="Custo total" value={brl.format(metricas.custoTotal)} />
        <Card icon="fa-solid fa-gauge-high" title="Média de consumo" value={`${metricas.mediaConsumo.toFixed(2)} km/l`} />
        <Card icon="fa-solid fa-road" title="Km rodado" value={`${metricas.quilometragemMensal.toFixed(0)} km`} />
      </div>

      <div className="card mb-4"><div className="card-body"><h6><i className="fa-solid fa-bell me-2" />Lembretes de manutenção</h6>{dashboard.lembretes.length ? <ul className="list-unstyled mb-0">{dashboard.lembretes.map((raw) => {
        const [id, l] = String(raw).split('::')
        const days = Number((String(l).match(/faltam\s+(-?\d+)\s+dias/i) || [])[1])
        const kms = Number((String(l).match(/faltam\s+(-?\d+)\s+km/i) || [])[1])
        const isDanger = Number.isFinite(days) ? days <= 30 : Number.isFinite(kms) ? kms <= 1000 : false
        const isWarning = !isDanger && (Number.isFinite(days) ? days <= 60 : Number.isFinite(kms) ? kms <= 2000 : false)
        return <li key={raw} className={`${isDanger ? 'text-danger fw-semibold' : isWarning ? 'text-warning fw-semibold' : ''} d-flex align-items-center gap-2 py-1`}>
          <input type="checkbox" className="form-check-input mt-0" checked={selectedReminderIds.includes(id)} title="Marcar lembrete para exclusão" onChange={(e) => setSelectedReminderIds((prev) => e.target.checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id))} />
          {isDanger ? <i className="fa-solid fa-triangle-exclamation me-1" /> : null}
          <span>{l}</span>
        </li>
      })}</ul> : <p className="text-muted">Sem lembretes por enquanto.</p>}
        {!!selectedReminderIds.length && <div className="mt-2"><button type="button" className="btn btn-sm btn-outline-danger" onClick={async () => { for (const id of selectedReminderIds) await api.post(`/expenses/${id}/confirm-reminder`); setSelectedReminderIds([]); await load() }}><i className="fa-solid fa-check me-1" />Confirmar exclusão dos lembretes</button></div>}
      </div></div>

      <div className="card"><div className="card-body" ref={printAreaRef}><h6 className="timeline-title"><i className="fa-solid fa-list me-2" />Linha do tempo</h6>
        <small className="text-muted d-block mt-1">Exibindo {timelineExibida.length} de {timelineFiltrada.length} registro(s) no filtro atual.</small>
        <div className="d-flex flex-column gap-3 mt-3">
          {paginatedTimeline.map((item) => (
            <div className="timeline-item" key={`${item.tipo_registro}-${item.id}`}>
              <div className="timeline-top-row">
                <div className="timeline-main">
                  <strong><i className={`${getRecordIcon(item.tipo_registro)} me-2`} />{formatTipoRegistro(item.tipo_registro)}</strong>
                  {item.tipo_registro === 'abastecimento' && item.consumo_km_l !== null && item.consumo_km_l !== undefined ? (
                    <>
                      <span className="timeline-separator">|</span>
                      <span className="timeline-consumo"><i className="fa-solid fa-gauge-high me-1" />{item.consumo_km_l} km/l</span>
                    </>
                  ) : null}
                  <span className="timeline-separator">|</span>
                  <span className="timeline-valor">{brl.format(item.valor)}</span>
                </div>
                <div className="timeline-actions">
                  <button type="button" className="btn btn-sm btn-outline-dark" title="Visualizar" onClick={() => viewRecord(item)}><i className="fa-solid fa-eye" /></button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" title="Clonar" onClick={() => cloneRecord(item)}><i className="fa-solid fa-clone" /></button>
                  <button type="button" className="btn btn-sm btn-outline-primary" title="Editar" onClick={() => editRecord(item)}><i className="fa-solid fa-pen-to-square" /></button>
                  <button type="button" className="btn btn-sm btn-outline-danger" title="Excluir" onClick={() => deleteRecord(item)}><i className="fa-solid fa-trash" /></button>
                </div>
              </div>
              <small>{buildTimelineDescription(item)}</small>
              {!!buildHoverDetails(item).length && (
                <div className="timeline-hover-card">
                  {buildHoverDetails(item).map((detail, idx) => <div key={`${item.id}-${idx}`}>{detail}</div>)}
                </div>
              )}
            </div>
          ))}
          {!timelineExibida.length && <p className="text-muted mb-0">Nenhum registro encontrado para o filtro selecionado.</p>}
        </div>
        {!!timelineExibida.length && <div className="d-flex align-items-center justify-content-between mt-3">
          <small className="text-muted">Página {page} de {totalPages}</small>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</button>
          </div>
        </div>}
      </div></div>
      {detailModal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,.45)', zIndex: 9999 }}>
          <div className="card timeline-modal-card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <h5 className="mb-1"><i className={`${getRecordIcon(detailModal.item.tipo_registro)} me-2`} />{formatTipoRegistro(detailModal.item.tipo_registro)}</h5>
                  <small className="text-muted">ID #{detailModal.item.id}</small>
                </div>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDetailModal(null)}><i className="fa-solid fa-xmark" /></button>
              </div>
              <div className="timeline-modal-grid mt-3">
                {buildFieldRows(detailModal.data, detailModal.item).map(([label, value]) => (
                  <div key={label} className="timeline-modal-field">
                    <small className="text-muted d-block">{label}</small>
                    <div>{value}</div>
                  </div>
                ))}
              </div>
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setDetailModal(null)}>Cancelar</button>
                <button type="button" className="btn btn-primary" onClick={() => { setDetailModal(null); editRecord(detailModal.item) }}>Editar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Card({ icon, title, value }) {
  return <div className="col"><div className="card shadow-sm h-100"><div className="card-body"><h6><i className={`${icon} me-2`} />{title}</h6><h4>{value}</h4></div></div></div>
}
