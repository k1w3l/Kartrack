# Relatórios de despesa e custo real (TCO)

**Date:** 2026-08-18  
**Status:** approved  
**Route:** `/relatorios`  
**Scope:** frontend only

## Problem

A página Relatórios é quase só combustível. De despesa existe uma lista de totais por tipo e um comparativo abastecimento vs despesas. Apps e referências de TCO (Drivvo, Fuelio, AAA Your Driving Costs, Edmunds, calculadoras BR) mostram custo real, R$/km, depreciação, fixo vs variável e breakdown operacional.

## Decisions

- Ênfase no custo real: TCO e R$/km no topo, breakdown operacional em seguida.
- Depreciação FIPE entra no TCO **por padrão**, com interruptor para ver só o desembolso.
- Mesma página, abas, cálculo no cliente a partir da timeline + `/fipe/history`. Sem endpoint novo, sem CSV, sem receitas, sem GPS, sem comparativo entre veículos.
- PDF exporta o filtro + a aba visível (fluxo de print atual).

## Page structure

1. Filtro de período (mês/ano, intervalo, histórico) + Exportar PDF — comum a todas as abas.
2. Abas (padrão **Custo real**): Custo real · Despesas · Combustível · FIPE.
3. Conteúdo da aba no recorte do filtro.

Persistência em `localStorage`:

- `kartrack_reports_tab` — `custo` | `despesas` | `combustivel` | `fipe`
- `kartrack_reports_include_depreciation` — `"1"` (padrão) | `"0"`

Filtro de período continua só na sessão.

## Tabs

### Custo real (default)

KPI strip (`metric-card`):

| Card | Conteúdo |
| --- | --- |
| Custo real | desembolso ± depreciação conforme interruptor |
| R$/km | custo real ÷ km; "—" se km = 0 |
| Km no período | max − min odômetro válido |
| Desembolso | combustível + despesas reais |
| Depreciação FIPE | início − fim no recorte; R$ 0,00 e nota se não houver série |

Interruptor **Incluir depreciação** ligado por padrão. Desligado: Custo real = Desembolso; o card de depreciação permanece como referência.

Também nesta aba:

- Composição: combustível · despesas · depreciação (depreciação some do gráfico se o interruptor estiver off).
- Fixo vs variável.
- Tabela R$/km por grupo: combustível, manutenção, fixos, demais, depreciação (esta última só com interruptor on).
- Evolução mensal do custo real **somente** em Período e Histórico.

### Despesas

Exclui `fipe` e `KM inicial`:

- Totais por tipo em barras horizontais.
- Evolução mensal empilhada por tipo **somente** em Período e Histórico.
- Ranking de locais/oficinas (`local`; vazio → "Não informado").
- Ticket médio por tipo (total ÷ quantidade).
- 5 maiores gastos (data, tipo, local, valor). Empate: data mais recente primeiro.

### Combustível

Relatórios atuais intactos: melhor/pior média, melhor combustível, médias por mês (fora do modo mês), abastecimentos do mês, comparativo abastecimento vs despesas. A exclusão do primeiro abastecimento do recorte **permanece só aqui** (estatística de consumo).

### FIPE

Gráfico de variação mensal atual (histórico completo) + início, fim e delta do recorte, alinhados ao card de depreciação.

## Calculation rules

Tudo em `frontend/src/lib/reportMetrics.js`. Tipos comparados em minúsculas.

**Km.** Ignora registros cuja descrição contém `Desconsiderar KM: sim`. Usa odômetros finitos > 0. Km = max − min. Menos de dois pontos → 0.

**Desembolso.** Soma de **todos** os abastecimentos do recorte (igual ao dashboard) + despesas reais. Fora: `fipe`, `KM inicial`.

**Depreciação FIPE.** Último ponto com data ≤ início do recorte vs último ponto com data ≤ fim. Depreciação = valor inicial − valor final. Queda é custo positivo; valorização é negativa (reduz o TCO). Menos de dois pontos distintos → 0 e `insufficient: true`.

Limites do recorte:

- Mês/ano: dia 1 … último dia do mês.
- Período: `fromDate` … `toDate`.
- Histórico: primeiro e último ponto FIPE disponíveis.

**Custo real.** Interruptor on: desembolso + depreciação. Off: só desembolso. R$/km = custo real ÷ km se km > 0; senão `null`.

**Fixo.** Impostos, Seguro, Financiamento. Depreciação entra em fixo só com interruptor on.

**Variável.** Combustível + Manutenção, Multa, Acessórios, Estacionamento, Estética, Pedágio (e qualquer outro tipo de despesa real que não seja fixo).

**Evolução mensal.** Agrupa por `YYYY-MM`. Em cada mês: desembolso daquele mês + depreciação FIPE daquele mês (mesma regra de limites, com o interruptor).

## Empty states and errors

Sem veículo: aviso atual. Sem dados: KPIs em R$ 0,00 / "—" e `ChartEmptyState`. Sem série FIPE: depreciação 0, TCO = desembolso, interruptor visível. Falha de timeline ou FIPE: toast de erro; a aba que depende daquele dado fica vazia.

## Out of scope

Receitas, percursos/GPS, frota, CSV, API de agregação, comparativo entre veículos, campos novos no cadastro.

## Files

- Create: `frontend/src/lib/reportMetrics.js`
- Create: `frontend/src/lib/reportMetrics.test.js`
- Modify: `frontend/src/pages/ReportsPage.jsx`
- Modify: `frontend/src/styles/pages.css`
- Modify: `frontend/package.json` (script `test`)
