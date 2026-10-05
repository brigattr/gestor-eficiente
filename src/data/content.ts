// Conteúdo de referência: roteiros de perguntas (aba "Perguntas" da planilha),
// checklist de fechamento mensal e a biblioteca de conceitos de gestão.

export const ROTEIROS: Record<string, string[]> = {
  Gestão: [
    'Como você está se sentindo em relação ao trabalho nas últimas semanas?',
    'O que está travando o seu avanço nesse momento?',
    'O que você precisaria de mim para conseguir entregar melhor?',
    'Qual foi a maior aprendizagem que você teve esse mês?',
    'O que você quer desenvolver nos próximos 90 dias?',
    'Se você pudesse mudar uma coisa no time agora, o que seria?',
    'Como você avalia o seu próprio desempenho nesse período?',
  ],
  'Reunião de Status': [
    'O que avançou desde o nosso último encontro?',
    'O que está travado e precisa de atenção agora?',
    'Quais são as prioridades da área para essa semana?',
    'O que está em risco de não ser entregue no prazo?',
    'Quem precisa de apoio para destravar alguma entrega?',
    'O que o time precisa de mim para seguir em frente?',
  ],
  Feedback: [
    'O que você acha que funcionou bem nessa entrega?',
    'O que você faria diferente se pudesse refazer?',
    'Qual foi o impacto disso no time ou no resultado da área?',
    'O que você precisa para não repetir esse caminho?',
    'Como posso te ajudar a chegar no resultado que esperamos?',
    'O que você entendeu como prioridade nessa situação?',
    'O que você entendeu como objetivo dessa entrega?',
  ],
  'Avaliação de Time': [
    'Quem está performando acima do esperado e por quê?',
    'Quem está abaixo do esperado e o que está por trás disso?',
    'Quem tem potencial para assumir mais responsabilidade?',
    'Quais competências estão faltando no time hoje?',
    'O que está impedindo o time de entregar mais?',
    'Quem precisa de um plano de desenvolvimento estruturado agora?',
  ],
  Delegação: [
    'O que você entendeu como objetivo dessa entrega?',
    'Quais recursos você precisa para conseguir fazer isso?',
    'Qual é o seu plano para resolver isso?',
    'O que você faria primeiro se dependesse só de você?',
    'Quais são os maiores riscos que você enxerga aqui?',
    'Quando você consegue me trazer uma proposta de solução?',
  ],
  'Tomada de Decisão': [
    'Qual é o impacto de não decidir isso agora?',
    'Quais são as opções disponíveis e o que cada uma implica?',
    'Quem mais precisa estar nessa decisão?',
    'O que precisaria ser verdade para essa ser a melhor escolha?',
    'Qual é o pior cenário possível e consigo lidar com ele?',
    'Se eu tivesse que decidir com metade das informações, o que escolheria?',
  ],
}

