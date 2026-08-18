import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  periodBounds,
  periodKm,
  sumFuel,
  sumExpenses,
  fipeSpan,
  buildTco,
  expensesByType,
  ticketMedioByType,
  rankingByLocal,
  topExpenses,
  fixedVariableTotals,
  costPerKmGroups,
  monthlyTcoSeries,
} from './reportMetrics.js'

const rec = (partial) => ({
  id: partial.id ?? 1,
  tipo_registro: 'Manutenção',
  data: '2026-08-10',
  quilometragem: 10000,
  valor: 100,
  descricao: '',
  local: '',
  ...partial,
})

describe('periodBounds', () => {
  it('returns first and last day of the selected month', () => {
    assert.deepEqual(periodBounds('mes', { month: '08', year: '2026' }), {
      start: '2026-08-01',
      end: '2026-08-31',
    })
  })

  it('returns null bounds for full history', () => {
    assert.deepEqual(periodBounds('historico', {}), { start: null, end: null })
  })
})

describe('periodKm', () => {
  it('uses max minus min odometer and ignores Desconsiderar KM', () => {
    const km = periodKm([
      rec({ quilometragem: 10000 }),
      rec({ quilometragem: 12000, descricao: 'Desconsiderar KM: sim' }),
      rec({ quilometragem: 11500, id: 2 }),
    ])
    assert.equal(km, 1500)
  })

  it('returns 0 when fewer than two valid odometer points exist', () => {
    assert.equal(periodKm([rec({ quilometragem: 10000 })]), 0)
  })
})

describe('sums', () => {
  it('sums all fuel fill-ups in the slice', () => {
    const records = [
      rec({ tipo_registro: 'abastecimento', valor: 200, id: 1 }),
      rec({ tipo_registro: 'abastecimento', valor: 180, id: 2, data: '2026-08-20' }),
    ]
    assert.equal(sumFuel(records), 380)
  })

  it('excludes fipe and KM inicial from expenses', () => {
    const records = [
      rec({ tipo_registro: 'Manutenção', valor: 400 }),
      rec({ tipo_registro: 'fipe', valor: 90000 }),
      rec({ tipo_registro: 'KM inicial', valor: 0 }),
      rec({ tipo_registro: 'abastecimento', valor: 200 }),
    ]
    assert.equal(sumExpenses(records), 400)
  })
})

describe('fipeSpan', () => {
  const history = [
    { data: '2026-06-02', valor: 80000 },
    { data: '2026-07-02', valor: 79000 },
    { data: '2026-08-04', valor: 77000 },
  ]

  it('uses last point on or before start vs last point on or before end', () => {
    const span = fipeSpan(history, '2026-08-01', '2026-08-31')
    assert.equal(span.insufficient, false)
    assert.equal(span.depreciation, 2000)
    assert.equal(span.startPoint.valor, 79000)
    assert.equal(span.endPoint.valor, 77000)
  })

  it('treats FIPE appreciation as negative cost', () => {
    const span = fipeSpan(
      [
        { data: '2026-07-02', valor: 70000 },
        { data: '2026-08-04', valor: 72000 },
      ],
      '2026-08-01',
      '2026-08-31',
    )
    assert.equal(span.depreciation, -2000)
  })

  it('is insufficient with a single FIPE point', () => {
    const span = fipeSpan([{ data: '2026-08-04', valor: 77000 }], '2026-08-01', '2026-08-31')
    assert.equal(span.insufficient, true)
    assert.equal(span.depreciation, 0)
  })
})

describe('buildTco', () => {
  const records = [
    rec({ tipo_registro: 'abastecimento', valor: 300, quilometragem: 10000, id: 1 }),
    rec({ tipo_registro: 'Manutenção', valor: 700, quilometragem: 11000, id: 2 }),
    rec({ tipo_registro: 'Impostos', valor: 500, quilometragem: 11000, id: 3 }),
  ]
  const fipeHistory = [
    { data: '2026-07-02', valor: 50000 },
    { data: '2026-08-04', valor: 48000 },
  ]

  it('adds depreciation to real cost when enabled', () => {
    const tco = buildTco({
      records,
      fipeHistory,
      includeDepreciation: true,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    })
    assert.equal(tco.disbursement, 1500)
    assert.equal(tco.depreciation, 2000)
    assert.equal(tco.realCost, 3500)
    assert.equal(tco.km, 1000)
    assert.equal(tco.costPerKm, 3.5)
  })

  it('uses only disbursement when depreciation is off', () => {
    const tco = buildTco({
      records,
      fipeHistory,
      includeDepreciation: false,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    })
    assert.equal(tco.realCost, 1500)
    assert.equal(tco.costPerKm, 1.5)
  })

  it('returns null cost per km when km is zero', () => {
    const tco = buildTco({
      records: [rec({ tipo_registro: 'Manutenção', valor: 100, quilometragem: 5000 })],
      fipeHistory: [],
      includeDepreciation: true,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    })
    assert.equal(tco.costPerKm, null)
    assert.equal(tco.km, 0)
  })
})

