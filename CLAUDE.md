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
- 16/10/2026 17h — desenho com Apple Pencil nas anotações, menu Saúde mental e NR-1, ferramentas visíveis no menu (configurável), pacote plataforma (cultura e clima, comunicação, processos, DP, tarefas recorrentes, busca global, app instalável). **Envio do dia 16/10 já usado**; outro envio hoje só com a frase de ciência dos créditos.

## Domínio

- Domínio de produção: **chiefdesk.com.br** (com *s*), DNS no Cloudflare (marlowe/rocco.ns.cloudflare.com). Projeto Pages: `chiefdeck` (`chiefdeck.pages.dev`). A zona `chiefdeck.com.br` (com *c*) no Cloudflare foi criada por engano e pode ser removida.

## Stack

- Front: React + TypeScript (Vite), `src/`. Módulos declarativos em `src/data/schema.ts`.
- API: Cloudflare Pages Functions (`functions/api/[[path]].ts` → `server/api.ts`), banco D1 (`DB`), anexos no R2 (`FILES`), chave `SETUP_TOKEN`.
- Leitor de calendário `.ics` compartilhado: `src/shared/ics.ts`.
- Testes locais: `npm run dev:cf` (wrangler, D1/R2 simulados).
- Dados de exemplo em `src/data/seed.ts` são fictícios — nunca colocar dados reais (repositório público).
