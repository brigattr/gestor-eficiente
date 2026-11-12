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
- 16/10/2026 (2º envio, com ciência do usuário) — anotações: transformar texto ou desenho em tarefa. **Envios do dia 16/10 já usados**.
- 19/10/2026 00h — vários calendários (Outlook, Google, iCloud), menu Clima e bem-estar, marca Gestor Eficiente · ChiefDesk, backlog de tickets com SLA. **Envio do dia 19/10 já usado**.
- 26/10/2026 22h — listas sem concluídas por padrão, Contratos e vencimentos, avisos de vencimento (sino), anotações estilo Notas do iPhone (tela cheia, papel liso/linhas/quadriculado, lápis, régua, estilos, tabela, fixar), atalhos + Tarefa no 1:1 e Conectar calendários. **Envio do dia 26/10 já usado**.
- 27/10/2026 18h — etapas (subtarefas) dentro da tarefa, 'Concluída e criar nova tarefa', fluxogramas de processo, ajustes de celular (sem zoom nos campos, área segura do iPhone, telas sem estourar a largura) e login que não cai (manter conectado renova a cada uso; bloqueio por inatividade não derruba quem marcou). **Envio do dia 27/10 já usado**.
- 01/11/2026 17h — tarefas dentro dos projetos (progresso automático), importação em massa com modelo Excel por tela, horário do aviso nas tarefas, ditado por voz nas anotações, convite de reunião legível, modo TV com Sair no iPhone, menu oculto também nos Pontos de atenção/OKR, receitas do manual do usuário (docs/manual-usuario). **Envio do dia 01/11 já usado**.
- 01/11/2026 (2º envio, com ciência do usuário) — menu lateral recolhível, imagens e fontes nas anotações, workflow de delegação (Minhas pendências, aviso de nova atribuição), backlog de e-mail. **Envios do dia 01/11 já usados**.
- 04/11/2026 13h48 — contas de clientes (Individual/Empresa) com painel Plataforma, visão por usuário (pessoal × da empresa, compartilhar, aguardando pessoa, perfil Colaborador, gestor vê equipe), calendários por usuário, etiqueta 🔒 Pessoal / 🏢 Da empresa, backlog etapas na lista. **Envio do dia 04/11 já usado**.
- 09/11/2026 18h — manual do usuário dentro do sistema (Sistema → Manual do usuário e botão ? em cada tela), manuais atualizados (contas, visão por usuário, pendências), registro do site comercial. **Envio do dia 09/11 já usado**.
- 10/11/2026 13h56 — privacidade: registros pessoais de antes das contas (tarefas, reuniões…) passam a ter dono e deixam de aparecer para os outros usuários; anotações do site no ar e do que retomar. **Envio do dia 10/11 já usado**.
- 10/11/2026 14h39 (2º envio, com ciência do usuário) — privacidade: arquivos da pasta principal só para quem enviou, dono garantido a cada início; Usuários com 'Ver o que vê' e bloqueio de pessoa repetida; cada usuário conecta os próprios calendários. **Envios do dia 10/11 já usados**.
- 10/11/2026 14h45 (3º envio, autorizado pelo usuário após falha na correção anterior) — nada pessoal sem dono: correção automática não depende mais do 'dono da plataforma' (vale para todas as contas, inclui _dono vazio), registro sem dono só aparece para administradores, aviso + botão 'Tornar meus' em Usuários. **Envios do dia 10/11 já usados**.
- 12/11/2026 11h43 — etiquetas pessoais (cada usuário tem as próprias); tarefas com Dependências, Próximas ações e Impacto; aba Etapas no modelo de importação de Tarefas. **Envio do dia 12/11 já usado**.
- **Lição (10/11)**: testar migrações com um banco igual ao de produção (sem a marca de dono da plataforma, registros de todas as telas pessoais, arquivos soltos). Teste em `scratchpad/real/teste.mjs` (fora do repositório).

## Retomar em 10/11/2026 (combinado em 09/11)

