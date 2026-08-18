import { useEffect, useMemo, useState } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import api from '../api'
import Icon from '../components/Icon'

ChartJS.register(BarElement, Tooltip, Legend, CategoryScale, LinearScale, LineElement, PointElement)

function parseDate(value) { return new Date(`${value}T00:00:00`) }

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
  }
}

function buildChartOptions(theme, extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: prefersReducedMotion ? false : { duration: 350 },
    plugins: {
      legend: { labels: { color: theme.text } },
      tooltip: { intersect: false, mode: 'index' },
      ...(extra.plugins || {}),
    },
    scales: {
      x: { ticks: { color: theme.text }, grid: { color: theme.grid } },
      y: { ticks: { color: theme.text }, grid: { color: theme.grid } },
      ...(extra.scales || {}),
    },
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

export default function ReportsPage({ vehicleId, darkMode }) {
  const [timeline, setTimeline] = useState([])
  const [fipeHistory, setFipeHistory] = useState([])
  const [periodMode, setPeriodMode] = useState('mes')
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    if (!vehicleId) return
    api.get('/timeline', { params: { vehicle_id: vehicleId } }).then(({ data }) => setTimeline(data))
    api.get('/fipe/history', { params: { vehicle_id: vehicleId } }).then(({ data }) => setFipeHistory(Array.isArray(data) ? data : [])).catch(() => setFipeHistory([]))
  }, [vehicleId])

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

  const expenseByType = useMemo(() => {
    const out = {}
    expenseRecords.filter((r) => r.tipo_registro !== 'fipe' && r.tipo_registro !== 'km inicial').forEach((r) => { out[r.tipo_registro] = (out[r.tipo_registro] || 0) + Number(r.valor || 0) })
    return out
  }, [expenseRecords])

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

  const exportPdf = () => {
    const content = document.getElementById('reports-print-area')?.innerHTML || ''
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Relatórios Kartrack</title><style>
      body { font-family: Chivo, system-ui, sans-serif; color: #0f172a; margin: 24px; }
      h4, h5, h6 { margin: 0 0 8px; }
      .card { border: 1px solid #dbe2ee; border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: none; }
      ul { margin: 0; padding-left: 18px; }
      canvas { max-width: 100%; height: auto !important; }
      button, .btn { display: none !important; }
    </style></head><body>${content}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 250)
  }

  if (!vehicleId) return <div className="alert alert-info">Cadastre um veículo para visualizar relatórios.</div>

  return (
    <div className="stack-lg" id="reports-print-area">
      <div className="card">
        <h2 className="section-title"><Icon name="filter" size={16} />Filtro de período</h2>
        <div className="cluster">
          <select className="select" value={periodMode} onChange={(e) => setPeriodMode(e.target.value)}>
            <option value="mes">Mês/ano</option><option value="periodo">Período</option><option value="historico">Histórico completo</option>
          </select>
          {periodMode === 'mes' && (<><select className="select" style={{ maxWidth: 140 }} value={month} onChange={(e) => setMonth(e.target.value)}>{Array.from({ length: 12 }).map((_, i) => { const m = String(i + 1).padStart(2, '0'); return <option key={m} value={m}>{m}</option> })}</select><select className="select" style={{ maxWidth: 140 }} value={year} onChange={(e) => setYear(e.target.value)}>{Array.from({ length: 8 }).map((_, i) => { const y = String(new Date().getFullYear() - i); return <option key={y} value={y}>{y}</option> })}</select></>)}
          {periodMode === 'periodo' && (<><input className="input" style={{ maxWidth: 180 }} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /><input className="input" style={{ maxWidth: 180 }} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></>)}
          <button type="button" className="btn btn-ghost" onClick={exportPdf}><Icon name="fileDown" size={16} />Exportar PDF</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card"><h2 className="section-title"><Icon name="fuel" size={16} />Relatório de abastecimento</h2><ul><li><strong>Melhor média:</strong> {fuelStats.melhorMedia.toFixed(2)} km/l</li><li><strong>Pior média:</strong> {fuelStats.piorMedia.toFixed(2)} km/l</li><li><strong>Melhor combustível (valor x média):</strong> {fuelStats.melhorCombustivel}</li></ul></div>
        <div className="card"><h2 className="section-title"><Icon name="receipt" size={16} />Relatório de despesas por tipo</h2>{Object.keys(expenseByType).length ? <ul>{Object.entries(expenseByType).sort((a, b) => b[1] - a[1]).map(([tipo, total]) => <li key={tipo}><strong>{tipo}:</strong> R$ {Number(total || 0).toFixed(2)}</li>)}</ul> : <p className="muted">Não há despesas no período selecionado.</p>}</div>
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

      {fipeVariacao.labels.length > 1 && (
        <div className="card">
          <h2 className="section-title"><Icon name="lineChart" size={16} />Variação mensal da FIPE</h2>
          <div className="chart-box">
            <Line data={{ labels: fipeVariacao.labels, datasets: [{ label: 'Variação mensal (R$)', data: fipeVariacao.valores, borderColor: theme.amber, backgroundColor: theme.amber, tension: 0.25 }] }} options={buildChartOptions(theme)} />
          </div>
        </div>
      )}

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
  )
}
