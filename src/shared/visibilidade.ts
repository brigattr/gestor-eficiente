// Regras de visibilidade compartilhadas entre o servidor e as telas.

/** Telas pessoais: cada registro nasce visível só para quem criou (no plano Empresa).
 *  As demais telas são "da empresa": todos da conta veem. */
export const PESSOAL = new Set([
  'tarefas', 'projetos', 'objetivos', 'krs', 'reunioes', 'umaum', 'swot',
  'blocos', 'secoes', 'paginas', 'desenhos', 'pastas', 'contratos', 'reembolsos', 'solicitacoes',
  'incentivos', 'pdis', 'feedbacks', 'avaliacoes', 'ocorrencias', 'checkinsBemEstar', 'relatosPsico', 'ouvidoria',
  'exames', 'holerites', 'beneficios', 'admissoes', 'ponto', 'onboarding',
  'etiquetas', // cada usuário tem as próprias etiquetas (decidido em 10/11/2026)
])

/** Campos que designam uma pessoa do Time para o registro (dão visibilidade a ela). */
export const PAPEIS_PESSOA = ['responsavel', 'aprovador', 'backup', 'titular', 'instrutor', 'lider', 'aguardandoPessoa']