- Usuário vai testar com funcionários e trazer novos ajustes (agrupar tudo num único envio do dia).
- Google Search Console: cadastrar o domínio chiefdesk.com.br (registro TXT no DNS do Cloudflare) e enviar o sitemap.
- FortiGuard (Doehler) bloqueia por domínio novo: usuário vai pedir reclassificação em fortiguard.com/webfilter (Information Technology) para chiefdesk.com.br e app.chiefdesk.com.br; enquanto isso, na Doehler usar chiefdeck.pages.dev. Sem chamado para a TI.
- Antes do teste com funcionários: conta no plano Empresa, cada usuário ligado à sua pessoa do Time, perfis (Gestor/Colaborador).

## Próximos passos comerciais (anotado em 16/10/2026)

- O sistema será comercializado como SaaS. Existem dois materiais de vendas (PowerPoint): o portfólio completo (estudo da equipe de vendas) e o pitch curto (para conseguir reunião). Eles **não ficam no repositório** (público); foram entregues ao usuário.
- **A fazer:** com base no portfólio, selecionar os tópicos mais importantes para montar o **site comercial** (landing page) e colocar no ar para comercializar.
- **Mais à frente:** migrar do Cloudflare Pages/D1/R2 para uma **VPS** (servidor próprio), para suportar muitos clientes, usuários e banco de dados maiores. Isso exige planejar: separação por cliente (multi-tenant), banco (ex.: PostgreSQL), armazenamento de arquivos, backup automático, monitoramento, e-mail transacional e planos/assinatura. O usuário não é técnico nessa parte — explicar passo a passo, como foi feito no Cloudflare.
- O menu configurável (Configurações → Ferramentas no menu) é a base dos planos/pacotes de venda.

## Rumo do produto: contas e visão por usuário (decidido em 04/11/2026)

- **Não recomeçar**: manter todas as telas; trocar a fundação. Hoje é 1 empresa por instalação e todos os usuários veem tudo (perfis só limitam edição).
- **Dois jeitos de vender**: (1) **Individual** — um gestor organizando a própria vida/rotina; (2) **Empresa** — funcionários da mesma empresa, com delegação entre eles, cada um com a própria visão.
- **Todos os módulos existem nos dois planos**; o **dono da plataforma (o usuário)** escolhe, por conta de cliente, o que cada uma pode acessar (liga/desliga em nível de plataforma). O administrador da empresa ainda pode esconder mais no menu.
- **Regra de visibilidade (proposta, a validar)**: tudo **nasce pessoal** (só o criador vê). Passa a outra pessoa **só por um ato explícito**:
  1. **Delegar** (Responsável/Aprovador/Backup… = outra pessoa) → ela vê e recebe o aviso; quem delegou acompanha em "Delegadas por mim".
  2. **Depender de alguém** ("Aguardando quem" vira escolha de pessoa) → ela vê em "Aguardando você", sem virar dona.
  3. **Etapa delegada** → a pessoa vê a tarefa (e a etapa dela).
  4. **Compartilhar** (botão "Compartilhar com…" pessoas ou equipe) → só dar visibilidade, sem delegar.
  5. **Telas "da empresa" por natureza** (mural, políticas, obrigações, organograma…) são visíveis para todos da conta; telas de RH sensíveis (salários, avaliações, ocorrências, relatos) só RH/gestor direto.
  - Gestor **não** vê automaticamente o que é pessoal do subordinado; vê o que foi delegado/compartilhado. Opção da empresa (desligada por padrão): "gestor vê tudo da equipe".
