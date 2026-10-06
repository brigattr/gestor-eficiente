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

## Acesso, usuários e anexos

- **Login**: no primeiro acesso você cria o administrador e recebe um **código de recuperação** (guarde). Perfis: Administrador, Gestor e Leitura. Senhas guardadas só como hash PBKDF2. Bloqueio automático por inatividade (padrão 30 min).
- **Anexos** em qualquer registro (tarefa, projeto, reunião, ocorrência…): arraste arquivos ou e-mails salvos do Outlook (`.msg`/`.eml`). O sistema lê assunto, remetente, data e um resumo. Em **Tarefas**, soltar um e-mail cria a tarefa de follow-up com o e-mail anexado.
- **Anexos e e-mails** (menu Sistema) busca em todos os anexos.

## Dados e privacidade

Dados e anexos ficam **apenas no navegador** (IndexedDB), mesmo com o site no seu domínio: o servidor só entrega os arquivos do sistema, nada é enviado de volta. Consequências:

- Trocar de computador/perfil ou limpar os dados de navegação apaga a base → faça **Configurações → Exportar backup completo (.zip)** com frequência e guarde no OneDrive/SharePoint corporativo.
- No primeiro acesso há dados **fictícios** de exemplo; apague em Configurações antes do uso real.
- Este repositório é público: nunca coloque dados reais em `src/data/seed.ts`.

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/ (site estático)
```

## Publicar no seu domínio

O `dist/` é um site estático (sem servidor). **Use HTTPS** — o login depende da Web Crypto API, que o navegador só libera em HTTPS.

| Opção | Como |
| --- | --- |
| **Cloudflare Pages** (recomendado, grátis) | Conecte o repositório, build `npm run build`, saída `dist`. Em *Custom domains* adicione `gestor.seudominio.com.br`. O arquivo `public/_headers` aplica os cabeçalhos de segurança. |
| **GitHub Pages** | Já configurado em `.github/workflows/deploy.yml` (push na `main`). *Settings → Pages → Source: GitHub Actions* e *Custom domain*. Em repositório privado exige plano pago do GitHub. |
| **Hospedagem tradicional** (Hostinger, Locaweb…) | `npm run build` e envie o conteúdo de `dist/` para `public_html/` (ou subpasta). O `.htaccess` incluso força HTTPS. |

No DNS do domínio, crie um `CNAME` de `gestor` para o endereço indicado pelo provedor. Domínios recém-criados podem ser barrados por filtros corporativos (categoria "novo/não classificado"); se acontecer, peça a liberação à TI.

## Personalizar

- **Cores**: `src/theme.css` (paleta BP.CONN; fontes Baloo 2 e Nunito embutidas, sem depender do Google Fonts).
- **Campos e módulos**: `src/data/schema.ts`. Cada módulo é declarativo: os campos viram formulário, lista, filtros, Kanban (`statusField`), Gantt (`timeline`) e entradas no Calendário (`dates`).
- **Roteiros de perguntas e checklist de fechamento**: `src/data/content.ts`.
