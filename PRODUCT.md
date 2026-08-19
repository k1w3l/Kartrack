# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dono de um ou poucos carros pessoais no Brasil. Self-host no homelab. Lança abastecimento e despesa no dia a dia — no celular no posto ou na oficina, e no desktop para analisar.

Outras contas na mesma instância (admin e usuários) são capacidade de primeira classe, não o usuário primário.

## Product Purpose

Kartrack é o livro-razão do veículo: registrar abastecimentos e despesas com odômetro, e devolver o custo verdadeiro de ter o carro (TCO, R$/km, depreciação FIPE, consumo km/L entre tanques cheios).

Sucesso: lançar no momento do gasto, sem planilha, e abrir relatórios que respondam quanto o carro realmente custa — não só quanto saiu no mês.

## Positioning

Lançamento rápido no posto/oficina e custo real de posse (FIPE + TCO + R$/km no histórico próprio) no mesmo sistema self-host. Planilha não fecha o lançamento no celular; app de posto não devolve TCO com depreciação; SaaS não deixa o histórico na instância do dono.

## Operating Context

- Brasil: real, litro, quilômetro, tabela FIPE pública (`fipe.parallelum.com.br`).
- Instância self-host (Docker / k3s), dados no MySQL da casa; backup e restore são ritual do produto.
- Um veículo ativo por vez no seletor; vários veículos por conta.
- Fluxo típico: cadastrar veículo → (opcional) importar CSV → lançar abastecimento/despesa → acompanhar timeline, lembretes de manutenção e relatórios.
- Primeiro usuário cadastrado vira admin; demais contas o admin gerencia.
- Uso misto: telefone no posto/oficina, desktop para Relatórios, Registros e Backup.

## Capabilities and Constraints

Confirmado:

- Web responsiva (SPA React); não há app nativo e não está no escopo.
- PT-BR em toda a interface e na voz do produto.
- Abastecimento (incluindo tanque cheio e km/L só entre tanques cheios), despesa, veículo, timeline, relatórios em abas (Custo real / Despesas / Combustível / FIPE), registros com CSV, backup/restore, lembretes de manutenção, lookups por usuário, sync FIPE.
- Multi-usuário e perfil admin são capacidade de produto, não atalho da instância pessoal.
- Frota SaaS, iOS e Android nativos ficam fora.
- Dados ficam na instância do dono; não há posicionamento como SaaS público.

Indeciso (não inventar):

- Se a imagem Docker pública é oferta de produto para outros self-hosters, ou só o meio de deploy desta instância.

## Brand Commitments

- Nome: **Kartrack**.
- Idioma: português do Brasil.
- Lockups: `logo_light.svg`, `logo_dark.svg`, `favicon.svg` do pacote **Perfil** (servidos em `/uploads`).
- Voz: operacional, direta, no vocabulário do uso (Abastecer, Despesa, Meu veículo, tanque cheio, odômetro). Sem slogan de marketing inventado.

## Evidence on Hand

- App em produção (self-host); README e fluxos reais no repositório.
- Pacote de marca Perfil em `/mnt/NAS/Sync/Documentos/Profissional/Projetos/Kartrack/kartrack - 2/`.
- Integração FIPE ao vivo; métricas de TCO/R$/km no cliente (`frontend/src/lib/reportMetrics.js`).

Não fabricar: depoimentos, clientes, benchmarks, preços ou claims de mercado.

## Product Principles

1. O lançamento no posto ou na oficina tem de caber no celular, com poucos campos, no vocabulário do gasto.
2. Relatório responde o custo verdadeiro de ter o carro (TCO, R$/km, FIPE), não só o total do período.
3. O histórico pertence à instância do dono: self-host, backup, sem dependência de SaaS.
4. Contas e admin são produto, não um extra da instalação pessoal.
5. Continua web e PT-BR; nativo e frota comercial não entram por refinamentos laterais.
