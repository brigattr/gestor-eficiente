# Gestor Eficiente

Sistema de gestão de time, atividades, projetos e controles para a liderança da Controladoria, no estilo Monday/Upskill, montado a partir da base `base_de_dados.xlsx` (abas *Plano*, *Perguntas* e *Fontes Adicionais*).

## Módulos

| Área | Módulos |
| --- | --- |
| Visão | Visão geral (alertas, próximos 7 dias, budget, OKR, projetos) · Calendário unificado · Preparação da semana |
| Gestão e Produtividade | Tarefas (Kanban + prioridade GUT + delegação + follow-up a partir de e-mail) · Projetos (Kanban/Gantt, horas e custos plan. × real, vínculo com Incentive Model e KR) · OKR (árvore + check-in) · 1:1 com roteiros de perguntas · Reuniões · Painel de eficiência (lista Tickets_Header do SharePoint: entradas × saídas, backlog, SLA, tempo de atendimento) · Diagnóstico SWOT |
| Pessoas & DP | Time + perfil 360° por colaborador · Vagas e candidatos · Cartão-ponto · Férias (linha do tempo, limite concessivo) · Ocorrências · Exames ASO · Cargos e salários (compa-ratio) |
| Desempenho | Avaliação + Matriz 9-Box · Competências + mapa de gaps → PDI · Feedbacks (SCI) |
| Desenvolvimento | Onboarding · PDIs 5W2H (Kanban/Gantt) · Controle de treinamentos (vencimentos, pessoa × requisitos do cargo) · Treinamento interno (presença + certificado em PDF) · Incentive model no formato do SuccessFactors (régua 50/100/150%, sub-KPIs, bônus projetado) |
| Controles | Despesas × budget por centro de custo/conta/mês/ano (forecast, importação CSV do ERP, distribuição anual) · Centros de custo · Checklist de fechamento mensal |
| Conhecimento | Tabela periódica da gestão · Gestão ágil (6 peças) · Liderando um time novo · Gestão × microgestão |

## Arquitetura

| Parte | Onde roda | O que guarda |
| --- | --- | --- |
| Interface (React) | Cloudflare Pages | — |
| API `/api/*` (`server/api.ts`, via `functions/api/[[path]].ts`) | Cloudflare Pages Functions | login, permissões, sincronização |
| Banco **D1** (binding `DB`) | Cloudflare | registros de todos os módulos, usuários, sessões, metadados dos anexos |
| Bucket **R2** (binding `FILES`) | Cloudflare | conteúdo dos anexos e e-mails |

Os dados ficam no servidor e você acessa de qualquer computador com usuário e senha. As tabelas do D1 são criadas automaticamente no primeiro acesso. Sem a API (por exemplo, abrindo só o `dist/` num servidor estático), o sistema funciona em **modo local**, guardando tudo no navegador.

## Segurança

- Login com sessão em cookie `HttpOnly`/`Secure`/`SameSite=Strict`; senhas em PBKDF2-SHA256 com salt; 5 senhas erradas bloqueiam o usuário por 15 min.
- Primeiro administrador só é criado com a **chave de instalação** (`SETUP_TOKEN`), e só enquanto não houver usuário.
- Perfis conferidos no servidor: Administrador (tudo + usuários + restaurar backup), Gestor (cria/edita) e Leitura (consulta).
- Toda gravação exige um cabeçalho próprio (proteção contra CSRF). Cada registro guarda quem criou e quem alterou.
- Recomendado: deixar este repositório **privado** e, para uma camada extra, ativar o **Cloudflare Access** (Zero Trust, grátis até 50 usuários) pedindo um código por e-mail antes da tela de login.

## Publicar no Cloudflare (chiefdesk.com.br)

1. **Domínio no Cloudflare**: *Add a site* → `chiefdesk.com.br` (plano Free). No Registro.br, troque os servidores DNS pelos dois nameservers que o Cloudflare indicar. A ativação leva de minutos a algumas horas.
2. **Banco D1**: *Storage & Databases → D1 → Create* → nome `chiefdeck-db`.
3. **Bucket R2**: *R2 → Create bucket* → nome `chiefdeck-anexos` (o R2 pede um cartão cadastrado, mas os primeiros 10 GB são gratuitos).
4. **Projeto Pages**: *Workers & Pages → Create → Pages → Connect to Git* → repositório `gestor-eficiente`.
   - Production branch: a branch com este código
   - Framework preset: *None* · Build command: `npm run build` · Build output directory: `dist`
   - Variável de ambiente: `NODE_VERSION` = `22`
5. **Bindings** (*projeto → Settings → Bindings*, para Production e Preview):
   - D1 database → nome da variável **`DB`** → `chiefdeck-db`
   - R2 bucket → nome da variável **`FILES`** → `chiefdeck-anexos`
6. **Chave de instalação** (*Settings → Variables and Secrets*): adicione **`SETUP_TOKEN`** do tipo *Secret*, com um valor longo e aleatório. Guarde: ele é pedido só na criação do primeiro administrador.
7. *Deployments → Retry deployment*, para o deploy já sair com os bindings.
8. **Domínio**: *projeto → Custom domains → Set up a custom domain* → `chiefdesk.com.br` (e, se quiser, `www.chiefdesk.com.br`).
9. Abra `https://chiefdesk.com.br`, informe a chave, crie o administrador e **guarde o código de recuperação**. Depois cadastre os outros usuários em *Sistema → Usuários*.

**Alerta de custo**: configurado em *Notifications → Add → Usage Based Billing* (o alerta avisa por e-mail; não bloqueia a cobrança). O uso previsto fica dentro do plano gratuito.

Para levar dados de um uso anterior em modo local: exporte o backup `.zip` lá e restaure em *Configurações* já logado no servidor.

## Funcionalidades de acesso e anexos

- **Anexos** em qualquer registro: arraste arquivos ou e-mails salvos do Outlook (`.msg`/`.eml`). O sistema lê assunto, remetente, data e um resumo. Em **Tarefas**, soltar um e-mail cria a tarefa de follow-up com o e-mail anexado.
- **Anexos e e-mails** (menu Sistema) busca em todos os anexos.
- **Etiquetas**: crie temas (ex.: Auditoria 2026) e marque qualquer registro; o menu *Etiquetas* mostra tudo de cada tema, por origem, com pendências e lembretes por data.
- **Calendário do Outlook**: em *Reuniões*, cole o link ICS publicado; o calendário tem visões Dia, Semana de trabalho, Semana, Mês e Agenda.
- **Backup completo** (.zip com dados e anexos) em Configurações. O D1 também mantém recuperação automática de 30 dias (*Time Travel*).

## Rodar localmente

```bash
npm install
npm run dev      # só interface (modo local), http://localhost:5173
npm run dev:cf   # interface + API + D1/R2 simulados, http://localhost:8788 (chave: dev-local-123)
npm run build    # gera dist/
```

Nunca coloque dados reais em `src/data/seed.ts` (dados de exemplo fictícios).

## Personalizar

- **Cores**: `src/theme.css` (paleta BP.CONN; fontes Baloo 2 e Nunito embutidas, sem depender do Google Fonts).
- **Campos e módulos**: `src/data/schema.ts`. Cada módulo é declarativo: os campos viram formulário, lista, filtros, Kanban (`statusField`), Gantt (`timeline`) e entradas no Calendário (`dates`).
- **Roteiros de perguntas e checklist de fechamento**: `src/data/content.ts`.
