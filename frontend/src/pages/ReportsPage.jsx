import { useEffect, useMemo, useState } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import api from '../api'
import Icon from '../components/Icon'
import MetricCard from '../components/MetricCard'
import { useUI } from '../components/UIProvider'
import {
  buildTco,
  costPerKmGroups,
  expensesByType,
  fipeSpan,
  fixedVariableTotals,
  formatMonthLabel,
  monthlyExpensesStacked,
  monthlyTcoSeries,
  periodBounds,
  rankingByLocal,
  ticketMedioByType,
  topExpenses,
} from '../lib/reportMetrics'

ChartJS.register(ArcElement, BarElement, Tooltip, Legend, CategoryScale, LinearScale, LineElement, PointElement)

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const TABS = [
  { id: 'custo', label: 'Custo real', icon: 'banknote' },
  { id: 'despesas', label: 'Despesas', icon: 'receipt' },
  { id: 'combustivel', label: 'Combustível', icon: 'fuel' },
  { id: 'fipe', label: 'FIPE', icon: 'tags' },
]
const TAB_IDS = new Set(TABS.map((tab) => tab.id))

function parseDate(value) { return new Date(`${value}T00:00:00`) }

function readStoredTab() {
  try {
    const value = localStorage.getItem('kartrack_reports_tab')
    return TAB_IDS.has(value) ? value : 'custo'
  } catch {
    return 'custo'
  }
}

function readStoredDepreciation() {
  try {
    const value = localStorage.getItem('kartrack_reports_include_depreciation')
    return value === null ? true : value !== '0'
  } catch {
    return true
  }
}

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false

function getChartTheme(darkMode) {
  return {
    text: darkMode ? '#e7e8ea' : '#0f172a',
    grid: darkMode ? 'rgba(160, 167, 178, 0.16)' : 'rgba(15, 23, 42, 0.08)',
    blue: darkMode ? '#9184d9' : '#796cbf',
    green: darkMode ? '#3ddc97' : '#1a8a58',
    amber: darkMode ? '#b5abfc' : '#796cbf',
    purple: darkMode ? '#9aa1ab' : '#5b6470',
    warning: darkMode ? '#e0a14a' : '#b56f08',
  }
}

function chartPalette(theme) {
  return [theme.blue, theme.green, theme.warning, theme.purple, theme.amber]
}

function buildChartOptions(theme, extra = {}) {
  const { plugins, scales, cartesian = true, ...rest } = extra
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: prefersReducedMotion ? false : { duration: 350 },
    plugins: {
      legend: { labels: { color: theme.text } },
      tooltip: { intersect: false, mode: 'index' },
      ...(plugins || {}),
    },
    ...(cartesian ? {
      scales: {
        x: { ticks: { color: theme.text }, grid: { color: theme.grid } },
        y: { ticks: { color: theme.text }, grid: { color: theme.grid } },
        ...(scales || {}),
      },
    } : {}),
    ...rest,
  }
}

function ChartEmptyState({ message }) {
  return (
    <div className="chart-empty" style={{ minHeight: 180 }}>
      <Icon name="chart" size={28} />
      <span>{message}</span>
    </div>
  )
}

function formatPerKm(value) {
  return value == null ? '—' : `${brl.format(value)}/km`
}

