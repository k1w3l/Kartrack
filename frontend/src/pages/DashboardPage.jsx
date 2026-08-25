import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import Modal from '../components/Modal'
import Icon, { recordIconName } from '../components/Icon'
import FilterSheet from '../components/FilterSheet'
import MetricCard from '../components/MetricCard'
import OverflowMenu from '../components/OverflowMenu'
import { Spinner, TimelineSkeleton } from '../components/Loading'
import { useUI } from '../components/UIProvider'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatDateBR(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pt-BR')
}

function timelineTone(tipo) {
  const t = String(tipo || '').toLowerCase()
  if (t.includes('abastecimento')) return 'is-fuel'
  if (t.includes('multa')) return 'is-danger'
  if (t.includes('manutenção')) return 'is-warn'
  return ''
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
  const { confirm } = useUI()
  const [dashboard, setDashboard] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)

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
  const [filtersHydrated, setFiltersHydrated] = useState(false)
  const [detailModal, setDetailModal] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const printAreaRef = useRef(null)

  const load = async () => {
    if (!vehicleId) return
    try {
      const [d, t] = await Promise.all([
        api.get('/dashboard', { params: { vehicle_id: vehicleId } }),
        api.get('/timeline', { params: { vehicle_id: vehicleId } }),
      ])
      setDashboard(d.data)
      setTimeline(Array.isArray(t.data) ? t.data.filter((item) => item.tipo_registro !== 'fipe') : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
  }, [vehicleId])

  useEffect(() => {
    if (!vehicleId) return
    load()
    const it = setInterval(() => {
      if (!document.hidden) load()
    }, 10000)
    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(it)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [vehicleId])

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
    const ok = await confirm({ title: 'Excluir registro', message: 'Deseja realmente excluir este registro?', confirmLabel: 'Excluir', danger: true })
    if (!ok) return
    if (item.tipo_registro === 'abastecimento') await api.delete(`/fuel/${item.id}`)
    else await api.delete(`/expenses/${item.id}`)
    await load()
  }

  const exportTimelinePdf = () => {
    setFilterOpen(false)
    const content = printAreaRef.current?.innerHTML
    if (!content) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Timeline Kartrack</title><style>
      body { font-family: Chivo, system-ui, sans-serif; color: #1a1814; margin: 24px; }
      .section-title { font-size: 16px; margin: 0 0 12px; font-weight: 700; }
      .timeline-item { border-bottom: 1px solid #d6cfc2; padding: 10px 0; }
      .timeline-overflow, .overflow-menu, .timeline-menu, .timeline-pager { display: none !important; }
      .timeline-hit { display: block !important; border: 0; background: transparent; padding: 0; text-align: left; color: inherit; }
      .muted { color: #6f675c; }
      .num, .timeline-valor { font-family: "Chivo Mono", monospace; }
    </style></head><body>${content}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 250)
  }

  const filterCount = Number(periodMode !== 'historico') + Number(Boolean(String(search).trim())) + Number(tipoFiltro !== 'todos')
  const filterSummary = joinFilled([
    periodMode === 'historico' ? 'Histórico' : periodMode === 'mes' ? `${month}/${year}` : (fromDate && toDate ? `${formatDateBR(fromDate)} – ${formatDateBR(toDate)}` : 'Período'),
    tipoFiltro === 'todos' ? 'Todos os tipos' : formatTipoRegistro(tipoFiltro),
    String(search).trim() ? `“${String(search).trim()}”` : '',
  ])

  if (!vehicleId) return <div className="alert alert-info">Cadastre um veículo em "Meu veículo".</div>
  if (loading && !dashboard) return <Spinner label="Carregando dados do veículo..." />

  const tipoOptions = [...new Set(timeline.map((i) => i.tipo_registro))]

  return (
    <div className="stack-lg">
      <div className="timeline-header">
        <div className="vehicle-strip">
          {currentVehicle?.foto_url ? (
            <img src={currentVehicle.foto_url} alt={currentVehicle.nome} />
          ) : (
            <div className="vehicle-thumb"><Icon name="car" size={28} /></div>
          )}
          <div className="vehicle-strip-meta">
            <h2>{currentVehicle?.nome || 'Não definido'}</h2>
            <p className="muted small">{currentVehicle?.marca} {currentVehicle?.modelo} • {currentVehicle?.ano}</p>
            <div className="vehicle-kpis">
              <span>Placa <strong className="plate">{currentVehicle?.placa || '-'}</strong></span>
              <span>Km <strong>{dashboard.quilometragem_atual}</strong></span>
              <span>FIPE <strong>{brl.format(Number(currentVehicle?.valor_fipe || 0))}</strong></span>
            </div>
          </div>
        </div>

        <div className="timeline-toolbar">
          <button
            type="button"
            className="btn btn-primary"
            aria-expanded={filterOpen}
            aria-haspopup="dialog"
            onClick={() => setFilterOpen(true)}
          >
            <Icon name="filter" size={16} />
            Filtrar
            {filterCount > 0 ? <span className="filter-count">{filterCount}</span> : null}
          </button>
          <p className="muted small timeline-toolbar-summary">{filterSummary}</p>
        </div>
      </div>

      <div className="metric-grid" role="list">
        <MetricCard icon="wallet" title="Despesas" value={brl.format(metricas.totalDespesas)} />
        <MetricCard icon="fuel" title="Abastecimentos" value={brl.format(metricas.totalAbastecimentos)} />
        <MetricCard icon="banknote" title="Custo total" value={brl.format(metricas.custoTotal)} />
        <MetricCard icon="gauge" title="Média de consumo" value={`${metricas.mediaConsumo.toFixed(2)} km/l`} />
        <MetricCard icon="route" title="Km rodado" value={`${metricas.quilometragemMensal.toFixed(0)} km`} />
      </div>

      <div className="card" ref={printAreaRef}>
        <h3 className="section-title"><Icon name="list" size={16} />Linha do tempo</h3>
        <p className="muted small">Exibindo {timelineExibida.length} de {timelineFiltrada.length} registro(s) no filtro atual.</p>
        {loading ? <TimelineSkeleton /> : (
          <div className="timeline-log">
            {paginatedTimeline.map((item, idx) => {
              const key = `${item.tipo_registro}-${item.id}`
              const kmLabel = item.quilometragem ? `${item.quilometragem} km` : ''
              return (
                <div className={`timeline-item ${timelineTone(item.tipo_registro)}`} key={key} style={{ animationDelay: `${Math.min(idx, 8) * 45}ms` }}>
                  <div className="timeline-rail" aria-hidden="true" />
                  <button type="button" className="timeline-hit" onClick={() => viewRecord(item)}>
                    <div className="timeline-main">
                      <strong className="cluster"><Icon name={recordIconName(item.tipo_registro)} size={16} />{formatTipoRegistro(item.tipo_registro)}</strong>
                      {kmLabel ? <span className="num">{kmLabel}</span> : null}
                      {item.tipo_registro === 'abastecimento' && item.consumo_km_l !== null && item.consumo_km_l !== undefined ? (
                        <span className="timeline-consumo">{item.consumo_km_l} km/l</span>
                      ) : null}
                      <span className="timeline-valor">{brl.format(item.valor)}</span>
                    </div>
                    <p className="muted small">{buildTimelineDescription(item)}</p>
                  </button>
                  <OverflowMenu
                    items={[
                      { label: 'Clonar', icon: 'copy', onClick: () => cloneRecord(item) },
                      { label: 'Editar', icon: 'squarePen', onClick: () => editRecord(item) },
                      { label: 'Excluir', icon: 'trash', danger: true, onClick: () => deleteRecord(item) },
                    ]}
                  />
                </div>
              )
            })}
            {!timelineExibida.length && <p className="muted">Nenhum registro encontrado para o filtro selecionado.</p>}
          </div>
        )}
        {!!timelineExibida.length && (
          <div className="cluster cluster-spread timeline-pager">
            <p className="muted small">Página {page} de {totalPages}</p>
            <div className="cluster">
              <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</button>
            </div>
          </div>
        )}
      </div>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        footer={<button type="button" className="btn btn-ghost" onClick={exportTimelinePdf}><Icon name="fileDown" size={16} />PDF</button>}
      >
        <label className="field">
          <span className="field-label">Pesquisar</span>
          <input
            className="input"
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Texto, posto, valor…"
          />
        </label>
        <label className="field">
          <span className="field-label">Período</span>
          <select className="select" value={periodMode} onChange={(e) => setPeriodMode(e.target.value)}>
            <option value="mes">Mês/ano</option>
            <option value="periodo">Período</option>
            <option value="historico">Histórico completo</option>
          </select>
        </label>
        {periodMode === 'mes' && (
          <div className="cluster">
            <label className="field grow">
              <span className="field-label">Mês</span>
              <select className="select" value={month} onChange={(e) => setMonth(e.target.value)}>{Array.from({ length: 12 }).map((_, i) => { const m = String(i + 1).padStart(2, '0'); return <option key={m} value={m}>{m}</option> })}</select>
            </label>
            <label className="field grow">
              <span className="field-label">Ano</span>
              <select className="select" value={year} onChange={(e) => setYear(e.target.value)}>{Array.from({ length: 8 }).map((_, i) => { const y = String(now.getFullYear() - i); return <option key={y} value={y}>{y}</option> })}</select>
            </label>
          </div>
        )}
        {periodMode === 'periodo' && (
          <div className="cluster">
            <label className="field grow">
              <span className="field-label">De</span>
              <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="field grow">
              <span className="field-label">Até</span>
              <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
          </div>
        )}
        <label className="field">
          <span className="field-label">Tipo</span>
          <select className="select" value={tipoFiltro} onChange={(e) => { setTipoFiltro(e.target.value); setPage(1) }}>
            <option value="todos">Todos os tipos</option>
            {tipoOptions.map((tipo) => <option key={tipo} value={tipo}>{formatTipoRegistro(tipo)}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Por página</span>
          <select className="select" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
      </FilterSheet>
      <Modal
        open={Boolean(detailModal)}
        onClose={() => setDetailModal(null)}
        width="min(760px, 94vw)"
        title={detailModal ? formatTipoRegistro(detailModal.item.tipo_registro) : ''}
        titleIcon={detailModal ? recordIconName(detailModal.item.tipo_registro) : ''}
        footer={detailModal && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDetailModal(null)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={() => { const item = detailModal.item; setDetailModal(null); editRecord(item) }}>Editar</button>
          </>
        )}
      >
        {detailModal && (
          <>
            <p className="muted small" style={{ marginBottom: 12 }}>ID #{detailModal.item.id}</p>
            <div className="timeline-modal-grid">
              {buildFieldRows(detailModal.data, detailModal.item).map(([label, value]) => (
                <div key={label} className="timeline-modal-field">
                  <p className="muted small">{label}</p>
                  <div>{value}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
