// Conteúdo de referência do menu "Clima e bem-estar (NR-1)".
// Base: NR-1 cap. 1.5 (Portaria MTE 1.419/2024), Guia de Fatores de Riscos Psicossociais do MTE (abr/2025),
// Lei 14.457/2022, Lei 14.831/2024, COPSOQ II-Br e HSE Management Standards. Situação jurídica pesquisada em 16/10/2026.

/** Os 13 fatores de risco psicossocial exemplificados no Guia do MTE. */
export const FATORES_PSICO: { nome: string; descricao: string; exemplo: string }[] = [
  { nome: 'Assédio (moral ou sexual)', descricao: 'Condutas abusivas, humilhações, intimidação, cobranças vexatórias, investidas de cunho sexual.', exemplo: 'Cobrança pública e ríspida por erro no fechamento; piadas constrangedoras recorrentes.' },
  { nome: 'Má gestão de mudanças organizacionais', descricao: 'Mudanças (sistemas, estrutura, processos) sem comunicação, consulta ou apoio.', exemplo: 'Troca de ERP ou de plano de contas sem treinamento e com prazos mantidos.' },
  { nome: 'Baixa clareza de papel ou função', descricao: 'Pessoas não sabem o que se espera delas ou recebem demandas conflitantes.', exemplo: 'Analista recebe pedidos da matriz, do fiscal e do comercial sem prioridade definida.' },
  { nome: 'Baixas recompensas e reconhecimento', descricao: 'Esforço desproporcional ao reconhecimento, remuneração ou perspectiva de crescimento.', exemplo: 'Picos de fechamento sem reconhecimento nem folga compensatória.' },
  { nome: 'Falta de suporte no trabalho', descricao: 'Pouco apoio da liderança ou dos colegas, recursos insuficientes.', exemplo: 'Pessoa sozinha numa conciliação crítica, sem backup nem acesso ao gestor.' },
  { nome: 'Baixo controle / falta de autonomia', descricao: 'Pouca influência sobre como, quando e em que ordem fazer o trabalho.', exemplo: 'Microgestão de cada lançamento; pausas e horários totalmente rígidos.' },
  { nome: 'Baixa justiça organizacional', descricao: 'Regras, promoções e decisões percebidas como injustas ou incoerentes.', exemplo: 'Critérios de mérito e promoção pouco transparentes.' },
  { nome: 'Eventos violentos ou traumáticos', descricao: 'Exposição a violência, ameaças, acidentes graves ou situações traumáticas.', exemplo: 'Ameaça de cliente/fornecedor em cobrança; evento grave na empresa.' },
  { nome: 'Baixa demanda (subcarga)', descricao: 'Trabalho monótono ou abaixo das habilidades, ociosidade.', exemplo: 'Profissional sênior restrito a tarefas repetitivas por longos períodos.' },
  { nome: 'Excesso de demandas (sobrecarga)', descricao: 'Volume, ritmo ou prazos acima da capacidade; jornadas longas.', exemplo: 'Fechamento + auditoria + reporting à matriz na mesma semana, com horas extras contínuas.' },
  { nome: 'Maus relacionamentos no trabalho', descricao: 'Conflitos frequentes, clima hostil, isolamento social dentro da equipe.', exemplo: 'Atritos entre contabilidade e fiscal sem mediação.' },
  { nome: 'Dificuldades de comunicação', descricao: 'Informação que não chega, chega tarde ou de forma confusa.', exemplo: 'Mudança de prazo da matriz comunicada só na véspera.' },
  { nome: 'Trabalho remoto e isolado', descricao: 'Isolamento físico/social, fronteira difusa entre trabalho e vida pessoal.', exemplo: 'Home office sem rituais de equipe e com mensagens fora do horário.' },
]
export const NOMES_FATORES = FATORES_PSICO.map((f) => f.nome)

