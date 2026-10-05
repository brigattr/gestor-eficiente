# Gestor Eficiente

Sistema de gestão de time, atividades, projetos e controles para a liderança da Controladoria, no estilo Monday/Upskill, montado a partir da base `base_de_dados.xlsx` (abas *Plano*, *Perguntas* e *Fontes Adicionais*).

## Módulos

| Área | Módulos |
| --- | --- |
| Visão | Visão geral (alertas, próximos 7 dias, budget, OKR, projetos) · Calendário unificado · Preparação da semana |
| Gestão e Produtividade | Tarefas (Kanban + prioridade GUT + delegação) · Projetos (Kanban/Gantt, horas e custos plan. × real, vínculo com Incentive Model e KR) · OKR (árvore + check-in) · 1:1 com roteiros de perguntas · Reuniões · Painel de eficiência (importação CSV do sistema de tickets) · Diagnóstico SWOT |
| Pessoas & DP | Time + perfil 360° por colaborador · Vagas e candidatos · Cartão-ponto · Férias (linha do tempo, limite concessivo) · Ocorrências · Exames ASO · Cargos e salários (compa-ratio) |
| Desempenho | Avaliação + Matriz 9-Box · Competências + mapa de gaps → PDI · Feedbacks (SCI) |
| Desenvolvimento | Onboarding · PDIs 5W2H (Kanban/Gantt) · Controle de treinamentos (vencimentos, pessoa × requisitos do cargo) · Treinamento interno (presença + certificado em PDF) · Incentive model (pesos, atingimento ponderado) |
| Controles | Despesas × budget por centro de custo/conta/mês/ano (forecast, importação CSV do ERP, distribuição anual) · Centros de custo · Checklist de fechamento mensal |
| Conhecimento | Tabela periódica da gestão · Gestão ágil (6 peças) · Liderando um time novo · Gestão × microgestão |

## Dados e privacidade

Os dados ficam **apenas no navegador** (localStorage). Nada é enviado a servidores. Use *Configurações → Exportar backup* regularmente. No primeiro acesso o sistema carrega dados **fictícios** de exemplo; apague-os em Configurações quando for usar de verdade.

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/ (abre em qualquer servidor estático)
```

## Publicar

O workflow `.github/workflows/deploy.yml` publica no GitHub Pages a cada push na `main` (ative em *Settings → Pages → Source: GitHub Actions*).

## Personalizar

- **Cores**: `src/theme.css` (paleta provisória marinho + dourado).
- **Campos e módulos**: `src/data/schema.ts`. Cada módulo é declarativo: os campos viram formulário, lista, filtros, Kanban (`statusField`), Gantt (`timeline`) e entradas no Calendário (`dates`).
- **Roteiros de perguntas e checklist de fechamento**: `src/data/content.ts`.