- **Passos**: 1) fundação de contas (cadastro "Criar conta", e-mail de confirmação/recuperação, convites, painel do dono); 2) dono + visibilidade por registro e perfis Administrador da empresa / Gestor / Colaborador; 3) planos e cobrança recorrente (Asaas/Iugu); 4) backup por cliente, Termos de uso e Política de privacidade (LGPD), site com "Criar conta"; 5) VPS quando crescer. Os dados atuais do usuário viram a conta nº 1.
- **BP Conn**: no futuro, parte deste sistema vai para um produto próprio para **escritórios contábeis** (outro nicho). Não usar a BP Conn como empresa de teste por enquanto.
- **Feito e enviado em 04/11/2026**: contas no banco (`contas`, `conta_id` em items/files/users; a instalação antiga vira a conta `c1` e o 1º administrador vira o dono da plataforma), painel **Plataforma (contas)** (criar conta Individual/Empresa com o administrador dela, liberar ferramentas, desativar), visibilidade por registro no plano Empresa (`_dono` gravado pelo servidor; regras em `server/contas.ts` e `src/shared/visibilidade.ts`), campo "Compartilhar com", "Aguardando (pessoa do time)", perfil **Colaborador** (sem salários), opção "Gestor vê tudo da equipe" (Configurações → Conta), calendários por usuário.
  - **Falta**: "Criar conta" pelo site com e-mail de confirmação/recuperação e convites (precisa de e-mail transacional); bloquear no servidor as ferramentas não liberadas (hoje só some do menu); Administrador vê tudo nas telas de RH sensíveis (ouvidoria, relatos, ocorrências, avaliações, holerites…) — validar se deve existir um perfil "RH" separado.

## Melhorias pendentes (backlog)

- **Tickets de atendimento com SLA configurável** (pedido em 17/10/2026). O usuário vai trazer o modelo que usa na Controladoria como exemplo — **aguardar o modelo antes de implementar**.
  - Abrir tickets de atendimento para os "clientes" do usuário (áreas internas ou clientes externos).
  - Tela de configuração de **SLA padrão**: o gestor preenche os prazos que quer acordar com quem atende/é atendido (ex.: por prioridade, por tipo).
  - **Tipos de ticket** escolhidos/criados pelo usuário.
  - **Totalmente dinâmico**: o gestor cria as etapas (fluxo/status) de cada tipo de ticket; nada fixo no código.
  - Integrar com o Painel de eficiência existente (hoje ele importa tickets do SharePoint) e com o Calendário/alertas (prazos de SLA vencendo).

- **Etapas visíveis na lista de Tarefas** (pedido em 02/11/2026): ver os prazos das etapas sem abrir a tarefa. Proposta:
  - Na Lista, tarefa com etapas ganha uma setinha ▸ que **expande as etapas logo abaixo, recuadas** (como "agrupar" do Excel): bolinha para concluir, responsável e prazo (vermelho se atrasada). Botões "Expandir todas / Recolher todas", lembrados no aparelho.
  - Coluna **"Próxima etapa"** (nome + prazo da etapa pendente mais próxima), ordenável — dá para organizar o dia sem expandir nada.
  - **Prazo geral × etapas**: aviso quando uma etapa vence depois do prazo da tarefa; sem prazo na tarefa, mostrar a última data das etapas como prazo sugerido.
  - No Kanban, o cartão mostra "Próxima etapa: … · dd/mm". (O Calendário já mostra as etapas com data.)
- **Horário padrão por lista** (ideia, 27/10/2026): ex.: lista Pessoal já vem com aviso às 18h. O horário de aviso por tarefa já foi feito.
- **Manuais** (01/11/2026): Manual do Usuário em PDF (fontes em docs/manual-usuario; regenerar quando telas mudarem) e Manual Comercial (fora do repositório, entregue ao usuário).
- **Lacunas vistas ao escrever o manual** (01/11/2026): candidato 'Contratado' não cria pessoa/admissão; feedback 'compartilhar' não publica no Mural; Férias não cruza com a Matriz de cobertura; pesquisas não alimentam Indicadores de bem-estar.
- **E-mail (pedido em 02/11/2026)** — aguardando decisão do usuário:
  - *Hospedar e-mail de pequenas empresas* (caixa @empresa.com.br): não roda no Cloudflare Pages; caminho sugerido é revender/indicar um provedor (Zoho Mail, Google Workspace, Microsoft 365, Locaweb/KingHost) e o sistema só configurar o domínio. Servidor de e-mail próprio só faria sentido na VPS, e mesmo assim exige anti-spam, reputação e suporte.
  - *E-mail dentro do sistema* (ler/enviar): via conexão oficial com Microsoft 365/Outlook (Graph) e Gmail (API), com login de cada usuário (OAuth); exige registrar o app na Microsoft/Google e, na Doehler, aprovação da TI. Passo 1 viável: ler a caixa e transformar e-mail em tarefa/follow-up; passo 2: responder/enviar.