export const PROBABILIDADE = ['1 – Rara', '2 – Pouco provável', '3 – Possível', '4 – Provável', '5 – Quase certa']
export const SEVERIDADE = ['1 – Leve', '2 – Menor', '3 – Moderada', '4 – Grave', '5 – Gravíssima']
export const nivelRisco = (prob: unknown, sev: unknown) => {
  const p = parseInt(String(prob ?? '')),
    s = parseInt(String(sev ?? ''))
  return p && s ? p * s : null
}
export const classeRisco = (n: number | null) => (n == null ? '' : n >= 15 ? 'Alto' : n >= 8 ? 'Moderado' : n >= 4 ? 'Baixo' : 'Trivial')

// ── Questionário curto (adaptado de COPSOQ II-Br e HSE). Escala 0–4; (inv) = item positivo, invertido no cálculo.
export const ESCALA_FREQ = ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre']
export const ESCALA_CONC = ['Discordo totalmente', 'Discordo', 'Nem concordo nem discordo', 'Concordo', 'Concordo totalmente']

export type Pergunta = { n: number; texto: string; dim: string; inv?: boolean; escala: 'freq' | 'conc' | 'simnao' }
export const PERGUNTAS: Pergunta[] = [
  { n: 1, dim: 'Exigências quantitativas', escala: 'freq', texto: 'Seu trabalho acumula sem que haja tempo de concluí-lo?' },
  { n: 2, dim: 'Exigências quantitativas', escala: 'freq', texto: 'Você precisa trabalhar muito rápido?' },
  { n: 3, dim: 'Exigências quantitativas', escala: 'freq', texto: 'Você precisa fazer hora extra ou trabalhar fora do horário para cumprir prazos?' },
  { n: 4, dim: 'Exigências emocionais', escala: 'freq', texto: 'Seu trabalho é emocionalmente desgastante?' },
  { n: 5, dim: 'Autonomia', escala: 'freq', inv: true, texto: 'Você tem influência sobre a forma de fazer o seu trabalho?' },
  { n: 6, dim: 'Autonomia', escala: 'freq', inv: true, texto: 'Você pode decidir quando fazer uma pausa?' },
  { n: 7, dim: 'Clareza de papel', escala: 'conc', inv: true, texto: 'Sei exatamente o que se espera de mim no trabalho.' },
  { n: 8, dim: 'Clareza de papel', escala: 'freq', texto: 'Você recebe demandas conflitantes de pessoas diferentes?' },
  { n: 9, dim: 'Subcarga', escala: 'freq', texto: 'Você tem tarefas de menos ou que não usam suas habilidades?' },
  { n: 10, dim: 'Reconhecimento', escala: 'conc', inv: true, texto: 'Meu trabalho é reconhecido e valorizado pela liderança.' },
  { n: 11, dim: 'Reconhecimento', escala: 'conc', inv: true, texto: 'Minha remuneração e minhas oportunidades são justas pelo esforço que faço.' },
  { n: 12, dim: 'Apoio da liderança', escala: 'freq', inv: true, texto: 'Sua liderança ajuda e apoia você quando necessário?' },
  { n: 13, dim: 'Apoio da liderança', escala: 'freq', inv: true, texto: 'Sua liderança dá feedback útil sobre o seu trabalho?' },
  { n: 14, dim: 'Colegas e relacionamentos', escala: 'freq', inv: true, texto: 'Seus colegas ajudam quando você precisa?' },
  { n: 15, dim: 'Colegas e relacionamentos', escala: 'freq', texto: 'Há conflitos ou clima hostil na equipe?' },
  { n: 16, dim: 'Justiça organizacional', escala: 'conc', inv: true, texto: 'Os conflitos são resolvidos de forma justa.' },
  { n: 17, dim: 'Justiça organizacional', escala: 'conc', inv: true, texto: 'Regras, avaliações e promoções são aplicadas igualmente a todos.' },
  { n: 18, dim: 'Gestão de mudanças', escala: 'freq', inv: true, texto: 'Você é consultado e informado sobre mudanças que afetam o seu trabalho?' },
  { n: 19, dim: 'Comunicação e isolamento', escala: 'freq', inv: true, texto: 'Você recebe a tempo as informações de que precisa?' },
  { n: 20, dim: 'Comunicação e isolamento', escala: 'freq', texto: 'Você se sente isolado da equipe (remoto ou trabalhando sozinho)?' },
  { n: 21, dim: 'Trabalho × vida pessoal', escala: 'freq', texto: 'O trabalho consome tanta energia que prejudica sua vida pessoal?' },
  { n: 22, dim: 'Esgotamento', escala: 'freq', texto: 'Com que frequência você se sente física e emocionalmente esgotado?' },
  { n: 23, dim: 'Assédio e violência', escala: 'simnao', texto: 'Nos últimos 12 meses, você sofreu humilhações, cobranças vexatórias ou intimidação no trabalho?' },
  { n: 24, dim: 'Assédio e violência', escala: 'simnao', texto: 'Nos últimos 12 meses, você sofreu ou presenciou assédio sexual ou violência no trabalho?' },
]
/** Dimensão do questionário → fator do MTE (para gerar itens no inventário). */
export const DIM_FATOR: Record<string, string> = {
  'Exigências quantitativas': 'Excesso de demandas (sobrecarga)',
  'Exigências emocionais': 'Excesso de demandas (sobrecarga)',
  Autonomia: 'Baixo controle / falta de autonomia',
  'Clareza de papel': 'Baixa clareza de papel ou função',
  Subcarga: 'Baixa demanda (subcarga)',
  Reconhecimento: 'Baixas recompensas e reconhecimento',
  'Apoio da liderança': 'Falta de suporte no trabalho',
  'Colegas e relacionamentos': 'Maus relacionamentos no trabalho',
  'Justiça organizacional': 'Baixa justiça organizacional',
  'Gestão de mudanças': 'Má gestão de mudanças organizacionais',
  'Comunicação e isolamento': 'Dificuldades de comunicação',
  'Trabalho × vida pessoal': 'Excesso de demandas (sobrecarga)',
  Esgotamento: 'Excesso de demandas (sobrecarga)',
  'Assédio e violência': 'Assédio (moral ou sexual)',
}
export const MIN_RESPOSTAS = 5 // abaixo disso não mostra resultado (anonimato)

