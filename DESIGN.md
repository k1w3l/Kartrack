---
name: Kartrack
description: Painel do veículo — livro-razão self-host, dark-first, acento Perfil.
colors:
  perfil-violet: "#9184d9"
  perfil-violet-light: "#796cbf"
  production-gray: "#16181c"
  console-plate: "#202329"
  console-plate-2: "#26292f"
  aluminum: "#e7e8ea"
  muted-steel: "#9aa1ab"
  seam: "#353941"
  on-accent: "#16181c"
  ok: "#3ddc97"
  danger: "#e24b4a"
  warning-amber: "#e0a14a"
typography:
  display:
    fontFamily: "Chivo Mono, ui-monospace, monospace"
    fontSize: "clamp(1.35rem, 2.4vw, 1.85rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Chivo, system-ui, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Chivo, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Chivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Chivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
components:
  button-default:
    backgroundColor: "{colors.console-plate-2}"
    textColor: "{colors.aluminum}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  button-default-hover:
    backgroundColor: "{colors.console-plate-2}"
    textColor: "{colors.aluminum}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  button-primary:
    backgroundColor: "{colors.perfil-violet}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.perfil-violet}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.aluminum}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  button-danger:
    backgroundColor: "rgba(226, 75, 74, 0.16)"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  card:
    backgroundColor: "{colors.console-plate}"
    textColor: "{colors.aluminum}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.production-gray}"
    textColor: "{colors.aluminum}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "44px"
  chip:
    backgroundColor: "{colors.console-plate-2}"
    textColor: "{colors.aluminum}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
  nav-rail-active:
    backgroundColor: "rgba(145, 132, 217, 0.16)"
    textColor: "{colors.perfil-violet}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  metric-card:
    backgroundColor: "{colors.console-plate}"
    textColor: "{colors.aluminum}"
    rounded: "{rounded.lg}"
    padding: "16px 12px"
---

# Design System: Kartrack

## Overview

**Creative North Star: "O Painel do Veículo"**

Kartrack parece um cluster de instrumentos, não um dashboard SaaS. Superfícies no cinza de produção; o violeta Perfil aparece só onde o sistema aponta — ação primária, rota ativa, faixa do KPI, glow de foco. A densidade é operacional: o olho cai no número, depois no rótulo, depois no chrome.

O tema padrão é escuro (`color-scheme: dark`). Claro existe como remap dos mesmos papéis, não como identidade paralela. Anti-referência confirmada: dashboard SaaS colorido, Bootstrap, card com sombra de marketing, app de posto, fintech pastel, tipografia display, ilustração, gradiente de hero.

**Key Characteristics:**
- Dark-first; violeta Perfil raro e funcional
- Chivo no UI, Chivo Mono em dinheiro / km / L / placa
- Placas tonais com costura 1px; sombra só em overlay
- Assinatura: KPI com trilho de ticks + faixa esquerda; timeline com trilho de tipo
- Alvo 44px; raio 10px em controle, 14px em placa

## Colors

Paleta de um acento só: cinza de produção como matéria, violeta Perfil como ponteiro.

### Primary
- **Violeta Perfil** (`perfil-violet`): ação primária, link, rail ativo, faixa do KPI, anel de foco. No tema claro o mesmo papel usa `perfil-violet-light`. Raridade é o ponto.

### Neutral
- **Cinza de produção** (`production-gray`): fundo da cabine; também o texto sobre o acento no escuro (`on-accent`).
- **Placa do console** (`console-plate`): header, card, toast, sheet.
- **Placa-2** (`console-plate-2`): botão default, campo interno, chip, hover de lista.
- **Alumínio claro** (`aluminum`): texto principal.
- **Aço mudo** (`muted-steel`): rótulo, meta, grupo do rail.
- **Costura** (`seam`): borda 1px entre placas.

### Semantic (not a second brand)
- **Ok** (`ok`): abastecimento, sucesso, trilho de fuel na timeline.
- **Perigo** (`danger`): lembrete vermelho, exclusão, erro.
- **Âmbar de aviso** (`warning-amber`): lembrete em aviso; nunca substitui o acento Perfil.