describe('expense breakdowns', () => {
  const records = [
    rec({ id: 1, tipo_registro: 'Manutenção', valor: 400, local: 'Oficina A', data: '2026-08-01' }),
    rec({ id: 2, tipo_registro: 'Manutenção', valor: 200, local: 'Oficina A', data: '2026-08-10' }),
    rec({ id: 3, tipo_registro: 'Multa', valor: 400, local: '', data: '2026-08-12' }),
    rec({ id: 4, tipo_registro: 'Pedágio', valor: 50, local: 'Sem parar', data: '2026-08-20' }),
    rec({ id: 5, tipo_registro: 'fipe', valor: 80000, data: '2026-08-04' }),
  ]

  it('groups expenses by type excluding fipe', () => {
    const byType = expensesByType(records)
    assert.equal(byType.Manutenção, 600)
    assert.equal(byType.Multa, 400)
    assert.equal(byType.fipe, undefined)
  })

  it('computes average ticket by type', () => {
    const tickets = ticketMedioByType(records)
    const manut = tickets.find((row) => row.tipo === 'Manutenção')
    assert.equal(manut.count, 2)
    assert.equal(manut.ticket, 300)
  })

  it('ranks locations and labels empty local', () => {
    const ranking = rankingByLocal(records)
    assert.equal(ranking[0].local, 'Oficina A')
    assert.equal(ranking[0].total, 600)
    const unnamed = ranking.find((row) => row.local === 'Não informado')
    assert.equal(unnamed.total, 400)
  })

  it('returns top expenses by value then newest date', () => {
    const top = topExpenses(records, 3)
    assert.equal(top[0].id, 3)
    assert.equal(top[1].id, 1)
    assert.equal(top[2].id, 2)
  })
})

describe('fixed vs variable and cost per km groups', () => {
  const records = [
    rec({ tipo_registro: 'abastecimento', valor: 200, quilometragem: 10000, id: 1 }),
    rec({ tipo_registro: 'Manutenção', valor: 300, quilometragem: 12000, id: 2 }),
    rec({ tipo_registro: 'Seguro', valor: 100, quilometragem: 12000, id: 3 }),
    rec({ tipo_registro: 'Pedágio', valor: 40, quilometragem: 12000, id: 4 }),
  ]

  it('classifies fuel as variable and insurance as fixed', () => {
    const split = fixedVariableTotals(records, 500, true)
    assert.equal(split.fixed, 600)
    assert.equal(split.variable, 540)
  })

  it('omits depreciation from fixed when toggle is off', () => {
    const split = fixedVariableTotals(records, 500, false)
    assert.equal(split.fixed, 100)
  })

  it('breaks cost per km into groups', () => {
    const groups = costPerKmGroups(records, 2000, 500, true)
    const fuel = groups.find((row) => row.label === 'Combustível')
    const dep = groups.find((row) => row.label === 'Depreciação')
    assert.equal(fuel.perKm, 0.1)
    assert.equal(dep.total, 500)
  })
})

describe('monthlyTcoSeries', () => {
  it('builds one point per month with optional depreciation', () => {
    const records = [
      rec({ tipo_registro: 'abastecimento', valor: 100, data: '2026-07-10', quilometragem: 10000 }),
      rec({ tipo_registro: 'Manutenção', valor: 200, data: '2026-08-10', quilometragem: 11000 }),
    ]
    const fipeHistory = [
      { data: '2026-06-02', valor: 60000 },
      { data: '2026-07-02', valor: 59000 },
      { data: '2026-08-04', valor: 58000 },
    ]
    const series = monthlyTcoSeries(records, fipeHistory, true)
    const august = series.find((row) => row.month === '2026-08')
    assert.equal(august.disbursement, 200)
    assert.equal(august.depreciation, 1000)
    assert.equal(august.realCost, 1200)
  })
})