// ── Checklist de conformidade (evidências que um auditor pediria)
export const CHECKLIST_NR1: { grupo: string; itens: string[] }[] = [
  {
    grupo: 'PGR e inventário de riscos',
    itens: [
      'Fatores psicossociais incluídos no inventário de riscos do PGR (perigo, grupo exposto, fontes, avaliação, medidas existentes)',
      'Inventário datado e assinado; versão da área de Controladoria/Contabilidade revisada com o SESMT',
      'Critério de avaliação de risco (probabilidade × severidade) documentado',
      'Revisão da avaliação programada (a cada 2 anos ou quando houver mudança, adoecimento ou medida ineficaz)',
    ],
  },
  {
    grupo: 'Metodologia e participação',
    itens: [
      'Metodologia de identificação definida (questionário, grupos focais, entrevistas, indicadores)',
      'Questionário anônimo aplicado, com aviso de privacidade (LGPD) e resultado só por grupo (n ≥ 5)',
      'Evidência de participação dos trabalhadores (convocação, atas, taxa de resposta)',
      'CIPA envolvida na identificação dos riscos e no acompanhamento',
      'AEP/AET (NR-17) considera a organização do trabalho',
    ],
  },
  {
    grupo: 'Plano de ação',
    itens: [
      'Plano de ação com medida, responsável, prazo e indicador de eficácia para cada risco relevante',
      'Acompanhamento periódico do plano registrado (status, evidências)',
      'Resultados comunicados à equipe',
    ],
  },
  {
    grupo: 'Assédio e violência (Lei 14.457/2022)',
    itens: [
      'Política/regras de conduta sobre assédio divulgadas a toda a equipe',
      'Canal de denúncia ativo, com anonimato e procedimento de apuração e sanções',
      'Treinamento anual sobre assédio e violência realizado (lista de presença)',
      'Tema assédio tratado nas reuniões da CIPA (atas)',
    ],
  },
  {
    grupo: 'Saúde, jornada e afastamentos',
    itens: [
      'PCMSO (NR-7) alinhado aos riscos do PGR',
      'Controle de jornada, horas extras e banco de horas acompanhado mensalmente',
      'Férias vencidas e picos de trabalho (fechamento, auditoria) monitorados',
      'Afastamentos e CATs registrados e analisados (sem dados clínicos no sistema)',
      'Canal de apoio psicológico/EAP divulgado à equipe',
    ],
  },
  {
    grupo: 'Liderança e rituais',
    itens: [
      'Líderes treinados em saúde mental, conversas difíceis e prevenção de assédio',
      '1:1 periódicos com pergunta de bem-estar e carga',
      'Planejamento de picos (calendário de fechamento negociado com a matriz)',
      'Campanhas (Janeiro Branco, Setembro Amarelo) no calendário',
    ],
  },
]
export const TOTAL_CHECK_NR1 = CHECKLIST_NR1.reduce((a, g) => a + g.itens.length, 0)

