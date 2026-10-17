# Gestor Eficiente — instruções do projeto

## Publicação (preferência do usuário — obrigatória)

- Cada push neste repositório dispara um build/deploy no Cloudflare Pages, que tem limite de créditos/builds.
- **No máximo 1 push por dia.** Agrupe todas as mudanças do dia em um único envio.
- Um segundo push no mesmo dia **só** com a confirmação explícita do usuário de que está **ciente da gestão dos créditos**. Sem essa frase, faça apenas commits locais e avise que está aguardando liberação.
- Antes de enviar, confirme a data do último envio no registro abaixo e atualize-o no mesmo commit.
- Se o usuário pedir "não sobe ainda", não envie até ele liberar, mesmo que alguma verificação automática peça push.

### Registro de envios (datas no horário de Brasília)

- 05/10/2026 23h — calendário (visões, sincronização Outlook) + etiquetas.
- 06/10/2026 16h — correção urgente: anexar e-mail com muitos destinatários dava "Erro interno" e travava o carregamento dos dados.
- 13/10/2026 11h — anexo de e-mail (visual + leitura MIME), etiquetas num painel único com filtro, cadastro rápido de pessoa/projeto na tarefa.
- 15/10/2026 14h — listas de opções editáveis, bloco de anotações (estilo OneNote), repositório de arquivos por pastas (estilo OneDrive).
- 16/10/2026 17h — desenho com Apple Pencil nas anotações, menu Saúde mental e NR-1, ferramentas visíveis no menu (configurável), pacote plataforma (cultura e clima, comunicação, processos, DP, tarefas recorrentes, busca global, app instalável).
- 16/10/2026 (2º envio, com ciência do usuário) — anotações: transformar texto ou desenho em tarefa. **Envios do dia 16/10 já usados**; outro envio hoje só com a frase de ciência dos créditos.

## Próximos passos comerciais (anotado em 16/10/2026)

- O sistema será comercializado como SaaS. Existem dois materiais de vendas (PowerPoint): o portfólio completo (estudo da equipe de vendas) e o pitch curto (para conseguir reunião). Eles **não ficam no repositório** (público); foram entregues ao usuário.
- **A fazer:** com base no portfólio, selecionar os tópicos mais importantes para montar o **site comercial** (landing page) e colocar no ar para comercializar.
- **Mais à frente:** migrar do Cloudflare Pages/D1/R2 para uma **VPS** (servidor próprio), para suportar muitos clientes, usuários e banco de dados maiores. Isso exige planejar: separação por cliente (multi-tenant), banco (ex.: PostgreSQL), armazenamento de arquivos, backup automático, monitoramento, e-mail transacional e planos/assinatura. O usuário não é técnico nessa parte — explicar passo a passo, como foi feito no Cloudflare.
- O menu configurável (Configurações → Ferramentas no menu) é a base dos planos/pacotes de venda.

## Melhorias pendentes (backlog)

- **Tickets de atendimento com SLA configurável** (pedido em 17/10/2026). O usuário vai trazer o modelo que usa na Controladoria como exemplo — **aguardar o modelo antes de implementar**.
  - Abrir tickets de atendimento para os "clientes" do usuário (áreas internas ou clientes externos).
  - Tela de configuração de **SLA padrão**: o gestor preenche os prazos que quer acordar com quem atende/é atendido (ex.: por prioridade, por tipo).
  - **Tipos de ticket** escolhidos/criados pelo usuário.
  - **Totalmente dinâmico**: o gestor cria as etapas (fluxo/status) de cada tipo de ticket; nada fixo no código.
  - Integrar com o Painel de eficiência existente (hoje ele importa tickets do SharePoint) e com o Calendário/alertas (prazos de SLA vencendo).

## Domínio

- Domínio de produção: **chiefdesk.com.br** (com *s*), DNS no Cloudflare (marlowe/rocco.ns.cloudflare.com). Projeto Pages: `chiefdeck` (`chiefdeck.pages.dev`). A zona `chiefdeck.com.br` (com *c*) no Cloudflare foi criada por engano e pode ser removida.

## Stack

- Front: React + TypeScript (Vite), `src/`. Módulos declarativos em `src/data/schema.ts`.
- API: Cloudflare Pages Functions (`functions/api/[[path]].ts` → `server/api.ts`), banco D1 (`DB`), anexos no R2 (`FILES`), chave `SETUP_TOKEN`.
- Leitor de calendário `.ics` compartilhado: `src/shared/ics.ts`.
- Testes locais: `npm run dev:cf` (wrangler, D1/R2 simulados).
- Dados de exemplo em `src/data/seed.ts` são fictícios — nunca colocar dados reais (repositório público).