export default function ReportsPage({ vehicleId, darkMode }) {
  const { toast } = useUI()
  const [timeline, setTimeline] = useState([])
  const [fipeHistory, setFipeHistory] = useState([])
  const [periodMode, setPeriodMode] = useState('mes')
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [activeTab, setActiveTab] = useState(readStoredTab)
  const [includeDepreciation, setIncludeDepreciation] = useState(readStoredDepreciation)

  useEffect(() => {
    if (!vehicleId) return
    api.get('/timeline', { params: { vehicle_id: vehicleId } })
      .then(({ data }) => setTimeline(data))
      .catch(() => {
        setTimeline([])
        toast.error('Não foi possível carregar a timeline.')
      })
    api.get('/fipe/history', { params: { vehicle_id: vehicleId } })
      .then(({ data }) => setFipeHistory(Array.isArray(data) ? data : []))
      .catch(() => {
        setFipeHistory([])
        toast.error('Não foi possível carregar o histórico FIPE.')
      })
  }, [vehicleId, toast])

  useEffect(() => {
    try { localStorage.setItem('kartrack_reports_tab', activeTab) } catch {}
  }, [activeTab])

  useEffect(() => {
    try { localStorage.setItem('kartrack_reports_include_depreciation', includeDepreciation ? '1' : '0') } catch {}
  }, [includeDepreciation])

  const bounds = useMemo(() => {
    if (periodMode === 'historico') return { start: null, end: null }
    if (periodMode === 'periodo' && fromDate && toDate) return { start: fromDate, end: toDate }
    return periodBounds('mes', { month, year })
  }, [periodMode, month, year, fromDate, toDate])

  const filtered = useMemo(() => {
    const inMonth = (item) => {
      const d = parseDate(item.data)
      return String(d.getMonth() + 1).padStart(2, '0') === month && String(d.getFullYear()) === year
    }
    if (periodMode === 'historico') return timeline
    if (periodMode === 'periodo' && fromDate && toDate) {
      const from = parseDate(fromDate)
      const to = new Date(`${toDate}T23:59:59`)
      return timeline.filter((item) => {
        const d = parseDate(item.data)
        return d >= from && d <= to
      })
    }
    return timeline.filter(inMonth)
  }, [timeline, periodMode, month, year, fromDate, toDate])

  const fuelRecords = useMemo(() => filtered.filter((i) => i.tipo_registro === 'abastecimento'), [filtered])
  const fuelRecordsWithoutFirst = useMemo(() => {
    const ordered = [...fuelRecords].sort((a, b) => String(a.data).localeCompare(String(b.data)))
    return ordered.slice(1)
  }, [fuelRecords])
  const expenseRecords = useMemo(() => filtered.filter((i) => i.tipo_registro !== 'abastecimento'), [filtered])

  const tco = useMemo(() => buildTco({
    records: filtered,
    fipeHistory,
    includeDepreciation,
    periodStart: bounds.start,
    periodEnd: bounds.end,
  }), [filtered, fipeHistory, includeDepreciation, bounds])

  const split = useMemo(
    () => fixedVariableTotals(filtered, tco.depreciation, includeDepreciation),
    [filtered, tco.depreciation, includeDepreciation],
  )
  const perKmGroups = useMemo(
    () => costPerKmGroups(filtered, tco.km, tco.depreciation, includeDepreciation),
    [filtered, tco.km, tco.depreciation, includeDepreciation],
  )
  const monthlyTco = useMemo(
    () => monthlyTcoSeries(filtered, fipeHistory, includeDepreciation),
    [filtered, fipeHistory, includeDepreciation],
  )
  const byType = useMemo(() => expensesByType(filtered), [filtered])
  const tickets = useMemo(() => ticketMedioByType(filtered), [filtered])
  const ranking = useMemo(() => rankingByLocal(filtered), [filtered])
  const top = useMemo(() => topExpenses(filtered, 5), [filtered])
  const stacked = useMemo(() => monthlyExpensesStacked(filtered), [filtered])
  const fipePeriod = useMemo(() => fipeSpan(fipeHistory, bounds.start, bounds.end), [fipeHistory, bounds])

  const fuelStats = useMemo(() => {
    const consumos = fuelRecordsWithoutFirst.map((r) => Number(r.consumo_km_l)).filter((v) => Number.isFinite(v) && v >= 0)
    const melhorMedia = consumos.length ? Math.max(...consumos) : 0
    const piorMedia = consumos.length ? Math.min(...consumos) : 0
    const byFuel = {}
    fuelRecordsWithoutFirst.forEach((r) => {
      const tipo = String(r.descricao || '').trim() || 'Não informado'
      const consumo = Number(r.consumo_km_l || 0)
      const valor = Number(r.valor || 0)
      if (!byFuel[tipo]) byFuel[tipo] = { totalConsumo: 0, totalValor: 0, count: 0 }
      byFuel[tipo].totalConsumo += consumo
      byFuel[tipo].totalValor += valor
      byFuel[tipo].count += 1
    })
    let melhorCombustivel = '-'
    let melhorScore = -Infinity
    Object.entries(byFuel).forEach(([tipo, v]) => {
      const avgCons = v.count ? v.totalConsumo / v.count : 0
      const avgVal = v.count ? v.totalValor / v.count : 0
      const score = avgVal > 0 ? avgCons / avgVal : 0
      if (score > melhorScore) { melhorScore = score; melhorCombustivel = tipo }
    })
    return { melhorMedia, piorMedia, melhorCombustivel }
  }, [fuelRecordsWithoutFirst])

  const mediasPorMes = useMemo(() => {
    const byMonth = {}
    fuelRecords.forEach((r) => {
      const m = String(r.data || '').slice(0, 7)
      if (!byMonth[m]) byMonth[m] = { sum: 0, count: 0 }
      byMonth[m].sum += Number(r.consumo_km_l || 0)
      byMonth[m].count += 1
    })
    const result = Object.fromEntries(Object.entries(byMonth).map(([k, v]) => [k, v.count ? v.sum / v.count : 0]))
    const orderedMonths = Object.keys(result).sort()
    if (orderedMonths.length > 1) delete result[orderedMonths[0]]
    return result
  }, [fuelRecords])

  const abastecimentosMes = useMemo(() => {
    if (periodMode !== 'mes') return { labels: [], valor: [], media: [] }
    return {
      labels: fuelRecordsWithoutFirst.map((r) => `${String(r.data).slice(8, 10)}/${String(r.data).slice(5, 7)} • ${String(r.descricao || '').trim() || 'Comb.'}`),
      valor: fuelRecordsWithoutFirst.map((r) => Number(r.valor || 0)),
      media: fuelRecordsWithoutFirst.map((r) => Number(r.consumo_km_l || 0)),
    }
  }, [fuelRecordsWithoutFirst, periodMode])

  const fipeVariacao = useMemo(() => {
    const monthlyMap = {}
    ;[...fipeHistory].sort((a, b) => String(a.data).localeCompare(String(b.data))).forEach((p) => {
      const monthKey = String(p.data).slice(0, 7)
      monthlyMap[monthKey] = Number(p.valor || 0)
    })
    const points = Object.entries(monthlyMap).map(([month, valor]) => ({ month, valor }))
    const variation = points.map((point, index) => {
      if (index === 0) return 0
      return point.valor - points[index - 1].valor
    })
    return {
      labels: points.map((p) => p.month.split('-').reverse().join('/')),
      valores: variation,
    }
  }, [fipeHistory])

  const theme = getChartTheme(darkMode)
  const palette = chartPalette(theme)
  const showMonthly = periodMode !== 'mes'
  const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1])
  const compositionLabels = ['Combustível', 'Despesas']
  const compositionValues = [tco.fuel, tco.expenses]
  const compositionColors = [theme.green, theme.blue]
  if (includeDepreciation && tco.depreciation > 0) {
    compositionLabels.push('Depreciação')
    compositionValues.push(tco.depreciation)
    compositionColors.push(theme.warning)
  }
  const compositionHasData = compositionValues.some((value) => value > 0)

  const exportPdf = () => {
    const content = document.getElementById('reports-print-area')?.innerHTML || ''
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Relatórios Kartrack</title><style>
      body { font-family: Chivo, system-ui, sans-serif; color: #0f172a; margin: 24px; }
      h4, h5, h6, h2 { margin: 0 0 8px; }
      .card { border: 1px solid #dbe2ee; border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: none; }
      ul { margin: 0; padding-left: 18px; }
      canvas { max-width: 100%; height: auto !important; }
      button, .btn, .reports-tabs { display: none !important; }
    </style></head><body>${content}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 250)
  }

  if (!vehicleId) return <div className="alert alert-info">Cadastre um veículo para visualizar relatórios.</div>

  return (
    <div className="stack-lg" id="reports-print-area">
      <div className="card reports-toolbar">
        <label className="field">
          <span className="field-label">Período</span>
          <select className="select" value={periodMode} onChange={(e) => setPeriodMode(e.target.value)}>
            <option value="mes">Mês/ano</option>
            <option value="periodo">Período</option>
            <option value="historico">Histórico completo</option>
          </select>
        </label>
        {periodMode === 'mes' && (
          <>
            <label className="field">
              <span className="field-label">Mês</span>
              <select className="select" value={month} onChange={(e) => setMonth(e.target.value)}>
                {Array.from({ length: 12 }).map((_, i) => { const m = String(i + 1).padStart(2, '0'); return <option key={m} value={m}>{m}</option> })}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Ano</span>
              <select className="select" value={year} onChange={(e) => setYear(e.target.value)}>
                {Array.from({ length: 8 }).map((_, i) => { const y = String(new Date().getFullYear() - i); return <option key={y} value={y}>{y}</option> })}
              </select>
            </label>
          </>
        )}
        {periodMode === 'periodo' && (
          <>
            <label className="field">
              <span className="field-label">De</span>
              <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Até</span>
              <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
          </>
        )}
        <label className="check-row">
          <input type="checkbox" checked={includeDepreciation} onChange={(e) => setIncludeDepreciation(e.target.checked)} />
          Incluir depreciação
        </label>
        <button type="button" className="btn btn-ghost" onClick={exportPdf}><Icon name="fileDown" size={16} />PDF</button>
      </div>

      <div className="reports-tabs" role="tablist" aria-label="Tipos de relatório">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`reports-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} size={16} />{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'custo' && (
        <div className="stack-lg" role="tabpanel">
          <h2 className="section-title" style={{ margin: 0 }}><Icon name="banknote" size={16} />Custo real</h2>

          <div className="metric-grid">
            <MetricCard icon="banknote" title="Custo real" value={brl.format(tco.realCost)} />
            <MetricCard icon="route" title="R$/km" value={tco.costPerKm == null ? '—' : brl.format(tco.costPerKm)} hint={tco.km ? null : 'Sem km no período para calcular R$/km'} />
            <MetricCard icon="gauge" title="Km no período" value={`${Math.round(tco.km)} km`} />
            <MetricCard icon="wallet" title="Desembolso" value={brl.format(tco.disbursement)} />
            <MetricCard
              icon="tags"
              title="Depreciação FIPE"
              value={brl.format(tco.depreciation)}
              hint={tco.depreciationInsufficient ? 'Sem série FIPE no período' : null}
            />
          </div>

          <div className="grid-2">
            <div className="card">
              <h2 className="section-title"><Icon name="chart" size={16} />Composição do custo</h2>
              {compositionHasData ? (
                <div className="chart-box">
                  <Doughnut
                    data={{
                      labels: compositionLabels,
                      datasets: [{ data: compositionValues, backgroundColor: compositionColors, borderWidth: 0 }],
                    }}
                    options={buildChartOptions(theme, {
                      cartesian: false,
                      cutout: '62%',
                      plugins: { legend: { labels: { color: theme.text } }, tooltip: { intersect: false } },
                    })}
                  />
                </div>
              ) : <ChartEmptyState message="Sem dados no período selecionado." />}
              {includeDepreciation && tco.depreciation < 0 ? (
                <p className="muted small">Valorização FIPE reduz o custo real em {brl.format(Math.abs(tco.depreciation))}.</p>
              ) : null}
            </div>
            <div className="card">
              <h2 className="section-title"><Icon name="scale" size={16} />Fixo vs variável</h2>
              {split.fixed || split.variable ? (
                <div className="chart-box">
                  <Bar
                    data={{
                      labels: ['Fixo', 'Variável'],
                      datasets: [{ label: 'Total (R$)', data: [split.fixed, split.variable], backgroundColor: [theme.warning, theme.blue], borderRadius: 10 }],
                    }}
                    options={buildChartOptions(theme, { plugins: { legend: { display: false } } })}
                  />
                </div>
              ) : <ChartEmptyState message="Sem dados no período selecionado." />}
            </div>
          </div>

          <div className="card">
            <h2 className="section-title"><Icon name="calculator" size={16} />R$/km por grupo</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Grupo</th><th className="end">Total</th><th className="end">R$/km</th></tr>
                </thead>
                <tbody>
                  {perKmGroups.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className="end">{brl.format(row.total)}</td>
                      <td className="end">{formatPerKm(row.perKm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showMonthly && (
            <div className="card">
              <h2 className="section-title"><Icon name="lineChart" size={16} />Evolução mensal do custo real</h2>
              {monthlyTco.length > 1 ? (
                <div className="chart-box">
                  <Line
                    data={{
                      labels: monthlyTco.map((row) => formatMonthLabel(row.month)),
                      datasets: [{ label: 'Custo real (R$)', data: monthlyTco.map((row) => row.realCost), borderColor: theme.blue, backgroundColor: theme.blue, tension: 0.25 }],
                    }}
                    options={buildChartOptions(theme)}
                  />
                </div>
              ) : <ChartEmptyState message="Sem série mensal no período." />}
            </div>
          )}
        </div>
      )}

      {activeTab === 'despesas' && (
        <div className="stack-lg" role="tabpanel">
          <div className="card">
            <h2 className="section-title"><Icon name="barChart" size={16} />Despesas por tipo</h2>
            {typeEntries.length ? (
              <div className="chart-box" style={{ height: Math.max(220, typeEntries.length * 42) }}>
                <Bar
                  data={{
                    labels: typeEntries.map(([tipo]) => tipo),
                    datasets: [{ label: 'Total (R$)', data: typeEntries.map(([, total]) => total), backgroundColor: theme.blue, borderRadius: 8 }],
                  }}
                  options={buildChartOptions(theme, {
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { ticks: { color: theme.text }, grid: { color: theme.grid } },
                      y: { ticks: { color: theme.text }, grid: { color: theme.grid } },
                    },
                    indexAxis: 'y',
                  })}
                />
              </div>
            ) : <ChartEmptyState message="Não há despesas no período selecionado." />}
          </div>

          {showMonthly && (
            <div className="card">
              <h2 className="section-title"><Icon name="barChart" size={16} />Evolução mensal por tipo</h2>
              {stacked.months.length > 1 ? (
                <div className="chart-box">
                  <Bar
                    data={{
                      labels: stacked.months.map(formatMonthLabel),
                      datasets: stacked.types.map((tipo, index) => ({
                        label: tipo,
                        data: stacked.months.map((month) => stacked.byMonth[month][tipo] || 0),
                        backgroundColor: palette[index % palette.length],
                        stack: 'despesas',
                      })),
                    }}
                    options={buildChartOptions(theme, {
                      scales: {
                        x: { stacked: true, ticks: { color: theme.text }, grid: { color: theme.grid } },
                        y: { stacked: true, ticks: { color: theme.text }, grid: { color: theme.grid } },
                      },
                    })}
                  />
                </div>
              ) : <ChartEmptyState message="Sem série mensal no período." />}
            </div>
          )}

          <div className="grid-2">
            <div className="card">
              <h2 className="section-title"><Icon name="mapPin" size={16} />Ranking de locais</h2>
              {ranking.length ? (
                <ul className="report-rank">
                  {ranking.map((row) => (
                    <li key={row.local}><strong>{row.local}</strong> {brl.format(row.total)}</li>
                  ))}
                </ul>
              ) : <p className="muted">Não há despesas no período selecionado.</p>}
            </div>
            <div className="card">
              <h2 className="section-title"><Icon name="receipt" size={16} />Ticket médio por tipo</h2>
              {tickets.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Tipo</th><th className="end">Qtd</th><th className="end">Ticket</th></tr>
                    </thead>
                    <tbody>
                      {tickets.map((row) => (
                        <tr key={row.tipo}>
                          <td>{row.tipo}</td>
                          <td className="end">{row.count}</td>
                          <td className="end">{brl.format(row.ticket)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted">Não há despesas no período selecionado.</p>}
            </div>
          </div>

          <div className="card">
            <h2 className="section-title"><Icon name="listOrdered" size={16} />Maiores gastos</h2>
            {top.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Data</th><th>Tipo</th><th>Local</th><th className="end">Valor</th></tr>
                  </thead>
                  <tbody>
                    {top.map((row) => (
                      <tr key={`${row.tipo_registro}-${row.id}`}>
                        <td>{String(row.data).slice(0, 10).split('-').reverse().join('/')}</td>
                        <td>{row.tipo_registro}</td>
                        <td>{String(row.local || '').trim() || 'Não informado'}</td>
                        <td className="end">{brl.format(row.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="muted">Não há despesas no período selecionado.</p>}
          </div>
        </div>
      )}

      {activeTab === 'combustivel' && (
        <div className="stack-lg" role="tabpanel">
          <div className="grid-2">
            <div className="card"><h2 className="section-title"><Icon name="fuel" size={16} />Relatório de abastecimento</h2><ul><li><strong>Melhor média:</strong> {fuelStats.melhorMedia.toFixed(2)} km/l</li><li><strong>Pior média:</strong> {fuelStats.piorMedia.toFixed(2)} km/l</li><li><strong>Melhor combustível (valor x média):</strong> {fuelStats.melhorCombustivel}</li></ul></div>
            <div className="card">
              <h2 className="section-title"><Icon name="scale" size={16} />Comparativo</h2>
              {fuelRecordsWithoutFirst.length || expenseRecords.length ? (
                <div className="chart-box">
                  <Bar
                    data={{ labels: ['Abastecimentos', 'Despesas'], datasets: [{ label: 'Total (R$)', data: [fuelRecordsWithoutFirst.reduce((s, i) => s + Number(i.valor || 0), 0), expenseRecords.filter((i) => i.tipo_registro !== 'fipe').reduce((s, i) => s + Number(i.valor || 0), 0)], backgroundColor: [theme.blue, theme.purple], borderRadius: 10 }] }}
                    options={buildChartOptions(theme, { plugins: { legend: { display: false } } })}
                  />
                </div>
              ) : <ChartEmptyState message="Sem dados no período selecionado." />}
            </div>
          </div>

          {periodMode !== 'mes' && (
            <div className="card">
              <h2 className="section-title"><Icon name="lineChart" size={16} />Médias por mês</h2>
              {Object.keys(mediasPorMes).length > 1 ? (
                <div className="chart-box">
                  <Line data={{ labels: Object.keys(mediasPorMes), datasets: [{ label: 'Média km/l', data: Object.values(mediasPorMes), borderColor: theme.blue, backgroundColor: theme.blue, tension: 0.25 }] }} options={buildChartOptions(theme)} />
                </div>
              ) : <ChartEmptyState message="Sem dados suficientes de consumo no período." />}
            </div>
          )}

          {periodMode === 'mes' && (
            <div className="card">
              <h2 className="section-title"><Icon name="barChart" size={16} />Abastecimentos do mês</h2>
              {abastecimentosMes.labels.length ? (
                <div className="chart-box">
                  <Line data={{ labels: abastecimentosMes.labels, datasets: [{ label: 'Valor (R$)', data: abastecimentosMes.valor, borderColor: theme.green, backgroundColor: theme.green, tension: 0.25 }, { label: 'Média (km/l)', data: abastecimentosMes.media, borderColor: theme.blue, backgroundColor: theme.blue, tension: 0.25 }] }} options={buildChartOptions(theme)} />
                </div>
              ) : <ChartEmptyState message="Sem abastecimentos no mês selecionado." />}
            </div>
          )}
        </div>
      )}

      {activeTab === 'fipe' && (
        <div className="stack-lg" role="tabpanel">
          <div className="metric-grid">
            <MetricCard icon="tags" title="FIPE início" value={fipePeriod.startPoint ? brl.format(fipePeriod.startPoint.valor) : '—'} />
            <MetricCard icon="tags" title="FIPE fim" value={fipePeriod.endPoint ? brl.format(fipePeriod.endPoint.valor) : '—'} />
            <MetricCard
              icon="lineChart"
              title="Delta do recorte"
              value={brl.format(fipePeriod.depreciation)}
              hint={fipePeriod.insufficient ? 'Sem série FIPE no período' : 'Queda de valor é custo positivo'}
            />
          </div>
          {fipeVariacao.labels.length > 1 ? (
            <div className="card">
              <h2 className="section-title"><Icon name="lineChart" size={16} />Variação mensal da FIPE</h2>
              <div className="chart-box">
                <Line data={{ labels: fipeVariacao.labels, datasets: [{ label: 'Variação mensal (R$)', data: fipeVariacao.valores, borderColor: theme.amber, backgroundColor: theme.amber, tension: 0.25 }] }} options={buildChartOptions(theme)} />
              </div>
            </div>
          ) : <ChartEmptyState message="Sem histórico FIPE suficiente." />}
        </div>
      )}
    </div>
  )
}