**The Perfil Rule.** O violeta é ponteiro, não tinta. Cabe em ≤10% da tela. Fundo, placa e texto continuam cinza. Glow (`accent-glow`) e ticks (`tick`) são o violeta diluído — não um segundo accent.

**The Semantic-Is-Not-Brand Rule.** Verde, vermelho e âmbar narram estado. Não recolorir o chrome com eles.

## Typography

**Display Font:** Chivo Mono (ui-monospace)
**Body Font:** Chivo (system-ui, sans-serif)
**Label/Mono Font:** Chivo Mono para qualquer valor que se compara

**Character:** Grotesca tensa no UI; mono tabular no cluster. Sem display serif, sem uppercase de marketing fora do rótulo do KPI.

### Hierarchy
- **Display** (700, `clamp(1.35rem, 2.4vw, 1.85rem)`, Chivo Mono): valor do KPI. Único “grande” do sistema.
- **Headline** (600, 1.35rem): título de página (`.page-title`).
- **Title** (600, 1.125rem): nome do veículo na faixa, subtítulos.
- **Body** (400, 1rem, line-height 1.5): copy operacional. Títulos de seção usam o mesmo tamanho a 600.
- **Label** (600, 0.875rem, muted): label de campo. KPI label: 0.72rem, tracking 0.1em, uppercase.

**The Tabular Rule.** Dinheiro, km, L, média, placa: Chivo Mono + `tabular-nums`. Placa ainda leva tracking ~0.08em e peso 700. UI copy nunca vai em mono.

## Layout

App shell em grid: header 56px de ponta a ponta; rail 232px (colapsado 72px) + main. Abaixo de 1200px o rail some, entra bottom nav 64px + safe-area, e o Mais abre sheet. Conteúdo com padding 16px; ações de formulário grudam acima da bottom nav no telefone.

Listas (Início, Registros, veículos, usuários): toque na linha = ação principal; ⋯ para o resto. Filtros e recortes extra em sheet **Filtrar** + faixa de KPI. Formulários: essenciais na página, cadastro novo no **+** do dropdown, não em link. Relatórios: período compacto no topo com PDF e depreciação; abas iguais.

Ritmo 4/8: 4, 8, 12, 16, 24, 32. Grids de conteúdo 1 col → 2 em 768px; métricas 1 → 2 (640px) → 5 (1100px). Fundo do shell: radial do acento a 7% no canto, depois cinza de produção — não um hero.

**The Shell Rule.** Header, rail e bottom nav são o chassis. Página nova preenche o main; não inventa segundo chrome.

## Elevation & Depth

Híbrido de instrumento: placas planas em repouso (tonalidade + costura). Sombra estrutural só quando algo sai do plano (modal, toast, overlay). Glow e ticks são profundidade de *estado*, não de marketing.

### Shadow Vocabulary
- **Overlay** (`0 12px 32px rgba(0, 0, 0, 0.32)` no escuro; `0 10px 28px rgba(15, 23, 42, 0.1)` no claro): toast e modal.
- **Focus glow** (`0 0 0 3px` no glow do acento): foco de campo e hover do primário.
- **Active rail** (`0 0 0 1px` no glow): item de navegação corrente.
- **Instrument tick / rail** (repeating 2px/5px no KPI; `0 0 10px` no pino da timeline): assinatura do cluster.

**The Cluster Glow Rule.** Card em repouso não tem drop shadow. Glow aparece em foco, ativo e no trilho de instrumento. Overlay é o único lugar da sombra grande.

## Shapes

Cantos de ferramenta, não de consumer app: 6px no miúdo, 10px em botão/campo/rail, 14px em card/faixa/sheet. Pills (999px) só em chip e badge. Costura 1px `seam` em volta da placa; primário troca a costura pelo preenchimento Perfil. Sheet mobile arredonda só o topo (14px 14px 0 0).

**The Plate Rule.** Controle = 10px. Superfície = 14px. Não misturar raio de card em botão, nem pill em formulário.

## Components

Refinado e contido: 44px de alvo, primário sólido Perfil, ghost sem fundo, press em scale 0.97. O teatro fica no KPI e na timeline.