- **Manuais sempre atualizados** (pedido em 04/11/2026): a cada mudança de tela, atualizar `docs/manual-usuario/conteudo/*.json` (vale para o PDF e para o manual dentro do sistema, botão ? em cada tela) e o Manual Comercial (fora do repositório), refazer as fotos e entregar os PDFs ao usuário. Última atualização: 04/11/2026 (contas, visão por usuário, pendências, menu recolhível, imagens/fontes nas anotações, manual no sistema).
- **Avisos com o sistema fechado** (próximo passo das notificações, 26/10/2026): hoje os avisos do sino aparecem com o sistema aberto (mesmo em outra aba/minimizado). Para avisar com tudo fechado é preciso Web Push com agendador no servidor (Worker com cron + chaves VAPID) — fazer junto com a migração para VPS ou antes, se o usuário pedir.
- **Anotações — o que ficou de fora do pacote Notas do iPhone**: laço (selecionar e mover parte do desenho), bloquear nota com senha, seções recolhíveis, imagem dentro do texto.

## Marca (decidido em 18/10/2026)

- **ChiefDesk** é a marca-mãe (empresa/plataforma), que no futuro terá outros produtos. **Gestor Eficiente** é o produto atual: "Gestor Eficiente · uma plataforma ChiefDesk". Não renomear o sistema para ChiefDesk.
- O grupo de menu "Saúde mental e NR-1" virou **"Clima e bem-estar"** (clima/eNPS e termômetro de humor foram para ele; o antigo "Cultura e clima" virou "Cultura"). NR-1 continua coberta, mas sem ser o foco da comunicação.

## Site comercial (no ar desde 09/11/2026)

- Repositório próprio: **brigattr/gestor-eficiente-site** (página estática `index.html` + `img/`, `_headers` de segurança, robots.txt, sitemap.xml). SEO revisado (Lighthouse 100).
- Cloudflare: projeto Pages **gestor-eficiente-site** com os domínios **chiefdesk.com.br** e **www.chiefdesk.com.br**. O sistema (projeto `chiefdeck`) agora fica em **app.chiefdesk.com.br**. Cada push no repositório do site também gera um build (conta Cloudflare compartilhada).
- Falta: Google Search Console + sitemap; liberar os domínios no filtro web da Doehler (pedido à TI e/ou recategorização no fabricante do filtro).

## Domínio

- Domínio de produção: **chiefdesk.com.br** (com *s*) — site; sistema em **app.chiefdesk.com.br**, DNS no Cloudflare (marlowe/rocco.ns.cloudflare.com). Projeto Pages: `chiefdeck` (`chiefdeck.pages.dev`). A zona `chiefdeck.com.br` (com *c*) no Cloudflare foi criada por engano e pode ser removida.

## Stack

- Front: React + TypeScript (Vite), `src/`. Módulos declarativos em `src/data/schema.ts`.
- API: Cloudflare Pages Functions (`functions/api/[[path]].ts` → `server/api.ts`), banco D1 (`DB`), anexos no R2 (`FILES`), chave `SETUP_TOKEN`.
- Leitor de calendário `.ics` compartilhado: `src/shared/ics.ts`.
- Testes locais: `npm run dev:cf` (wrangler, D1/R2 simulados).
- Dados de exemplo em `src/data/seed.ts` são fictícios — nunca colocar dados reais (repositório público).