export const FECHAMENTO: { grupo: string; itens: string[] }[] = [
  {
    grupo: 'Livro razão & lançamentos contábeis',
    itens: [
      'Conciliação do livro razão com os livros auxiliares',
      'Revisar eventos não recorrentes e refletir nos lançamentos',
      'Conciliação dos extratos bancários com o razão',
      'Registrar lançamentos regulares e ajustes',
      'Garantir que lançamentos recorrentes estão corretos',
      'Revisar e classificar corretamente despesas',
      'Revisar e classificar corretamente receitas',
      'Ajustar despesas antecipadas',
      'Revisar lançamentos de depreciação e amortização',
    ],
  },
  {
    grupo: 'Contas a receber',
    itens: [
      'Emitir e enviar todas as faturas',
      'Registrar todos os recebimentos de clientes',
      'Revisar e acompanhar inadimplências',
      'Calcular provisão para créditos de liquidação duvidosa (PCLD)',
      'Revisar créditos e estornos concedidos',
    ],
  },
  {
    grupo: 'Inventário & CMV',
    itens: ['Realizar contagem física dos estoques', 'Ajustar valores de inventário quando necessário', 'Garantir que o CMV esteja corretamente registrado', 'Ajustar contas de produção em andamento, se aplicável'],
  },
  {
    grupo: 'Contas a pagar',
    itens: ['Registrar todas as notas fiscais e faturas de fornecedores', 'Processar e registrar pagamentos a fornecedores', 'Acompanhar e revisar faturas em aberto', 'Revisar créditos de fornecedores', 'Revisar GR/IR e provisões de serviços não faturados'],
  },
  {
    grupo: 'Folha de pagamento & benefícios',
    itens: ['Processar e registrar a folha de pagamento', 'Conciliação das contas da folha com o razão', 'Registrar benefícios dos colaboradores', 'Revisar provisões de salários, férias, 13º e encargos', 'Revisar provisão de bônus / incentive'],
  },
  {
    grupo: 'Impostos',
    itens: [
      'Conferir conciliações das contas fiscais',
      'Calcular e registrar impostos sobre vendas (ICMS, ISS, IPI, PIS/COFINS)',
      'Calcular e registrar CBS/IBS (transição da Reforma Tributária)',
      'Preparar e realizar pagamentos de tributos',
      'Ajustar ativos e passivos fiscais diferidos, quando necessário',
    ],
  },
  {
    grupo: 'Intercompany & consolidação',
    itens: [
      'Conciliação entre empresas do grupo (intercompany)',
      'Revisar e consolidar contas das subsidiárias',
      'Atualizar taxas de câmbio para transações internacionais',
      'Reporting package para a matriz (prazo do group calendar)',
    ],
  },
  {
    grupo: 'Compliance & controles internos',
    itens: ['Garantir conformidade com leis, regulamentos e políticas', 'Executar controles-chave (ICS) e evidenciar', 'Avaliar e melhorar os controles internos', 'Documentar todos os procedimentos de fechamento'],
  },
  {
    grupo: 'Relatórios financeiros',
    itens: [
      'Gerar DRE, Balanço Patrimonial e DFC',
      'Revisar precisão e completude dos relatórios',
      'Analisar variações orçado × realizado (budget/forecast)',
      'Revisar e analisar indicadores e índices financeiros',
      'Preparar comentários e recomendações para a gestão',
      'Distribuir os relatórios para gestores e stakeholders',
    ],
  },
  {
    grupo: 'Revisão final & aprovação',
    itens: [
      'Revisar todas as conciliações',
      'Aprovar todos os lançamentos contábeis',
      'Verificar integridade e consistência dos dados',
      'Finalizar e aprovar as demonstrações financeiras',
      'Garantir trilha de auditoria completa',
      'Coordenar, se necessário, com auditores externos',
      'Fazer backup e armazenar os dados com segurança',
      'Preparar os arquivos para o próximo mês',
      'Fechar oficialmente o período contábil no sistema',
    ],
  },
]