### Buttons
- **Shape:** cantos de controle (10px); min-height 44px (36px no `sm`); ícone-só 44×44.
- **Default:** placa-2, costura, texto alumínio; hover aquece a borda com 45% de Perfil.
- **Primary:** preenchimento Perfil, texto `on-accent`, peso 700; hover ganha anel de glow 3px — único bloco de violeta da tela.
- **Ghost:** fundo transparente, mesma caixa.
- **Danger / Ok / Accent:** fundo dim + borda misturada; cor semântica no texto. Não usar ok/danger como primário de navegação.
- **Hover / Focus / Active:** foco visível 2px Perfil offset 2px no resto da UI; primário prefere o glow. Active: scale 0.97 (0.9 no ícone).

### Chips
- **Style:** pill, placa-2, costura, 4×8, texto sm. Badge é a versão uppercase 0.72rem / 700.
- **State:** `badge-accent` usa dim + texto Perfil. Lookups de cadastro não voltam a virar chip — ficam em dropdown.

### Cards / Containers
- **Corner Style:** 14px
- **Background:** placa do console; faixa do veículo mistura um fade de `accent-dim` da esquerda.
- **Shadow Strategy:** nenhuma em repouso (Elevation).
- **Border:** 1px costura
- **Internal Padding:** 16px (flush existe para tabelas)

### Inputs / Fields
- **Style:** 44px, 10px, costura, fundo misturado placa/bg, label sm 600 muted acima (6px de fresta).
- **Focus:** borda Perfil + glow 3px; outline do input some.
- **Error / Disabled:** alerta perigo para mensagem; disabled em 0.45. Checkbox 18px com `accent-color` Perfil.

### Navigation
- **Desktop:** rail agrupado (Operar / Analisar / Sistema), label de grupo xs muted uppercase. Item 10px; hover dim; ativo = dim + borda Perfil + glow 1px + texto Perfil.
- **Header:** logo Perfil, seletor de veículo, sino, tema, usuário. Header em placa 92% sobre o fundo.
- **Mobile:** cinco destinos na base (Início, Abastecer, Despesa, Relatórios, Mais). Ativo em Perfil. Sheet sobe com os destinos de sistema.

### Metric card (assinatura)
Placa 14px, faixa esquerda 3px Perfil, trilho de ticks 8px (`tick` 2px ligado / 5px desligado). Label uppercase tracked; valor em display mono. Isso é o cluster — telas novas que mostram um número-rei copiam esta peça, não um card genérico.

### Timeline (assinatura)
Lista com trilho 18px: pino Perfil no default, ok no fuel, âmbar/vermelho no aviso. O glow do pino é estrutural. Não transformar a timeline em feed com avatar e sombra.

### Lists, filters, lookups
- **OverflowMenu:** ícone ⋯ 44px; painel 188px alinhado à direita. Escape e clique fora fecham.
- **FilterSheet:** overlay + sheet (rodapé no telefone, centrado ≥1200px). Sempre **Pronto**.
- **LookupSelect:** select + **+**; o painel de cadastro só abre no plus. Sem “Cadastrar novo…” como link.

## Do's and Don'ts

### Do:
- **Do** tratar o violeta Perfil como ponteiro (primário, ativo, faixa, foco) e deixar o resto em cinza de produção.
- **Do** pôr dinheiro, km, L e placa em Chivo Mono tabular.
- **Do** usar KPI com ticks + faixa e timeline com trilho de tipo quando a tela mostra telemetria.
- **Do** manter alvo 44px, raio 10/14, costura 1px, e ações de form visíveis acima da bottom nav no telefone.
- **Do** toque + ⋯ nas listas; cadastro novo no + do dropdown.
- **Do** remapear papéis no tema claro — não inventar uma segunda identidade.

### Don't:
- **Don't** pintar fundos, cards ou rails de violeta; não usar Bootstrap, sombra de marketing em card, nem paleta SaaS multi-accent.
- **Don't** pôr copy de UI em mono, nem valor de KPI em Chivo regular.
- **Don't** dropar shadow em placa em repouso, nem glow decorativo longe de foco/ativo/trilho.
- **Don't** introduzir display serif, ilustração, gradiente de hero, ou app nativo como chrome paralelo.
- **Don't** promover verde/vermelho/âmbar a cor de marca.
- **Don't** empilhar Editar/Excluir na linha da lista, nem “Cadastrar novo” como link extra no formulário.
