---
version: 1
slug: "frontend-src-pages-dashboardpage-jsx"
primary_target: "frontend/src/pages/DashboardPage.jsx"
related_targets: ["frontend/src/components/Layout.jsx","frontend/src/styles/shell.css","frontend/src/styles/pages.css"]
---

# Início — timeline no chrome de rodapé

**Mode:** Operate
**Target:** `/` (`frontend/src/pages/DashboardPage.jsx`) · related: `frontend/src/components/Layout.jsx`

## Audience and job
Dono do carro no telefone, landscape e tablet. Ver o período e o histórico sem a torre de filtros nem cinco ícones por linha.

## Action
Filtrar (sheet) → ler KPIs numa faixa → tocar o item para o detalhe → ⋯ para clonar/editar/excluir.

## Direction
Mundo **O Painel do Veículo**. Chrome com rodapé (sem rail, sem toggle) abaixo de 1200px. Desktop largo mantém rail + toggle. Faixa de 5 KPIs com ticks. Uma linha = tipo, km, valor. Controles extraídos: `FilterSheet`, `OverflowMenu`, `MetricCard`.

## Untouched
Copy, polling, lembretes, tema, seletor de veículo. Contas e payloads.
