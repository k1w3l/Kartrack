import { useEffect, useMemo, useState } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import api from '../api'

ChartJS.register(BarElement, Tooltip, Legend, CategoryScale, LinearScale, LineElement, PointElement)

function parseDate(value) { return new Date(`${value}T00:00:00`) }

export default function ReportsPage({ vehicleId }) {
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

  const exportPdf = () => {
    const w = window.open('', '_blank')
    w.document.write(`<html><head><title>Relatórios Kartrack</title></head><body>${document.getElementById('reports-print-area')?.innerHTML || ''}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  if (!vehicleId) return <div className="alert alert-info">Cadastre um veículo para visualizar relatórios.</div>

  return (
    <div className="d-flex flex-column gap-3" id="reports-print-area">
      <div className="card card-body">
        <h5><i className="fa-solid fa-filter me-2" />Filtro de período</h5>
        <div className="d-flex flex-wrap gap-2 mt-2">
          <select className="form-select reports-period-select" value={periodMode} onChange={(e) => setPeriodMode(e.target.value)}>
            <option value="mes">Mês/ano</option><option value="periodo">Período</option><option value="historico">Histórico completo</option>
          </select>
          {periodMode === 'mes' && (<><select className="form-select" style={{ maxWidth: 140 }} value={month} onChange={(e) => setMonth(e.target.value)}>{Array.from({ length: 12 }).map((_, i) => { const m = String(i + 1).padStart(2, '0'); return <option key={m} value={m}>{m}</option> })}</select><select className="form-select" style={{ maxWidth: 140 }} value={year} onChange={(e) => setYear(e.target.value)}>{Array.from({ length: 8 }).map((_, i) => { const y = String(new Date().getFullYear() - i); return <option key={y} value={y}>{y}</option> })}</select></>)}
          {periodMode === 'periodo' && (<><input className="form-control" style={{ maxWidth: 180 }} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /><input className="form-control" style={{ maxWidth: 180 }} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></>)}
          <button type="button" className="btn btn-outline-dark ms-auto" onClick={exportPdf}><i className="fa-solid fa-file-pdf me-2" />Exportar PDF</button>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-xl-6"><div className="card card-body h-100"><h5><i className="fa-solid fa-gas-pump me-2" />Relatório de abastecimento</h5><ul className="mb-0"><li><strong>Melhor média:</strong> {fuelStats.melhorMedia.toFixed(2)} km/l</li><li><strong>Pior média:</strong> {fuelStats.piorMedia.toFixed(2)} km/l</li><li><strong>Melhor combustível (valor x média):</strong> {fuelStats.melhorCombustivel}</li></ul></div></div>
        <div className="col-xl-6"><div className="card card-body h-100"><h5><i className="fa-solid fa-receipt me-2" />Relatório de despesas por tipo</h5>{Object.keys(expenseByType).length ? <ul className="mb-0">{Object.entries(expenseByType).sort((a, b) => b[1] - a[1]).map(([tipo, total]) => <li key={tipo}><strong>{tipo}:</strong> R$ {Number(total || 0).toFixed(2)}</li>)}</ul> : <p className="text-muted mb-0">Não há despesas no período selecionado.</p>}</div></div>
      </div>

      {periodMode !== 'mes' && Object.keys(mediasPorMes).length > 1 && (
        <div className="card card-body">
          <h5><i className="fa-solid fa-chart-line me-2" />Médias por mês</h5>
          <Line data={{ labels: Object.keys(mediasPorMes), datasets: [{ label: 'Média km/l', data: Object.values(mediasPorMes), borderColor: '#2563eb', tension: 0.25 }] }} />
        </div>
      )}

      {periodMode === 'mes' && (
        <div className="card card-body">
          <h5><i className="fa-solid fa-chart-column me-2" />Abastecimentos do mês</h5>
          <Line data={{ labels: abastecimentosMes.labels, datasets: [{ label: 'Valor (R$)', data: abastecimentosMes.valor, borderColor: '#16a34a', tension: 0.25 }, { label: 'Média (km/l)', data: abastecimentosMes.media, borderColor: '#2563eb', tension: 0.25 }] }} />
        </div>
      )}

      {fipeVariacao.labels.length > 1 && (
        <div className="card card-body">
          <h5><i className="fa-solid fa-chart-line me-2" />Variação mensal da FIPE</h5>
          <Line data={{ labels: fipeVariacao.labels, datasets: [{ label: 'Variação mensal (R$)', data: fipeVariacao.valores, borderColor: '#f59e0b', tension: 0.25 }] }} />
        </div>
      )}

      <div className="card card-body"><h5><i className="fa-solid fa-scale-balanced me-2" />Comparativo</h5><Bar data={{ labels: ['Abastecimentos', 'Despesas'], datasets: [{ label: 'Total (R$)', data: [fuelRecordsWithoutFirst.reduce((s, i) => s + Number(i.valor || 0), 0), expenseRecords.filter((i) => i.tipo_registro !== 'fipe').reduce((s, i) => s + Number(i.valor || 0), 0)], backgroundColor: ['#2563eb', '#7c3aed'], borderRadius: 10 }] }} options={{ responsive: true, plugins: { legend: { display: false } } }} /></div>
    </div>
  )
}