export const INDICADORES_ALERTA = [
  'Exaustão, cansaço que não passa',
  'Queda de desempenho ou erros novos',
  'Cinismo, distanciamento, irritabilidade',
  'Atrasos, faltas e atestados mais frequentes',
  'Isolamento da equipe',
  'Recusa ou adiamento de férias',
  'Trabalho fora do horário de forma constante',
]

export const SITUACAO_JURIDICA = {
  data: '16/10/2026',
  itens: [
    'A Portaria MTE 1.419/2024 incluiu os fatores de risco psicossociais no GRO/PGR (NR-1, cap. 1.5). A Portaria MTE 765/2025 adiou a vigência para 26/05/2026.',
    'Desde 26/05/2026 a obrigação está em vigor: os riscos psicossociais precisam estar no inventário e no plano de ação do PGR.',
    'STF (ADPF 1.316): sanções e multas específicas dos dispositivos psicossociais estão suspensas (liminar de 25/06/2026, prorrogada por mais 90 dias em 24/09/2026, em conciliação). A obrigação de gerir os riscos continua.',
    'Revisão da avaliação: a cada 2 anos (3 anos com sistema de gestão de SST certificado) ou antes, se houver mudança, adoecimento ou medida ineficaz.',
    'O MTE não exige um questionário ou "laudo" específico: o método é livre, mas precisa estar documentado e ter participação dos trabalhadores.',
  ],
  pendentes: 'A confirmar no texto oficial: data exata do fim da 2ª suspensão do STF e valores de multa da NR-28 em 2026.',
  fontes: [
    { t: 'CBIC — MTE prorroga gestão dos riscos psicossociais para maio/2026', u: 'https://cbic.org.br/radar-trabalhista-mte-prorroga-gestao-dos-riscos-psicossociais-para-maio-de-2026/' },
    { t: 'TRT-13 — STF suspende por 90 dias sanções da NR-1 (psicossociais)', u: 'https://www.trt13.jus.br/informe-se/noticias/stf-suspende-por-90-dias-a-aplicacao-de-sancoes-da-nr-1-relativas-aos-riscos-psicossociais' },
    { t: 'CBIC — Manual de interpretação do capítulo 1.5 (mar/2026)', u: 'https://cbic.org.br/mte-lanca-manual-para-orientar-gestao-de-riscos-ocupacionais-nas-empresas/' },
    { t: 'COPSOQ II — versão curta brasileira (Rev. Saúde Pública 2021)', u: 'https://scielosp.org/article/rsp/2021.v55/69' },
    { t: 'Lei 14.831/2024 — Certificado Empresa Promotora da Saúde Mental', u: 'https://legis.senado.leg.br/norma/38286747/publicacao/38287501' },
  ],
}

export const CAMPANHAS = [
  { mes: 1, nome: 'Janeiro Branco', tema: 'Saúde mental e emocional' },
  { mes: 4, nome: 'Abril Verde', tema: 'Segurança e saúde no trabalho (28/04)' },
  { mes: 5, nome: 'Maio Amarelo / 18 de maio', tema: 'Luta antimanicomial' },
  { mes: 9, nome: 'Setembro Amarelo', tema: 'Prevenção do suicídio' },
  { mes: 10, nome: '10 de outubro', tema: 'Dia Mundial da Saúde Mental' },
]
