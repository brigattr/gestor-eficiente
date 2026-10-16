// Menu lateral. 'path' sem barra inicial; '' = Visão geral.
export type NavItem = { path: string; label: string; icon: string }
export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Visão',
    items: [
      { path: '', label: 'Visão geral', icon: 'home' },
      { path: 'calendario', label: 'Calendário', icon: 'calendar' },
      { path: 'semana', label: 'Preparação da semana', icon: 'week' },
      { path: 'anotacoes', label: 'Anotações', icon: 'book' },
      { path: 'arquivos', label: 'Arquivos', icon: 'folder' },
    ],
  },
  {
    group: 'Gestão e Produtividade',
    items: [
      { path: 'tarefas', label: 'Tarefas', icon: 'check' },
      { path: 'projetos', label: 'Projetos', icon: 'folder' },
      { path: 'okr', label: 'OKR', icon: 'crosshair' },
      { path: 'one-on-one', label: '1:1 e roteiros', icon: 'chat' },
      { path: 'reunioes', label: 'Reuniões', icon: 'calendar-users' },
      { path: 'eficiencia', label: 'Painel de eficiência', icon: 'gauge' },
      { path: 'diagnostico', label: 'Diagnóstico (SWOT)', icon: 'search' },
    ],
  },
  {
    group: 'Pessoas & DP',
    items: [
      { path: 'pessoas', label: 'Time', icon: 'users' },
      { path: 'vagas', label: 'Vagas e seleção', icon: 'briefcase' },
      { path: 'ponto', label: 'Cartão-ponto', icon: 'clock' },
      { path: 'ferias', label: 'Férias', icon: 'sun' },
      { path: 'ocorrencias', label: 'Ocorrências', icon: 'flag' },
      { path: 'exames', label: 'Exames (ASO)', icon: 'heart' },
      { path: 'cargos', label: 'Cargos e salários', icon: 'layers' },
    ],
  },
  {
    group: 'Saúde mental e NR-1',
    items: [
      { path: 'nr1', label: 'Painel NR-1', icon: 'heart' },
      { path: 'nr1-inventario', label: 'Inventário de riscos', icon: 'alert' },
      { path: 'nr1-plano', label: 'Plano de ação', icon: 'checklist' },
      { path: 'nr1-pesquisa', label: 'Pesquisa anônima', icon: 'search' },
      { path: 'nr1-bem-estar', label: 'Check-ins de bem-estar', icon: 'chat' },
      { path: 'nr1-relatos', label: 'Relatos e encaminhamentos', icon: 'flag' },
      { path: 'nr1-indicadores', label: 'Indicadores', icon: 'trending' },
      { path: 'nr1-checklist', label: 'Checklist de conformidade', icon: 'check' },
      { path: 'nr1-guia', label: 'Guia e legislação', icon: 'book' },
    ],
  },
  {
    group: 'Desempenho',
    items: [
      { path: 'avaliacoes', label: 'Avaliação e 9-Box', icon: 'award' },
      { path: 'competencias', label: 'Competências', icon: 'target' },
      { path: 'feedbacks', label: 'Feedbacks', icon: 'message' },
    ],
  },
  {
    group: 'Desenvolvimento',
    items: [
      { path: 'onboarding', label: 'Onboarding', icon: 'rocket' },
      { path: 'pdis', label: 'PDIs (5W2H)', icon: 'trending' },
      { path: 'treinamentos', label: 'Treinamentos', icon: 'book' },
      { path: 'treinamento-interno', label: 'Treinamento interno', icon: 'presentation' },
      { path: 'incentive', label: 'Incentive model', icon: 'trophy' },
    ],
  },
  {
    group: 'Controles',
    items: [
      { path: 'despesas', label: 'Despesas × budget', icon: 'wallet' },
      { path: 'centros-custo', label: 'Centros de custo', icon: 'building' },
      { path: 'fechamento', label: 'Fechamento mensal', icon: 'checklist' },
    ],
  },
  {
    group: 'Conhecimento',
    items: [{ path: 'biblioteca', label: 'Biblioteca de gestão', icon: 'library' }],
  },
  {
    group: 'Sistema',
    items: [
      { path: 'anexos', label: 'Anexos e e-mails', icon: 'link' },
      { path: 'usuarios', label: 'Usuários', icon: 'users' },
      { path: 'configuracoes', label: 'Configurações e backup', icon: 'settings' },
    ],
  },
]
