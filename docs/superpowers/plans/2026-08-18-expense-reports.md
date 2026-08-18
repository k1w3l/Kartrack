# Relatórios de despesa e TCO — Implementation Plan

> **For agentic workers:** execute inline in this session. User asked to apply immediately. Do not commit unless the user asks. Do not touch unrelated dirty files (`RecordsPage.jsx`, `components.css`).

**Goal:** Reorganizar `/relatorios` em abas com TCO/R$/km no padrão e breakdown de despesas, calculado no cliente.

**Architecture:** Funções puras em `reportMetrics.js` (testadas com `node --test`). `ReportsPage.jsx` orquestra filtro, abas, KPIs e gráficos Chart.js já usados. Sem mudança de API.

**Tech Stack:** React 18, Chart.js 4, Vite, Node test runner.

## Global Constraints

- Frontend only; reuse `metric-card`, tokens Kartrack, ícones Lucide.
- Depreciação FIPE on by default (`localStorage` `kartrack_reports_include_depreciation`).
- Portuguese UI copy; numbers via `Intl.NumberFormat('pt-BR')`.
- No new backend routes, models, or expense fields.
- Work on branch `visual/ux`. Do not revert unrelated local edits.

---

### Task 1: Métricas puras + testes

**Files:**
- Create: `frontend/src/lib/reportMetrics.js`
- Create: `frontend/src/lib/reportMetrics.test.js`
- Modify: `frontend/package.json`

**Produces:** `periodKm`, `sumFuel`, `sumExpenses`, `fipeSpan`, `buildTco`, `expensesByType`, `ticketMedioByType`, `rankingByLocal`, `topExpenses`, `fixedVariableTotals`, `costPerKmGroups`, `monthlyTcoSeries`, `monthlyExpensesStacked`, `periodBounds`.

- [ ] Write failing tests for km, TCO com/sem depreciação, valorização FIPE negativa, exclusão de fipe/KM inicial, R$/km sem km, top 5 com empate.
- [ ] Run `node --test src/lib/reportMetrics.test.js` from `frontend/` — FAIL (módulo ausente).
- [ ] Implement `reportMetrics.js` until tests pass.
- [ ] Add `"test": "node --test src/lib/reportMetrics.test.js"` to `package.json`.

### Task 2: Página Relatórios com abas

**Files:**
- Modify: `frontend/src/pages/ReportsPage.jsx`
- Modify: `frontend/src/styles/pages.css`

**Consumes:** Task 1 exports.

- [ ] Filtro + tabs + persistência localStorage + toast em falha de API.
- [ ] Aba Custo real: KPIs, interruptor, composição, fixo/variável, tabela R$/km, evolução mensal.
- [ ] Aba Despesas: barras por tipo, empilhado mensal, ranking, ticket, top 5.
- [ ] Abas Combustível e FIPE: conteúdo atual + início/fim/delta FIPE.
- [ ] PDF da área visível; estados vazios via `ChartEmptyState`.

### Task 3: Wiki

**Files:**
- Modify: `/mnt/NAS/Sync/Documentos/Pessoal/Wiki/wiki/wiki/kartrack-ui.md`
- Modify: `wiki/index.md` if a new page is added
- Modify: `wiki/log.md`