export type Conceito = { sigla: string; nome: string; resumo: string; uso: string; modulo?: string }
export const TABELA: { grupo: string; itens: Conceito[] }[] = [
  {
    grupo: 'Estratégia',
    itens: [
      { sigla: 'GUT', nome: 'Gravidade, Urgência, Tendência', resumo: 'Prioriza problemas multiplicando G × U × T (1 a 5 cada).', uso: 'Nota cada tarefa e ordena pelo maior produto.', modulo: 'tarefas' },
      { sigla: 'KPI', nome: 'Indicador-chave de desempenho', resumo: 'Métrica que mostra se o processo está entregando o que deveria.', uso: 'Poucos, com dono, meta e frequência definidos.', modulo: 'okr' },
      { sigla: 'SWOT', nome: 'Forças, Fraquezas, Oportunidades, Ameaças', resumo: 'Diagnóstico interno (F/F) e externo (O/A).', uso: 'Cruze forças com oportunidades para definir prioridades.', modulo: 'diagnostico' },
      { sigla: 'ROI', nome: 'Retorno sobre investimento', resumo: '(Ganho − Investimento) ÷ Investimento.', uso: 'Compare projetos e business cases na mesma base.' },
      { sigla: 'OKR', nome: 'Objetivos e resultados-chave', resumo: 'Objetivo qualitativo + 2 a 5 resultados mensuráveis por ciclo.', uso: 'Liga a meta do ano à tarefa da semana.', modulo: 'okr' },
    ],
  },
  {
    grupo: 'Pessoas e cultura',
    itens: [
      { sigla: '1:1', nome: 'Conversa individual', resumo: 'Encontro recorrente entre líder e liderado, pauta do liderado.', uso: 'Quinzenal, 30 min, com roteiro e acordos registrados.', modulo: 'one-on-one' },
      { sigla: 'CNV', nome: 'Comunicação não violenta', resumo: 'Observação, sentimento, necessidade e pedido.', uso: 'Base para feedback construtivo sem julgamento.', modulo: 'feedbacks' },
      { sigla: '360', nome: 'Feedback 360°', resumo: 'Visão de gestor, pares, liderados e autoavaliação.', uso: 'Use no ciclo anual para competências comportamentais.', modulo: 'mapa-competencias' },
      { sigla: 'PDI', nome: 'Plano de desenvolvimento individual', resumo: 'Ações concretas para fechar gaps de competência.', uso: '70% prática, 20% troca, 10% curso — em 5W2H.', modulo: 'pdis' },
      { sigla: 'EX', nome: 'Experiência do colaborador', resumo: 'Tudo o que a pessoa vive da contratação ao desligamento.', uso: 'Onboarding, reconhecimento e escuta ativa.', modulo: 'onboarding' },
    ],
  },
  {
    grupo: 'Crescimento e eficiência',
    itens: [
      { sigla: 'Kaizen', nome: 'Melhoria contínua', resumo: 'Pequenas melhorias frequentes no processo.', uso: 'Uma melhoria por fechamento: o que tirou 1 dia do D+?' },
      { sigla: 'TAM', nome: 'Mercado total endereçável', resumo: 'Tamanho total da oportunidade de receita.', uso: 'Sizing de novos negócios e business plans.' },
      { sigla: 'LTV', nome: 'Valor do cliente ao longo da relação', resumo: 'Margem esperada de um cliente durante toda a relação.', uso: 'Compare com o CAC: LTV/CAC > 3 é saudável.' },
      { sigla: 'CAC', nome: 'Custo de aquisição de clientes', resumo: 'Gasto comercial ÷ novos clientes do período.', uso: 'Acompanhe por canal e por safra.' },
      { sigla: 'PMF', nome: 'Adequação produto-mercado', resumo: 'Quando o mercado puxa o produto.', uso: 'Sinal: retenção estável e crescimento orgânico.' },
    ],
  },
  {
    grupo: 'Execução',
    itens: [
      { sigla: 'WIP', nome: 'Trabalho em andamento', resumo: 'Quantidade de itens abertos ao mesmo tempo.', uso: 'Limite o WIP por pessoa para terminar antes de começar.', modulo: 'tarefas' },
      { sigla: 'Kanban', nome: 'Gestão visual do fluxo', resumo: 'Colunas de status com cartões que fluem.', uso: 'O trabalho sai da cabeça e vira fluxo visível.', modulo: 'tarefas' },
      { sigla: '5W2H', nome: 'Plano de ação em sete perguntas', resumo: 'O quê, por quê, onde, quando, quem, como, quanto.', uso: 'Estrutura padrão de PDIs e escopo de projetos.', modulo: 'pdis' },
      { sigla: 'PDCA', nome: 'Planejar, executar, verificar, agir', resumo: 'Ciclo de melhoria e controle.', uso: 'Fechamento: plano → execução → revisão → ajuste do processo.', modulo: 'fechamento' },
      { sigla: 'RACI', nome: 'Matriz de papéis', resumo: 'Responsável, Aprovador, Consultado, Informado.', uso: 'Defina para cada etapa do fechamento e do reporting.' },
    ],
  },
  {
    grupo: 'Finanças e resultados',
    itens: [
      { sigla: 'MC', nome: 'Margem de contribuição', resumo: 'Receita − custos e despesas variáveis.', uso: 'Decisão de mix, preço e ponto de equilíbrio.' },
      { sigla: 'TCO', nome: 'Custo total de propriedade', resumo: 'Aquisição + operação + manutenção + descarte.', uso: 'Compare fornecedores e softwares além do preço.' },
      { sigla: 'EBITDA', nome: 'Lucro antes de juros, impostos, depreciação e amortização', resumo: 'Proxy da geração operacional de caixa.', uso: 'Acompanhe a margem EBITDA mês a mês contra o budget.' },
      { sigla: 'ROA', nome: 'Retorno sobre os ativos', resumo: 'Lucro líquido ÷ ativo total.', uso: 'Eficiência no uso da base de ativos.' },
      { sigla: 'ROE', nome: 'Retorno sobre o patrimônio líquido', resumo: 'Lucro líquido ÷ patrimônio líquido.', uso: 'Retorno gerado para o acionista.' },
    ],
  },
]

