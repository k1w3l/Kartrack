const EXCLUDED_TYPES = new Set(['fipe', 'km inicial'])
const FIXED_TYPES = new Set(['impostos', 'seguro', 'financiamento'])

function normalizeType(tipo) {
  return String(tipo || '').trim().toLowerCase()
}

function monthKey(value) {
  return String(value || '').slice(0, 7)
}

function isoDay(value) {
  return String(value || '').slice(0, 10)
}

function lastDayOfMonth(year, month) {
  const date = new Date(Number(year), Number(month), 0)
  return String(date.getDate()).padStart(2, '0')
}

export function periodBounds(periodMode, { month, year, fromDate, toDate } = {}) {
  if (periodMode === 'historico') return { start: null, end: null }
  if (periodMode === 'periodo') {
    if (!fromDate || !toDate) return { start: null, end: null }
    return { start: fromDate, end: toDate }
  }
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${lastDayOfMonth(year, month)}`,
  }
}

export function isFuel(tipo) {
  return normalizeType(tipo) === 'abastecimento'
}

export function isExcludedExpense(tipo) {
  return EXCLUDED_TYPES.has(normalizeType(tipo))
}

export function isFixedType(tipo) {
  return FIXED_TYPES.has(normalizeType(tipo))
}

export function fuelRecords(records) {
  return (records || []).filter((row) => isFuel(row.tipo_registro))
}

export function expenseRecords(records) {
  return (records || []).filter((row) => !isFuel(row.tipo_registro) && !isExcludedExpense(row.tipo_registro))
}

export function periodKm(records) {
  const kms = (records || [])
    .filter((row) => !String(row.descricao || '').includes('Desconsiderar KM: sim'))
    .map((row) => Number(row.quilometragem))
    .filter((value) => Number.isFinite(value) && value > 0)
  if (kms.length < 2) return 0
  return Math.max(...kms) - Math.min(...kms)
}

export function sumFuel(records) {
  return fuelRecords(records).reduce((sum, row) => sum + Number(row.valor || 0), 0)
}

export function sumExpenses(records) {
  return expenseRecords(records).reduce((sum, row) => sum + Number(row.valor || 0), 0)
}

function sortedFipe(fipeHistory) {
  return [...(fipeHistory || [])].sort((a, b) => isoDay(a.data).localeCompare(isoDay(b.data)))
}

function lastPointOnOrBefore(points, isoDate) {
  const target = isoDay(isoDate)
  let found = null
  for (const point of points) {
    if (isoDay(point.data) <= target) found = point
    else break
  }
  return found
}

export function fipeSpan(fipeHistory, start, end) {
  const points = sortedFipe(fipeHistory)
  if (points.length < 2) {
    return { startPoint: points[0] || null, endPoint: points[0] || null, depreciation: 0, insufficient: true }
  }

  const startPoint = start ? lastPointOnOrBefore(points, start) : points[0]
  const endPoint = end ? lastPointOnOrBefore(points, end) : points[points.length - 1]

  if (!startPoint || !endPoint || isoDay(startPoint.data) === isoDay(endPoint.data)) {
    return { startPoint: startPoint || null, endPoint: endPoint || null, depreciation: 0, insufficient: true }
  }

  return {
    startPoint,
    endPoint,
    depreciation: Number(startPoint.valor || 0) - Number(endPoint.valor || 0),
    insufficient: false,
  }
}

export function buildTco({ records, fipeHistory, includeDepreciation, periodStart, periodEnd }) {
  const km = periodKm(records)
  const fuel = sumFuel(records)
  const expenses = sumExpenses(records)
  const disbursement = fuel + expenses
  const span = fipeSpan(fipeHistory, periodStart, periodEnd)
  const depreciation = span.depreciation
  const realCost = includeDepreciation ? disbursement + depreciation : disbursement
  return {
    km,
    fuel,
    expenses,
    disbursement,
    depreciation,
    depreciationInsufficient: span.insufficient,
    fipeStart: span.startPoint,
    fipeEnd: span.endPoint,
    realCost,
    costPerKm: km > 0 ? realCost / km : null,
    includeDepreciation: Boolean(includeDepreciation),
  }
}

export function expensesByType(records) {
  const out = {}
  expenseRecords(records).forEach((row) => {
    const tipo = row.tipo_registro
    out[tipo] = (out[tipo] || 0) + Number(row.valor || 0)
  })
  return out
}

export function ticketMedioByType(records) {
  const acc = {}
  expenseRecords(records).forEach((row) => {
    const tipo = row.tipo_registro
    if (!acc[tipo]) acc[tipo] = { total: 0, count: 0 }
    acc[tipo].total += Number(row.valor || 0)
    acc[tipo].count += 1
  })
  return Object.entries(acc)
    .map(([tipo, value]) => ({
      tipo,
      total: value.total,
      count: value.count,
      ticket: value.count ? value.total / value.count : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export function rankingByLocal(records) {
  const out = {}
  expenseRecords(records).forEach((row) => {
    const local = String(row.local || '').trim() || 'Não informado'
    out[local] = (out[local] || 0) + Number(row.valor || 0)
  })
  return Object.entries(out)
    .map(([local, total]) => ({ local, total }))
    .sort((a, b) => b.total - a.total)
}

export function topExpenses(records, n = 5) {
  return [...expenseRecords(records)]
    .sort((a, b) => {
      const byValue = Number(b.valor || 0) - Number(a.valor || 0)
      if (byValue !== 0) return byValue
      return isoDay(b.data).localeCompare(isoDay(a.data))
    })
    .slice(0, n)
}

export function fixedVariableTotals(records, depreciation, includeDepreciation) {
  let fixed = 0
  let variable = sumFuel(records)
  expenseRecords(records).forEach((row) => {
    const value = Number(row.valor || 0)
    if (isFixedType(row.tipo_registro)) fixed += value
    else variable += value
  })
  if (includeDepreciation) fixed += Number(depreciation || 0)
  return { fixed, variable }
}

export function costPerKmGroups(records, km, depreciation, includeDepreciation) {
  const fuel = sumFuel(records)
  let maintenance = 0
  let fixed = 0
  let other = 0
  expenseRecords(records).forEach((row) => {
    const value = Number(row.valor || 0)
    const tipo = normalizeType(row.tipo_registro)
    if (tipo === 'manutenção') maintenance += value
    else if (isFixedType(row.tipo_registro)) fixed += value
    else other += value
  })
  const dep = includeDepreciation ? Number(depreciation || 0) : 0
  const perKm = (value) => (km > 0 ? value / km : null)
  const groups = [
    { label: 'Combustível', total: fuel, perKm: perKm(fuel) },
    { label: 'Manutenção', total: maintenance, perKm: perKm(maintenance) },
    { label: 'Fixos', total: fixed, perKm: perKm(fixed) },
    { label: 'Demais', total: other, perKm: perKm(other) },
  ]
  if (includeDepreciation) groups.push({ label: 'Depreciação', total: dep, perKm: perKm(dep) })
  return groups
}

export function monthlyTcoSeries(records, fipeHistory, includeDepreciation) {
  const months = new Set()
  ;(records || []).forEach((row) => {
    const key = monthKey(row.data)
    if (key) months.add(key)
  })
  ;(fipeHistory || []).forEach((point) => {
    const key = monthKey(point.data)
    if (key) months.add(key)
  })

  return [...months].sort().map((month) => {
    const [year, monthPart] = month.split('-')
    const bounds = periodBounds('mes', { year, month: monthPart })
    const monthRecords = (records || []).filter((row) => monthKey(row.data) === month)
    const fuel = sumFuel(monthRecords)
    const expenses = sumExpenses(monthRecords)
    const disbursement = fuel + expenses
    const span = fipeSpan(fipeHistory, bounds.start, bounds.end)
    const depreciation = span.insufficient ? 0 : span.depreciation
    return {
      month,
      fuel,
      expenses,
      disbursement,
      depreciation,
      realCost: includeDepreciation ? disbursement + depreciation : disbursement,
    }
  })
}

export function monthlyExpensesStacked(records) {
  const byMonth = {}
  const types = new Set()
  expenseRecords(records).forEach((row) => {
    const month = monthKey(row.data)
    const tipo = row.tipo_registro
    if (!month) return
    types.add(tipo)
    if (!byMonth[month]) byMonth[month] = {}
    byMonth[month][tipo] = (byMonth[month][tipo] || 0) + Number(row.valor || 0)
  })
  const months = Object.keys(byMonth).sort()
  return { months, types: [...types], byMonth }
}

export function formatMonthLabel(month) {
  const [year, monthPart] = String(month || '').split('-')
  if (!year || !monthPart) return String(month || '')
  return `${monthPart}/${year}`
}
