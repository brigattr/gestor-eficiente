// Dados de exemplo (fictícios) para explorar o sistema no primeiro acesso.
// Podem ser apagados em Configurações → "Apagar todos os dados".
import { addDays, iso, startOfWeek } from '../lib/format'
import type { DB, Item } from './store'

export function buildSeed(): DB {
  const t = new Date()
  const d = (k: number) => iso(addDays(t, k))
  const Y = t.getFullYear()
  const M = t.getMonth() + 1
  const mon = startOfWeek(t)
  const w = (k: number) => iso(addDays(mon, k))
  const ym = (offset: number) => {
    const x = new Date(Y, M - 1 + offset, 1)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`
  }

  const cargos: Item[] = [
    { id: 'cg1', titulo: 'Analista Contábil', nivel: 'Pleno', grade: 'G08', faixaMin: 6500, faixaMid: 7800, faixaMax: 9100, requisitos: 'IFRS Fundamentos\nCompliance Anticorrupção\nSAP FI', beneficios: 'VR/VA, saúde, PLR' },
    { id: 'cg2', titulo: 'Analista de Custos', nivel: 'Sênior', grade: 'G10', faixaMin: 9000, faixaMid: 10800, faixaMax: 12600, requisitos: 'SAP CO\nCompliance Anticorrupção\nExcel Avançado', beneficios: 'VR/VA, saúde, PLR' },
    { id: 'cg3', titulo: 'Analista Fiscal', nivel: 'Pleno', grade: 'G08', faixaMin: 6500, faixaMid: 7800, faixaMax: 9100, requisitos: 'Reforma Tributária (CBS/IBS)\nCompliance Anticorrupção', beneficios: 'VR/VA, saúde, PLR' },
    { id: 'cg4', titulo: 'Coordenador de Controladoria', nivel: 'Coordenação', grade: 'G12', faixaMin: 14000, faixaMid: 16500, faixaMax: 19000, requisitos: 'IFRS Avançado\nCompliance Anticorrupção\nLiderança', beneficios: 'VR/VA, saúde, PLR, carro' },
    { id: 'cg5', titulo: 'Analista FP&A', nivel: 'Júnior', grade: 'G06', faixaMin: 4800, faixaMid: 5600, faixaMax: 6400, requisitos: 'Excel Avançado\nCompliance Anticorrupção', beneficios: 'VR/VA, saúde, PLR' },
  ]
  const cc: Item[] = [
    { id: 'cc1', codigo: 'BR10-4100', nome: 'Controladoria', gestor: 'Eu', empresa: 'BR10', ativo: true },
    { id: 'cc2', codigo: 'BR10-4110', nome: 'Contabilidade & Fiscal', gestor: 'Eu', empresa: 'BR10', ativo: true },
    { id: 'cc3', codigo: 'BR10-4120', nome: 'Custos & FP&A', gestor: 'Eu', empresa: 'BR10', ativo: true },
  ]
  const pessoas: Item[] = [
    { id: 'p1', nome: 'Ana Ribeiro', cargo: 'cg4', area: 'Controladoria', centroCusto: 'cc1', admissao: '2019-03-11', salario: 17200, status: 'Ativo', email: 'ana.ribeiro@empresa.com' },
    { id: 'p2', nome: 'Bruno Carvalho', cargo: 'cg2', area: 'Custos', centroCusto: 'cc3', admissao: '2021-08-02', salario: 10100, status: 'Ativo' },
    { id: 'p3', nome: 'Camila Duarte', cargo: 'cg1', area: 'Contabilidade', centroCusto: 'cc2', admissao: '2022-01-17', salario: 8300, status: 'Ativo' },
    { id: 'p4', nome: 'Diego Nunes', cargo: 'cg3', area: 'Fiscal', centroCusto: 'cc2', admissao: '2023-05-08', salario: 6900, status: 'Ativo' },
    { id: 'p5', nome: 'Elisa Moraes', cargo: 'cg5', area: 'FP&A', centroCusto: 'cc3', admissao: d(-20), salario: 5400, status: 'Ativo' },
    { id: 'p6', nome: 'Felipe Andrade', cargo: 'cg1', area: 'Contabilidade', centroCusto: 'cc2', admissao: '2020-10-05', salario: 9300, status: 'Ativo' },
  ]

  const competencias: Item[] = [
    { id: 'c1', nome: 'IFRS / CPC', tipo: 'Técnica', descricao: 'Aplica normas contábeis e explica impactos para a gestão.' },
    { id: 'c2', nome: 'Análise e storytelling de números', tipo: 'Técnica', descricao: 'Transforma variações em mensagem clara para a diretoria e a matriz.' },
    { id: 'c3', nome: 'Comunicação', tipo: 'Comportamental', descricao: 'Clareza, escuta e alinhamento com áreas parceiras.' },
    { id: 'c4', nome: 'Autonomia e dono do processo', tipo: 'Comportamental', descricao: 'Resolve, propõe e antecipa riscos sem depender de validação.' },
    { id: 'c5', nome: 'Entrega no prazo do fechamento', tipo: 'Resultado', descricao: 'Cumpre o calendário de fechamento e reporting.' },
  ]
  const mapa: Item[] = [
    ['p2', 'c2', 3, 4], ['p2', 'c4', 4, 4], ['p3', 'c1', 2, 4], ['p3', 'c3', 3, 4], ['p4', 'c1', 2, 3], ['p4', 'c5', 3, 4], ['p6', 'c2', 2, 4], ['p6', 'c4', 4, 4], ['p1', 'c3', 4, 5], ['p5', 'c2', 2, 3],
  ].map(([p, c, a, e], i) => ({ id: 'mc' + i, colaborador: p, competencia: c, atual: a, esperado: e, ciclo: String(Y), avaliador: '90°' }))

  const incentivos: Item[] = [
    { id: 'in1', colaborador: 'p1', ano: Y, meta: 'Fechamento contábil em D+4', categoria: 'Processo', peso: 30, alvo: 'D+4 em 10 de 12 meses', atingimento: 80, prazo: `${Y}-12-31`, status: 'No prazo', entregavel: 'Calendário de fechamento cumprido' },
    { id: 'in2', colaborador: 'p1', ano: Y, meta: 'Implantar conciliação automática de bancos', categoria: 'Processo', peso: 30, alvo: '100% das contas', atingimento: 50, prazo: d(70), status: 'Atenção', entregavel: 'Go-live + 2 fechamentos estáveis' },
    { id: 'in3', colaborador: 'p1', ano: Y, meta: 'EBIT vs budget', categoria: 'Financeira', peso: 40, alvo: '100% do budget', atingimento: 95, prazo: `${Y}-12-31`, status: 'No prazo' },
    { id: 'in4', colaborador: 'p2', ano: Y, meta: 'Revisão do custo padrão', categoria: 'Financeira', peso: 50, alvo: 'Desvio < 2%', atingimento: 70, prazo: d(40), status: 'No prazo' },
    { id: 'in5', colaborador: 'p2', ano: Y, meta: 'Dashboard de margem por produto', categoria: 'Processo', peso: 30, alvo: 'Publicado e usado no S&OP', atingimento: 40, prazo: d(55), status: 'Atenção' },
    { id: 'in6', colaborador: 'p4', ano: Y, meta: 'Preparar apuração CBS/IBS (transição)', categoria: 'Compliance', peso: 60, alvo: 'Parametrização testada', atingimento: 30, prazo: d(25), status: 'Crítico' },
  ]

  const objetivos: Item[] = [
    { id: 'o1', titulo: 'Ser um parceiro de negócio confiável e rápido', nivel: 'Área', dono: 'Eu', ciclo: `${Y}-T${Math.floor((M - 1) / 3) + 1}` },
    { id: 'o2', titulo: 'Fechamento mais rápido e sem retrabalho', nivel: 'Equipe', pai: 'o1', dono: 'Ana Ribeiro', ciclo: `${Y}-T${Math.floor((M - 1) / 3) + 1}` },
    { id: 'o3', titulo: 'Time preparado para a Reforma Tributária', nivel: 'Equipe', pai: 'o1', dono: 'Diego Nunes', ciclo: `${Y}-T${Math.floor((M - 1) / 3) + 1}` },
  ]
  const krs: Item[] = [
    { id: 'k1', objetivo: 'o2', titulo: 'Reduzir fechamento de D+7 para D+4', inicial: 7, alvo: 4, atual: 5, unidade: 'dias', confianca: 'Média', prazo: d(80) },
    { id: 'k2', objetivo: 'o2', titulo: 'Zerar ajustes de auditoria materiais', inicial: 3, alvo: 0, atual: 1, unidade: 'ajustes', confianca: 'Alta', prazo: d(80) },
    { id: 'k3', objetivo: 'o1', titulo: 'Pacote gerencial entregue até D+5', inicial: 60, alvo: 100, atual: 85, unidade: '%', confianca: 'Alta', prazo: d(80) },
    { id: 'k4', objetivo: 'o3', titulo: 'Treinar 100% do time em CBS/IBS', inicial: 0, alvo: 100, atual: 40, unidade: '%', confianca: 'Baixa', prazo: d(45), checkin: 'Material ainda não validado com consultoria.' },
  ]

  const projetos: Item[] = [
    { id: 'pr1', nome: 'Conciliação bancária automática', responsavel: 'p1', sponsor: 'CFO', inicio: d(-60), fim: d(70), status: 'Em andamento', progresso: 55, horasPlan: 320, horasReal: 210, custoPlan: 80000, custoReal: 52000, noIncentive: true, incentivo: 'in2', okr: 'k1', escopo: 'O quê: robô de conciliação de 14 contas bancárias.\nComo: regra no ERP + exceções em lista.' },
    { id: 'pr2', nome: 'Revisão do custo padrão', responsavel: 'p2', sponsor: 'Diretor Industrial', inicio: d(-30), fim: d(40), status: 'Em andamento', progresso: 60, horasPlan: 160, horasReal: 120, custoPlan: 0, custoReal: 0, noIncentive: true, incentivo: 'in4' },
    { id: 'pr3', nome: 'Parametrização CBS/IBS', responsavel: 'p4', sponsor: 'CFO', inicio: d(-15), fim: d(25), status: 'Em risco', progresso: 30, horasPlan: 200, horasReal: 90, custoPlan: 45000, custoReal: 38000, noIncentive: true, incentivo: 'in6', okr: 'k4', riscos: 'Dependência do fornecedor do ERP.' },
    { id: 'pr4', nome: 'Manual de fechamento e RACI', responsavel: 'p3', inicio: d(5), fim: d(60), status: 'Planejado', progresso: 0, horasPlan: 60, horasReal: 0, noIncentive: false },
  ]

  const tarefas: Item[] = [
    { titulo: 'Revisar provisão de férias e 13º', responsavel: 'p6', lista: 'Fechamento', prazo: d(2), status: 'Em andamento', g: 4, u: 5, t: 3 },
    { titulo: 'Enviar reporting package para a matriz', responsavel: 'p1', lista: 'Reporting matriz', prazo: d(4), status: 'A fazer', g: 5, u: 5, t: 4, delegacao: 'Delegada – aceita' },
    { titulo: 'Validar regras de conciliação com TI', responsavel: 'p1', projeto: 'pr1', prazo: d(-1), status: 'A fazer', g: 4, u: 4, t: 4 },
    { titulo: 'Levantar NCMs impactados', responsavel: 'p4', projeto: 'pr3', prazo: d(6), status: 'Em andamento', g: 5, u: 4, t: 5 },
    { titulo: 'Atualizar rateio de overhead', responsavel: 'p2', projeto: 'pr2', prazo: d(9), status: 'A fazer', g: 3, u: 3, t: 3, delegacao: 'Delegada – pendente' },
    { titulo: 'Responder auditoria – carta de circularização', responsavel: 'p3', lista: 'Auditoria', prazo: d(12), status: 'Aguardando terceiros', g: 3, u: 2, t: 2 },
    { titulo: 'Preparar comentários de variação budget × real', lista: 'Fechamento', prazo: d(3), status: 'A fazer', g: 4, u: 5, t: 3, delegacao: 'Minha' },
    { titulo: 'Mapear etapas do fechamento (RACI)', responsavel: 'p3', projeto: 'pr4', prazo: d(15), status: 'A fazer', g: 2, u: 2, t: 3 },
    { titulo: 'Fechar intercompany com Alemanha', responsavel: 'p6', lista: 'Fechamento', prazo: d(-5), status: 'Concluída', g: 4, u: 4, t: 3 },
  ].map((x, i) => ({ id: 't' + i, ...x }))

  const reunioes: Item[] = [
    { titulo: 'Status semanal do time', data: w(0), hora: '09:00', tipo: 'Status do time', participantes: 'Time Controladoria', roteiro: 'Reunião de Status', preparado: false, pauta: 'Prioridades do fechamento; riscos CBS/IBS' },
    { titulo: '1:1 Bruno', data: w(1), hora: '10:00', tipo: '1:1', participantes: 'Bruno Carvalho', roteiro: 'Gestão', preparado: false },
    { titulo: 'Monthly review com a matriz', data: w(2), hora: '08:00', tipo: 'Matriz (Alemanha)', participantes: 'Group Controlling', pauta: 'Variações relevantes; forecast Q4', materiais: 'Pacote gerencial do mês\nBridge EBIT', preparado: false },
    { titulo: 'Comitê de investimentos', data: w(3), hora: '14:00', tipo: 'Comitê / Diretoria', participantes: 'Diretoria', pauta: 'Business case conciliação automática', preparado: true },
    { titulo: '1:1 Diego', data: w(4), hora: '11:00', tipo: '1:1', participantes: 'Diego Nunes', roteiro: 'Delegação', preparado: false },
    { titulo: 'Kick-off manual de fechamento', data: w(8), hora: '15:00', tipo: 'Projeto', participantes: 'Camila, Felipe', preparado: false },
  ].map((x, i) => ({ id: 'r' + i, ...x }))

  const budget: Item[] = []
  const despesas: Item[] = []
  const base: Record<string, Record<string, number>> = {
    cc1: { Pessoal: 62000, Viagens: 6000, Treinamento: 3000, 'Consultoria/Serviços': 12000, 'TI/Software': 4000, Auditoria: 9000 },
    cc2: { Pessoal: 48000, Viagens: 1500, Treinamento: 2500, 'Consultoria/Serviços': 7000, 'TI/Software': 2000, Materiais: 800 },
    cc3: { Pessoal: 41000, Viagens: 2500, Treinamento: 2000, 'Consultoria/Serviços': 5000, 'TI/Software': 3500 },
  }
  let k = 0
  for (const [c, contas] of Object.entries(base)) {
    for (const [conta, v] of Object.entries(contas)) {
      for (let m = 1; m <= 12; m++) {
        budget.push({ id: 'b' + k++, centroCusto: c, ano: Y, mes: String(m), conta, valor: v })
        if (m < M) {
          const noise = 0.85 + (((m * 7 + conta.length * 13 + c.length) % 30) / 100)
          despesas.push({ id: 'e' + k++, centroCusto: c, ano: Y, mes: String(m), conta, descricao: conta === 'Pessoal' ? 'Folha + encargos' : `${conta} – lançamentos do mês`, valor: Math.round(v * noise), fornecedor: conta === 'Auditoria' ? 'Auditoria externa' : '' })
        }
      }
    }
  }
  despesas.push({ id: 'e' + k++, centroCusto: 'cc1', ano: Y, mes: String(Math.max(1, M - 1)), conta: 'TI/Software', descricao: 'Licenças ferramenta de conciliação', fornecedor: 'Software Ltda', quantidade: 5, valorUnit: 1800, valor: 9000, documento: 'NF 12345', po: '4500012345' })

  const ferias: Item[] = [
    { id: 'f1', colaborador: 'p2', inicio: d(18), fim: d(32), dias: 15, aquisitivoInicio: `${Y - 1}-08-02`, aquisitivoFim: `${Y}-08-01`, limite: `${Y + 1}-07-01`, status: 'Aprovada' },
    { id: 'f2', colaborador: 'p3', inicio: d(45), fim: d(64), dias: 20, abono: 10, limite: d(120), status: 'Solicitada' },
    { id: 'f3', colaborador: 'p6', limite: d(50), status: 'Planejada', obs: 'Precisa programar — limite concessivo próximo' },
    { id: 'f4', colaborador: 'p1', inicio: d(70), fim: d(84), dias: 15, limite: d(200), status: 'Planejada' },
  ]
  const exames: Item[] = [
    { id: 'x1', colaborador: 'p2', tipo: 'Periódico', ultimo: d(-350), proximo: d(15), status: 'A agendar' },
    { id: 'x2', colaborador: 'p3', tipo: 'Periódico', ultimo: d(-200), proximo: d(165), status: 'Realizado' },
    { id: 'x3', colaborador: 'p6', tipo: 'Periódico', ultimo: d(-370), proximo: d(-5), status: 'A agendar' },
  ]
  const certificacoes: Item[] = [
    { id: 'ce1', colaborador: 'p1', nome: 'Compliance Anticorrupção', tipo: 'Obrigatório/Compliance', realizado: d(-300), validade: d(65) },
    { id: 'ce2', colaborador: 'p1', nome: 'IFRS Avançado', tipo: 'Certificação', realizado: '2024-06-10' },
    { id: 'ce3', colaborador: 'p2', nome: 'SAP CO', tipo: 'Curso', realizado: '2023-02-01' },
    { id: 'ce4', colaborador: 'p2', nome: 'Compliance Anticorrupção', tipo: 'Obrigatório/Compliance', realizado: d(-380), validade: d(-15) },
    { id: 'ce5', colaborador: 'p3', nome: 'Compliance Anticorrupção', tipo: 'Obrigatório/Compliance', realizado: d(-100), validade: d(265) },
    { id: 'ce6', colaborador: 'p4', nome: 'Reforma Tributária (CBS/IBS)', tipo: 'Curso', realizado: d(-40), custo: 1900 },
  ]
  const ocorrencias: Item[] = [
    { id: 'oc1', colaborador: 'p2', data: d(-12), tipo: 'Positiva', motivo: 'Entrega acima do esperado', descricao: 'Antecipou análise de margem para o S&OP.', autor: 'Eu' },
    { id: 'oc2', colaborador: 'p6', data: d(-25), tipo: 'Negativa', motivo: 'Prazo', descricao: 'Intercompany entregue com 1 dia de atraso, sem aviso prévio.', autor: 'Eu' },
  ]
  const avaliacoes: Item[] = [
    { id: 'a1', colaborador: 'p1', ciclo: String(Y), tipo: '180°', desempenho: 5, competencias: 4, potencial: 'Alto', status: 'Em andamento', prazo: d(35), movimentacao: 'Promoção' },
    { id: 'a2', colaborador: 'p2', ciclo: String(Y), tipo: '90°', desempenho: 4, competencias: 4, potencial: 'Alto', status: 'Em andamento', prazo: d(35), movimentacao: 'Mérito' },
    { id: 'a3', colaborador: 'p3', ciclo: String(Y), tipo: '90°', desempenho: 3, competencias: 3, potencial: 'Médio', status: 'Não iniciada', prazo: d(35) },
    { id: 'a4', colaborador: 'p4', ciclo: String(Y), tipo: '90°', desempenho: 3, competencias: 3, potencial: 'Alto', status: 'Não iniciada', prazo: d(35), movimentacao: 'PDI intensivo' },
    { id: 'a5', colaborador: 'p6', ciclo: String(Y), tipo: '90°', desempenho: 2, competencias: 3, potencial: 'Médio', status: 'Não iniciada', prazo: d(35), movimentacao: 'Plano de melhoria' },
  ]
  const pdis: Item[] = [
    { id: 'pd1', colaborador: 'p3', competencia: 'c1', oque: 'Curso IFRS 16 e 15', porque: 'Gap 2 níveis em IFRS', onde: 'Online', inicio: d(-10), quando: d(50), quem: 'Ana Ribeiro', como: 'Curso + aplicar no fechamento de arrendamentos', quanto: 2400, status: 'Em andamento' },
    { id: 'pd2', colaborador: 'p6', competencia: 'c2', oque: 'Apresentar a variação de despesas no status mensal', porque: 'Desenvolver storytelling', onde: 'Status do time', inicio: d(0), quando: d(30), quem: 'Eu', como: 'Prepara, ensaia comigo, apresenta', quanto: 0, status: 'A fazer' },
    { id: 'pd3', colaborador: 'p4', competencia: 'c5', oque: 'Checklist fiscal do fechamento', porque: 'Reduzir atrasos', inicio: d(-5), quando: d(20), quem: 'Camila Duarte', como: 'Montar e usar por 2 meses', status: 'Em andamento' },
  ]
  const onboarding: Item[] = [
    ['Pré-admissão', 'Solicitar notebook e acessos ERP/BI', 'TI', -25, 'Concluída'],
    ['Dia 1', 'Boas-vindas e apresentação do time', 'Eu', -20, 'Concluída'],
    ['Semana 1', 'Treinamento compliance e políticas do grupo', 'RH', -14, 'Concluída'],
    ['Mês 1', 'Acompanhar 1 fechamento completo com padrinho', 'Bruno Carvalho', 8, 'Em andamento'],
    ['90 dias', 'Avaliação de experiência', 'Eu', 70, 'Pendente'],
  ].map(([fase, etapa, resp, off, st], i) => ({ id: 'ob' + i, colaborador: 'p5', fase, etapa, responsavel: resp, prazo: d(off as number), status: st }))
  const feedbacks: Item[] = [
    { id: 'fb1', colaborador: 'p2', data: d(-12), tipo: 'Reconhecimento', situacao: 'S&OP de setembro', comportamento: 'Trouxe análise de margem antes de ser pedido', impacto: 'Diretoria decidiu o mix com base nos números', proximo: 'Apresentar no próximo S&OP', publico: true },
  ]
  const ponto: Item[] = pessoas.map((p, i) => ({ id: 'pt' + i, colaborador: p.id, competencia: ym(-1), status: i < 4 ? 'Aprovado' : 'Pendente', horasExtras: [4, 0, 6, 2, 0, 8][i], faltas: 0, prazo: d(2) }))
  const vagas: Item[] = [{ id: 'v1', titulo: 'Analista Contábil Pl – Ativo Fixo', cargo: 'cg1', motivo: 'Aumento de quadro', status: 'Entrevistas', abertura: d(-30), prazo: d(20), recrutador: 'HRBP Finanças' }]
  const candidatos: Item[] = [
    { id: 'cd1', nome: 'Candidato A', vaga: 'v1', etapa: 'Entrevista gestor', nota: 4, entrevista: d(3) },
    { id: 'cd2', nome: 'Candidato B', vaga: 'v1', etapa: 'Case técnico', nota: 3, entrevista: d(5) },
    { id: 'cd3', nome: 'Candidato C', vaga: 'v1', etapa: 'Triagem' },
  ]
  const treinoInterno: Item[] = [
    { id: 'ti1', tema: 'CBS/IBS na prática para o time', instrutor: 'p4', preparo: d(10), data: d(21), cargaHoraria: 2, status: 'Em preparação', convidados: ['p1', 'p2', 'p3', 'p5', 'p6'], presentes: [] },
    { id: 'ti2', tema: 'Custo padrão e variações', instrutor: 'p2', data: d(-15), cargaHoraria: 1.5, status: 'Realizado', convidados: ['p1', 'p3', 'p4', 'p5', 'p6'], presentes: ['p1', 'p3', 'p5', 'p6'], anotacoes: 'Repetir para Vendas.' },
  ]
  const swot: Item[] = [
    ['Forças', 'Time técnico sênior em custos', 4],
    ['Fraquezas', 'Fechamento depende de planilhas manuais', 5],
    ['Oportunidades', 'Automação de conciliações', 5],
    ['Ameaças', 'Prazo da Reforma Tributária', 4],
  ].map(([q, it, imp], i) => ({ id: 's' + i, tema: 'Controladoria', quadrante: q, item: it, impacto: imp }))
  const umaum: Item[] = [{ id: 'u1', colaborador: 'p2', data: d(-14), roteiro: 'Gestão', humor: 4, acordos: 'Assumir apresentação de margem no S&OP.', proxima: w(1) }]

  return {
    cargos, centrosCusto: cc, pessoas, competencias, mapaCompetencias: mapa, incentivos, objetivos, krs, projetos, tarefas, reunioes,
    budget, despesas, ferias, exames, certificacoes, ocorrencias, avaliacoes, pdis, onboarding, feedbacks, ponto, vagas, candidatos,
    treinoInterno, swot, umaum,
  }
}