export const MICROGESTAO: [string, string][] = [
  ['"Nada anda sem eu validar."', '"Me avise só dos pontos importantes. Confio em você."'],
  ['"Por que você não estava online no horário?"', '"Gerencie seu tempo como preferir, foco no resultado."'],
  ['"Me consulte antes de qualquer decisão."', '"Siga como achar melhor. Se travar, me chama."'],
  ['"Por que não seguiu exatamente o que pedi?"', '"Gostei do caminho. Como chegou nessa solução?"'],
  ['"Quero atualização de tudo, etapa por etapa."', '"Me passe só o essencial. Os detalhes estão contigo."'],
  ['"Não está como eu faria."', '"Boa direção. O que te levou a essa escolha?"'],
  ['"Anda logo com isso, já estamos atrasados."', '"Algo travando? Posso ajudar."'],
  ['"Quero ver cada rascunho antes de enviar."', '"Pode tocar. Me envie a versão final quando estiver pronta."'],
  ['"Por que eu sempre reviso seu trabalho?"', '"Se surgir algo, me avise. Confio no seu olhar nos detalhes."'],
  ['"Não mude nada do que combinamos."', '"Ajuste o que precisar. Confio nas suas escolhas."'],
]

export const TIME_NOVO: { titulo: string; texto: string }[] = [
  { titulo: 'Fale menos, escute mais', texto: 'Mesmo com "fome de performance", escute antes de agir. Tome esse tempo agora, porque depois fica difícil.' },
  { titulo: 'Conecte-se individualmente', texto: 'Crie tempo de qualidade com cada membro da equipe para construir confiança e obter perspectivas diferentes.' },
  { titulo: 'Aprenda além do resumo', texto: 'Não se contente com análises e apresentações prontas. Busque dados mais profundos e converse com clientes internos.' },
  { titulo: 'Estabeleça a narrativa e os combinados', texto: 'Deixe claras as expectativas e os imperativos da sua gestão. Estabeleça um objetivo audacioso que engaje o time.' },
  { titulo: 'Module a autonomia do time', texto: 'Avalie a maturidade de cada pessoa e equilibre dinamicamente autonomia e controle.' },
  { titulo: 'Celebre pequenas vitórias coletivas', texto: 'Busque rápido algumas vitórias coletivas e dê visibilidade. Todos querem fazer parte de um time vencedor.' },
]

export const AGIL: { nome: string; frase: string; aqui: string }[] = [
  { nome: 'Scrum', frase: 'Trabalho em ciclos que terminam em entrega — não em relatório.', aqui: 'Projetos com marcos curtos e revisão no status semanal.' },
  { nome: 'Kanban', frase: 'O trabalho sai da sua cabeça e vira fluxo visível para a equipe inteira.', aqui: 'Visão Kanban em Tarefas, Projetos, PDIs, Vagas e Férias.' },
  { nome: 'OKR', frase: 'A meta do ano ligada à tarefa da semana.', aqui: 'Árvore de OKR → Projetos → Tarefas.' },
  { nome: 'Design Thinking', frase: 'Resolver o problema certo antes de executar rápido o problema errado.', aqui: 'Diagnóstico (SWOT) antes de abrir um projeto.' },
  { nome: 'Cultura Lean', frase: 'Cortar o desperdício que consome a equipe sem gerar resultado.', aqui: 'Painel de Eficiência: horas planejadas × realizadas.' },
  { nome: 'Liderança Antifrágil', frase: 'Liderar de um jeito que aguenta imprevisto sem virar caos.', aqui: '1:1 recorrentes, delegação clara e riscos visíveis.' },
]
