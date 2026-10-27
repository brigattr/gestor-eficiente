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
    { id: 'p1', genero: 'Feminino', perfilDisc: 'DC', nascimento: `1984-${String(M).padStart(2, '0')}-22`, nome: 'Ana Ribeiro', cargo: 'cg4', area: 'Controladoria', centroCusto: 'cc1', admissao: '2019-03-11', salario: 17200, status: 'Ativo', email: 'ana.ribeiro@empresa.com' },
    { id: 'p2', gestor: 'p1', genero: 'Masculino', perfilDisc: 'C – Conformidade', nascimento: '1990-03-14', nome: 'Bruno Carvalho', cargo: 'cg2', area: 'Custos', centroCusto: 'cc3', admissao: '2021-08-02', salario: 10100, status: 'Ativo' },
    { id: 'p3', gestor: 'p1', genero: 'Feminino', perfilDisc: 'SC', nascimento: `1993-${String(M).padStart(2, '0')}-05`, nome: 'Camila Duarte', cargo: 'cg1', area: 'Contabilidade', centroCusto: 'cc2', admissao: '2022-01-17', salario: 8300, status: 'Ativo' },
    { id: 'p4', gestor: 'p1', genero: 'Masculino', perfilDisc: 'DI', nascimento: '1996-11-30', nome: 'Diego Nunes', cargo: 'cg3', area: 'Fiscal', centroCusto: 'cc2', admissao: '2023-05-08', salario: 6900, status: 'Ativo' },
    { id: 'p5', gestor: 'p2', genero: 'Feminino', perfilDisc: 'IS', nascimento: '2000-07-19', nome: 'Elisa Moraes', cargo: 'cg5', area: 'FP&A', centroCusto: 'cc3', admissao: d(-20), salario: 5400, status: 'Ativo' },
    { id: 'p6', gestor: 'p3', genero: 'Masculino', perfilDisc: 'S – Estabilidade', nascimento: '1988-01-09', nome: 'Felipe Andrade', cargo: 'cg1', area: 'Contabilidade', centroCusto: 'cc2', admissao: '2020-10-05', salario: 9300, status: 'Ativo' },
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

  // Estrutura igual ao formulário Incentive/KPI do SuccessFactors (valores fictícios)
  const incentivos: Item[] = [
    { id: 'in1', ano: Y, meta: 'EBITDA AOR', peso: 10, metrica: 'kEUR', sentido: 'Maior é melhor', v50: 4800, v100: 6000, v150: 7200, real: 5750, detalhes: `AOR EBITDA ${Y}\nEntidade A kEUR 1.050\nEntidade B kEUR 3.380\nEntidade C kEUR 1.570\nTTL kEUR 6.000`, descricao: 'Budget do KPI como 100%. 80% do target paga 50% e 120% paga 150% de bônus.', status: 'No prazo', prazo: `${Y}-12-31` },
    { id: 'in2', ano: Y, meta: 'Working Capital Turn AOR', peso: 10, metrica: 'vezes', sentido: 'Maior é melhor', v100: 5.0, real: 5.2, detalhes: 'Receita líquida ÷ capital de giro médio (AOR)', status: 'No prazo', prazo: `${Y}-12-31` },
    { id: 'in3', ano: Y, meta: 'Financial Process KPIs (OTC, PTP, BTR) AOR / Projects', peso: 80, descricao: 'Média ponderada dos sub-KPIs de processo e projetos.', status: 'Atenção', prazo: `${Y}-12-31` },
    { id: 'in31', ano: Y, pai: 'in3', meta: 'OTC – DSO', peso: 30, metrica: 'dias', sentido: 'Menor é melhor', v100: 45, real: 47 },
    { id: 'in32', ano: Y, pai: 'in3', meta: 'PTP – pagamentos no prazo', peso: 30, metrica: '%', sentido: 'Maior é melhor', v50: 90, v100: 95, v150: 99, real: 96 },
    { id: 'in33', ano: Y, pai: 'in3', meta: 'BTR – fechamento em D+', peso: 20, metrica: 'dias', sentido: 'Menor é melhor', v50: 6, v100: 4, v150: 3, real: 5 },
    { id: 'in34', ano: Y, pai: 'in3', meta: 'Projeto: conciliação bancária automática', peso: 20, bonusManual: 100, descricao: 'Go-live + 2 fechamentos estáveis' },
    { id: 'in4', colaborador: 'p1', ano: Y, meta: 'Fechamento contábil em D+4', peso: 50, metrica: 'dias', sentido: 'Menor é melhor', v50: 6, v100: 4, v150: 3, real: 5, status: 'Atenção', prazo: `${Y}-12-31` },
    { id: 'in5', colaborador: 'p1', ano: Y, meta: 'Implantar conciliação automática de bancos', peso: 50, bonusManual: 50, status: 'Atenção', prazo: d(70), descricao: '100% das contas conciliadas automaticamente' },
    { id: 'in6', colaborador: 'p2', ano: Y, meta: 'Revisão do custo padrão – desvio', peso: 60, metrica: '%', sentido: 'Menor é melhor', v50: 3, v100: 2, v150: 1, real: 2.4, prazo: d(40) },
    { id: 'in7', colaborador: 'p2', ano: Y, meta: 'Dashboard de margem por produto', peso: 20, bonusManual: 50, status: 'Atenção', prazo: d(55) },
    { id: 'in8', colaborador: 'p4', ano: Y, meta: 'Preparar apuração CBS/IBS (transição)', peso: 100, bonusManual: 30, status: 'Crítico', prazo: d(25) },
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
    { id: 'pr1', nome: 'Conciliação bancária automática', responsavel: 'p1', sponsor: 'CFO', inicio: d(-60), fim: d(70), status: 'Em andamento', progresso: 55, horasPlan: 320, horasReal: 210, custoPlan: 80000, custoReal: 52000, noIncentive: true, incentivo: 'in34', okr: 'k1', escopo: 'O quê: robô de conciliação de 14 contas bancárias.\nComo: regra no ERP + exceções em lista.' },
    { id: 'pr2', nome: 'Revisão do custo padrão', responsavel: 'p2', sponsor: 'Diretor Industrial', inicio: d(-30), fim: d(40), status: 'Em andamento', progresso: 60, horasPlan: 160, horasReal: 120, custoPlan: 0, custoReal: 0, noIncentive: true, incentivo: 'in6' },
    { id: 'pr3', nome: 'Parametrização CBS/IBS', responsavel: 'p4', sponsor: 'CFO', inicio: d(-15), fim: d(25), status: 'Em risco', progresso: 30, horasPlan: 200, horasReal: 90, custoPlan: 45000, custoReal: 38000, noIncentive: true, incentivo: 'in8', okr: 'k4', riscos: 'Dependência do fornecedor do ERP.' },
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

  // Tickets fictícios no formato da lista Tickets_Header (SharePoint)
  const tipos = ['[Financeiro] Análise de crédito', '[Contábil] Lançamento manual', '[Fiscal] Dúvida tributária', '[Custos] Revisão de custo', '[Financeiro] Cadastro de fornecedor']
  const solic = ['Wenzel, A.', 'Secco, J.', 'Rosa, W.', 'Santos, T.', 'Caldeira, S.', 'Mendes, T.']
  const analistas = ['Camila Duarte', 'Felipe Andrade', 'Diego Nunes', 'Bruno Carvalho']
  const areas = ['Comercial', 'Compras', 'Supply Chain', 'RH', 'Produção']
  const prios = ['Baixa', 'Baixa', 'Média', 'Alta']
  const pad = (x: number) => String(x).padStart(2, '0')
  const dt = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`
  const tickets: Item[] = Array.from({ length: 64 }, (_, i) => {
    const r = (k: number) => ((i + 1) * 9301 + k * 49297) % 233280 / 233280
    const criado = addDays(t, -Math.floor(r(1) * 150))
    criado.setHours(8 + Math.floor(r(2) * 9), Math.floor(r(3) * 60))
    const ti = Math.floor(r(4) * tipos.length)
    const fechado = r(5) < 0.78 ? addDays(criado, Math.ceil(r(6) * (ti === 0 ? 3 : 7))) : null
    const ok = fechado && fechado < t
    return {
      id: String(100 + i),
      titulo: ti === 0 ? 'New Analise de Credito Request' : `${tipos[ti].replace(/^\[[^\]]+\] /, '')} – solicitação ${100 + i}`,
      descricao: tipos[ti],
      empresa: r(7) < 0.7 ? 'N/A' : 'Entidade B',
      area: areas[Math.floor(r(8) * areas.length)],
      solicitante: solic[Math.floor(r(9) * solic.length)],
      prioridade: prios[Math.floor(r(10) * prios.length)],
      status: ok ? 'Concluído' : r(11) < 0.5 ? 'Novo' : 'Em andamento',
      tipo: tipos[ti],
      equipe: ti === 2 ? 'Fiscal' : ti === 1 ? 'Contabilidade' : 'Financeiro',
      analista: r(12) < 0.85 ? analistas[Math.floor(r(13) * analistas.length)] : null,
      criado: dt(criado),
      modificado: dt(ok ? fechado! : t),
      fechado: ok ? dt(fechado!) : null,
    }
  })

  // Etiquetas de exemplo e alguns itens marcados
  const etiquetas: Item[] = [
    { id: 'tg1', nome: 'Reforma Tributária', cor: 'Laranja', descricao: 'Tudo da transição CBS/IBS' },
    { id: 'tg2', nome: 'Matriz', cor: 'Azul', descricao: 'Pedidos e reportes para o grupo' },
    { id: 'tg3', nome: 'Auditoria 2026', cor: 'Roxo', descricao: 'Pendências com a auditoria externa' },
  ]
  const marcar = (rows: Item[], ids: string[], tag: string) => rows.filter((r) => ids.includes(r.id)).forEach((r) => (r.etiquetas = [...((r.etiquetas as string[]) ?? []), tag]))
  marcar(projetos, ['pr3'], 'tg1')
  marcar(tarefas, ['t3'], 'tg1')
  marcar(krs, ['k4'], 'tg1')
  marcar(treinoInterno, ['ti1'], 'tg1')
  marcar(incentivos, ['in8'], 'tg1')
  marcar(tarefas, ['t1'], 'tg2')
  marcar(reunioes, ['r2'], 'tg2')
  marcar(incentivos, ['in1', 'in2'], 'tg2')
  marcar(tarefas, ['t5'], 'tg3')
  marcar(projetos, ['pr4'], 'tg3')

  const demo = demoPlataforma(d, ym, Y, M)

  return {
    ...demo,
    etiquetas,
    tickets,
    cargos, centrosCusto: cc, pessoas, competencias, mapaCompetencias: mapa, incentivos, objetivos, krs, projetos, tarefas, reunioes,
    budget, despesas, ferias, exames, certificacoes, ocorrencias, avaliacoes, pdis, onboarding, feedbacks, ponto, vagas, candidatos,
    treinoInterno, swot, umaum,
  }
}

/** Exemplos dos módulos da plataforma (cultura, comunicação, processos, NR-1, anotações) — tudo fictício. */
function demoPlataforma(d: (k: number) => string, ym: (o: number) => string, Y: number, M: number): DB {
  const semana = (k: number) => {
    const x = new Date()
    x.setDate(x.getDate() + k * 7)
    const t = new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()))
    const dia = t.getUTCDay() || 7
    t.setUTCDate(t.getUTCDate() + 4 - dia)
    const ano = t.getUTCFullYear()
    return `${ano}-W${String(Math.ceil(((t.getTime() - Date.UTC(ano, 0, 1)) / 86400000 + 1) / 7)).padStart(2, '0')}`
  }
  const humor: Item[] = []
  const notas = [[4, 4, 3, 5, 4, 3], [3, 4, 3, 4, 2, 3], [4, 5, 4, 4, 3, 4], [3, 3, 2, 4, 3, 3], [4, 4, 4, 5, 4, 3], [5, 4, 4, 4, 3, 4]]
  notas.forEach((ns, i) => ns.forEach((n, k) => humor.push({ id: `hm${i}${k}`, semana: semana(i - notas.length + 1), nota: n, _created: d(-7 * (notas.length - 1 - i)) })))

  const avisos: Item[] = [
    { id: 'av1', titulo: `Calendário de fechamento de ${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][M - 1]}: D+3 para a matriz`, tipo: 'Meta do mês', texto: 'Lançamentos manuais até D+1 às 18h.\nConciliações críticas até D+2.\nPacote de reporting no D+3 às 12h.', publicadoEm: d(-3), validoAte: d(20), fixado: true },
    { id: 'av2', titulo: 'Treinamento: Reforma Tributária na prática', tipo: 'Evento', texto: 'Quinta-feira, 14h, sala 3 e online. Traga dúvidas sobre CBS/IBS nas compras.', publicadoEm: d(-1), validoAte: d(6) },
    { id: 'av3', titulo: 'Auditoria externa concluída sem ajustes relevantes 🎉', tipo: 'Conquista', texto: 'Obrigado a todos pelo cuidado com as conciliações e a documentação.', publicadoEm: d(-5), validoAte: d(10) },
  ]
  const reconhecimentos: Item[] = [
    { id: 'rc1', para: 'p3', de: 'Ana Ribeiro', valor: 'Qualidade e precisão', mensagem: 'Conciliação intercompany impecável, zero pendências com a matriz este mês.', data: d(-2), publico: true },
    { id: 'rc2', para: 'p4', de: 'Bruno Carvalho', valor: 'Colaboração', mensagem: 'Ajudou o time de compras a entender a nova regra de crédito de CBS.', data: d(-6), publico: true },
    { id: 'rc3', para: 'p5', de: 'Ana Ribeiro', valor: 'Aprendizado', mensagem: 'Primeiro forecast entregue no prazo e com ótima análise de variações.', data: d(-9), publico: true },
    { id: 'rc4', para: 'p3', de: 'Felipe Andrade', valor: 'Colaboração', mensagem: 'Cobriu minhas férias sem deixar nada atrasar.', data: d(-20), publico: true },
  ]
  const gruposTrabalho: Item[] = [
    { id: 'gt1', nome: 'Comitê Reforma Tributária', lider: 'p4', membros: ['p4', 'p3', 'p2'], objetivo: 'Preparar sistemas, cadastros e processos para CBS/IBS.', cadencia: 'Quinzenal', canal: 'Teams', status: 'Ativo', fim: d(120) },
    { id: 'gt2', nome: 'Squad automação do fechamento', lider: 'p2', membros: ['p2', 'p5', 'p6'], objetivo: 'Reduzir o fechamento de D+5 para D+3 com automações.', cadencia: 'Semanal', canal: 'Teams', status: 'Ativo', fim: d(60) },
  ]
  const ouvidoria: Item[] = [{ id: 'ov1', assunto: 'Sugestão: biblioteca de modelos de conciliação', protocolo: 'OUV-0007', tipo: 'Sugestão', anonimo: true, recebidoEm: d(-4), relato: 'Ter modelos prontos ajudaria quem está chegando.', prazo: d(10), status: 'Em análise' }]
  const obrigacoes: Item[] = [
    { id: 'ob1', nome: 'EFD-Contribuições', tipo: 'Fiscal', periodicidade: 'Mensal', dia: 10, responsavel: 'p4', backup: 'p3', destino: 'RFB (SPED)' },
    { id: 'ob2', nome: 'DCTFWeb', tipo: 'Fiscal', periodicidade: 'Mensal', dia: 15, responsavel: 'p4', backup: 'p6', destino: 'RFB' },
    { id: 'ob3', nome: 'Reporting mensal à matriz (pacote HFM)', tipo: 'Reporting à matriz', periodicidade: 'Mensal', dia: 4, responsavel: 'p1', backup: 'p2', destino: 'Matriz' },
    { id: 'ob4', nome: 'Revisão trimestral da auditoria', tipo: 'Auditoria', periodicidade: 'Trimestral', dia: 20, responsavel: 'p1', backup: 'p3', destino: 'Auditoria externa' },
    { id: 'ob5', nome: 'ECD', tipo: 'Contábil', periodicidade: 'Anual', dia: 31, mesAnual: '5', responsavel: 'p3', backup: 'p6', destino: 'RFB (SPED)' },
    { id: 'ob6', nome: 'Folha: conferência de provisões', tipo: 'Trabalhista', periodicidade: 'Mensal', dia: 3, responsavel: 'p6', backup: 'p3', destino: 'Interno' },
  ]
  const modelosChecklist: Item[] = [
    { id: 'mc1', nome: 'Abertura do período contábil', area: 'Contabilidade', periodicidade: 'Mensal', responsavel: 'p3', itens: 'Abrir período no SAP\nAtualizar taxas de câmbio\nRodar depreciação\nConferir provisões recorrentes\nAvisar áreas do calendário' },
    { id: 'mc2', nome: 'Desligamento de colaborador', area: 'Pessoas', periodicidade: 'Sob demanda', itens: 'Recolher notebook e token\nBloquear acessos (SAP, e-mail, BI)\nTransferir pastas e responsabilidades\nEntrevista de desligamento\nAtualizar organograma' },
  ]
  const execucoesChecklist: Item[] = [{ id: 'ec1', modelo: 'mc1', nome: 'Abertura do período contábil', referencia: `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][M - 1]}/${Y}`, responsavel: 'p3', itens: ['Abrir período no SAP', 'Atualizar taxas de câmbio', 'Rodar depreciação', 'Conferir provisões recorrentes', 'Avisar áreas do calendário'], marcas: { 0: { ok: true, por: 'Camila Duarte', data: d(-2) }, 1: { ok: true, por: 'Camila Duarte', data: d(-2) }, 2: { ok: true, por: 'Felipe Andrade', data: d(-1) } } }]
  const patrimonio: Item[] = [
    { id: 'pt1', item: 'Notebook Dell Latitude', tipo: 'Notebook', plaqueta: 'TI-00412', colaborador: 'p3', entregue: '2022-01-17', status: 'Em uso', valor: 7200 },
    { id: 'pt2', item: 'Certificado digital e-CNPJ (token)', tipo: 'Token / certificado digital', plaqueta: 'CD-0003', colaborador: 'p4', entregue: d(-300), devolverAte: d(25), status: 'Em uso', obs: 'Renovar antes do vencimento — usado nas obrigações fiscais.' },
    { id: 'pt3', item: 'Monitor 27"', tipo: 'Monitor', plaqueta: 'TI-00577', colaborador: 'p5', entregue: d(-20), status: 'Em uso', valor: 1900 },
    { id: 'pt4', item: 'Licença Power BI Pro', tipo: 'Licença de software', colaborador: 'p2', entregue: d(-200), devolverAte: d(165), status: 'Em uso' },
  ]
  const contratos: Item[] = [
    { id: 'ct1', item: 'Domínio exemplo-empresa.com.br', tipo: 'Domínio', fornecedor: 'Registro.br', vencimento: d(21), avisoDias: 30, periodicidade: 'Anual', renovacaoAuto: false, valor: 40, status: 'Vigente', obs: 'Dados fictícios de exemplo.' },
    { id: 'ct2', item: 'Certificado digital e-CNPJ A1', tipo: 'Certificado digital', fornecedor: 'Autoridade certificadora (exemplo)', responsavel: 'p4', vencimento: d(9), avisoDias: 30, periodicidade: 'Anual', valor: 260, status: 'Em renovação' },
    { id: 'ct3', item: 'Licenças de e-mail e escritório (10 usuários)', tipo: 'Assinatura / SaaS', fornecedor: 'Fornecedor de software (exemplo)', responsavel: 'p2', vencimento: d(140), avisoDias: 45, periodicidade: 'Mensal', renovacaoAuto: true, valor: 650, status: 'Vigente' },
    { id: 'ct4', item: 'Contrato de auditoria externa', tipo: 'Contrato', fornecedor: 'Auditoria Exemplo S/S', numero: 'CT-2025-014', responsavel: 'p1', inicio: d(-300), vencimento: d(65), avisoDias: 90, periodicidade: 'Anual', valor: 98000, centroCusto: 'cc3', status: 'Vigente' },
    { id: 'ct5', item: 'Seguro empresarial do escritório', tipo: 'Seguro', fornecedor: 'Seguradora Exemplo', vencimento: d(-4), avisoDias: 30, periodicidade: 'Anual', valor: 3800, status: 'Vigente' },
  ]
  const reembolsos: Item[] = [
    { id: 're1', colaborador: 'p4', descricao: 'Táxi — reunião na SEFAZ', data: d(-5), categoria: 'Transporte', valor: 86.4, centroCusto: 'cc2', status: 'Enviado', aprovador: 'p1' },
    { id: 're2', colaborador: 'p2', descricao: 'Almoço com auditoria', data: d(-12), categoria: 'Alimentação', valor: 212, centroCusto: 'cc3', status: 'Aprovado', aprovador: 'p1' },
    { id: 're3', colaborador: 'p6', descricao: 'Quilometragem visita à fábrica', data: d(-18), categoria: 'Quilometragem', valor: 154.3, centroCusto: 'cc2', status: 'Pago', aprovador: 'p1', pagoEm: d(-3) },
  ]
  const solicitacoes: Item[] = [
    { id: 'so1', titulo: 'Acesso ao módulo SAP CO-PA', tipo: 'Acesso a sistema', solicitante: 'p5', aprovador: 'p1', prazo: d(3), status: 'Aguardando aprovação', justificativa: 'Necessário para análises de rentabilidade do forecast.' },
    { id: 'so2', titulo: 'Horas extras — fechamento trimestral', tipo: 'Horas extras', solicitante: 'p3', aprovador: 'p1', prazo: d(8), status: 'Aprovada', decisao: 'Aprovado com limite de 8h e folga compensatória na semana seguinte.' },
    { id: 'so3', titulo: 'Curso de Power BI avançado', tipo: 'Treinamento', solicitante: 'p2', aprovador: 'p1', valor: 1490, prazo: d(30), status: 'Aguardando aprovação' },
  ]
  const npsInterno: Item[] = []
  const notasNps: [string, number[]][] = [['Compras', [9, 10, 8, 9]], ['Comercial', [7, 9, 6, 8]], ['Matriz', [10, 9, 9]], ['Diretoria', [9, 8]]]
  let k = 0
  for (const [area, ns] of notasNps) for (const n of ns) npsInterno.push({ id: `np${k++}`, ciclo: `${Y}-S${M <= 6 ? 1 : 2}`, area, nota: n, data: d(-k) })
  for (const [area, ns] of [['Compras', [8, 7, 9]], ['Comercial', [6, 7, 5]], ['Matriz', [9, 8]]] as [string, number[]][]) for (const n of ns) npsInterno.push({ id: `np${k++}`, ciclo: `${M <= 6 ? Y - 1 : Y}-S${M <= 6 ? 2 : 1}`, area, nota: n, data: d(-180) })
  const atividadesArea: Item[] = [
    { id: 'aa1', atividade: 'Conciliação intercompany', frequencia: 'Mensal', criticidade: 'Alta', titular: 'p3', backup: 'p6', documentado: true, niveis: { p3: 4, p6: 3, p1: 2 } },
    { id: 'aa2', atividade: 'Apuração de PIS/COFINS', frequencia: 'Mensal', criticidade: 'Alta', titular: 'p4', backup: 'p4', documentado: false, niveis: { p4: 4, p3: 1 } },
    { id: 'aa3', atividade: 'Rateio de custos e CO-PA', frequencia: 'Mensal', criticidade: 'Alta', titular: 'p2', backup: 'p5', documentado: true, niveis: { p2: 4, p5: 2 } },
    { id: 'aa4', atividade: 'Pacote de reporting (HFM)', frequencia: 'Mensal', criticidade: 'Alta', titular: 'p1', backup: 'p2', documentado: true, niveis: { p1: 4, p2: 3, p3: 2 } },
    { id: 'aa5', atividade: 'Forecast trimestral', frequencia: 'Trimestral', criticidade: 'Média', titular: 'p5', backup: 'p2', documentado: false, niveis: { p5: 3, p2: 4 } },
    { id: 'aa6', atividade: 'Ativo imobilizado', frequencia: 'Mensal', criticidade: 'Média', titular: 'p6', backup: 'p3', documentado: true, niveis: { p6: 4, p3: 3 } },
  ]
  const beneficios: Item[] = [
    { id: 'bn1', colaborador: 'p3', beneficio: 'Assistência médica', plano: 'Plano Nacional Apartamento', dependentes: 2, custoEmpresa: 1450, desconto: 120, inicio: '2022-01-17' },
    { id: 'bn2', colaborador: 'p5', beneficio: 'Vale-refeição', plano: 'Cartão refeição', custoEmpresa: 980, desconto: 49, inicio: d(-20) },
  ]
  const admissoes: Item[] = [{ id: 'ad1', nome: 'Gabriel Teixeira', cargo: 'cg3', gestor: 'p1', inicio: d(14), status: 'Exame admissional', checklist: '[x] RG, CPF e comprovante de residência\n[x] CTPS digital e PIS\n[x] Dados bancários\n[ ] Exame admissional (ASO)\n[ ] Contrato assinado\n[ ] Envio ao eSocial (S-2200)\n[ ] Notebook, e-mail e acessos (SAP, BI…)\n[ ] Onboarding agendado' }]
  const politicas: Item[] = [
    { id: 'po1', titulo: 'Política de alçadas e aprovações', codigo: 'FIN-002', versao: '3.1', categoria: 'Compliance / SOX', responsavel: 'p1', vigencia: d(-90), revisarEm: d(275), status: 'Vigente', exigeCiencia: true, resumo: 'Limites de aprovação por valor e tipo de despesa.' },
    { id: 'po2', titulo: 'Procedimento de fechamento contábil', codigo: 'CTB-010', versao: '2.0', categoria: 'Contábil', responsavel: 'p3', vigencia: d(-40), revisarEm: d(20), status: 'Vigente', exigeCiencia: true },
    { id: 'po3', titulo: 'Código de conduta e prevenção ao assédio', codigo: 'RH-001', versao: '4.0', categoria: 'Conduta e ética', vigencia: d(-200), revisarEm: d(160), status: 'Vigente', exigeCiencia: true },
  ]
  const ciencias: Item[] = []
  for (const [pol, v, quem] of [['po1', '3.1', ['p1', 'p2', 'p3', 'p4']], ['po2', '2.0', ['p1', 'p3', 'p6']], ['po3', '4.0', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']]] as [string, string, string[]][]) for (const q of quem) ciencias.push({ id: `ci-${pol}-${q}`, politica: pol, colaborador: q, versao: v, data: d(-10) })

  // pesquisas: só o AGREGADO (como fica no sistema real)
  const ag = (somas: Record<number, [number, number]>, n: number, nps?: number[]) => ({
    n,
    q: Object.fromEntries(Object.entries(somas).map(([q, [m, c]]) => [q, { soma: m * c, cont: c }])),
    sim: {},
    nps: nps ? { 1: nps } : {},
  })
  const pesquisasClima: Item[] = [
    { id: 'pc1', nome: `Clima ${Y}/2`, data: d(-15), tipo: 'clima', grupo: 'Controladoria', agregado: ag({ 2: [3.2, 6], 3: [3.0, 6], 4: [2.6, 6], 5: [2.8, 6], 6: [2.4, 6], 7: [2.5, 6], 8: [3.1, 6], 9: [2.3, 6], 10: [3.5, 6], 11: [2.4, 6], 12: [2.9, 6], 13: [2.8, 6], 14: [2.2, 6], 15: [3.4, 6], 16: [3.0, 6] }, 6, [0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 1]) },
    { id: 'pc2', nome: `Clima ${Y}/1`, data: d(-200), tipo: 'clima', grupo: 'Controladoria', agregado: ag({ 2: [3.0, 6], 3: [2.8, 6], 4: [2.3, 6], 5: [2.6, 6], 6: [2.0, 6], 7: [2.4, 6], 8: [2.9, 6], 9: [2.1, 6], 10: [3.3, 6], 11: [2.2, 6], 12: [2.7, 6], 13: [3.0, 6], 14: [1.9, 6], 15: [3.2, 6], 16: [2.8, 6] }, 6, [0, 0, 0, 0, 0, 1, 1, 1, 2, 1, 0]) },
  ]
  const pesquisasPsico: Item[] = [
    { id: 'pp1', nome: `Pesquisa ${Y}/2`, data: d(-30), grupo: 'Controladoria', agregado: { ...ag({ 1: [3.1, 6], 2: [2.9, 6], 3: [3.0, 6], 4: [2.0, 6], 5: [2.6, 6], 6: [2.2, 6], 7: [3.0, 6], 8: [2.7, 6], 9: [0.8, 6], 10: [2.4, 6], 11: [2.1, 6], 12: [3.0, 6], 13: [2.5, 6], 14: [3.2, 6], 15: [1.2, 6], 16: [2.6, 6], 17: [2.4, 6], 18: [1.9, 6], 19: [2.3, 6], 20: [1.1, 6], 21: [2.6, 6], 22: [2.7, 6] }, 6), sim: { 23: 0, 24: 0 } } },
  ]
  const riscosPsico: Item[] = [
    { id: 'rp1', perigo: 'Sobrecarga no fechamento (D+3) com auditoria na mesma semana', fator: 'Excesso de demandas (sobrecarga)', grupo: 'Contabilidade e Fiscal', expostos: 4, origem: 'Pesquisa anônima', probabilidade: '4 – Provável', severidade: '3 – Moderada', status: 'Em tratamento', avaliadoEm: d(-25), revisarEm: d(705) },
    { id: 'rp2', perigo: 'Mudança de ERP sem treinamento suficiente', fator: 'Má gestão de mudanças organizacionais', grupo: 'Toda a Controladoria', expostos: 6, origem: 'Conversas 1:1 / check-in', probabilidade: '3 – Possível', severidade: '3 – Moderada', status: 'Identificado', avaliadoEm: d(-25), revisarEm: d(705) },
    { id: 'rp3', perigo: 'Demandas conflitantes entre matriz e diretoria local', fator: 'Baixa clareza de papel ou função', grupo: 'FP&A', expostos: 2, origem: 'Pesquisa anônima', probabilidade: '3 – Possível', severidade: '2 – Menor', status: 'Em tratamento', avaliadoEm: d(-25), revisarEm: d(705) },
  ]
  const acoesPsico: Item[] = [
    { id: 'ap1', acao: 'Escalonar entregas da auditoria fora da semana de fechamento', risco: 'rp1', tipo: 'Carga e prazos', responsavel: 'p1', prazo: d(12), status: 'Em andamento', indicador: 'Horas extras na semana de fechamento < 6h por pessoa' },
    { id: 'ap2', acao: 'Trilha de treinamento do novo ERP antes do go-live', risco: 'rp2', tipo: 'Treinamento', responsavel: 'p2', prazo: d(35), status: 'Planejada', indicador: '100% da equipe treinada antes do go-live' },
    { id: 'ap3', acao: 'Matriz RACI de demandas da matriz × diretoria', risco: 'rp3', tipo: 'Liderança e comunicação', responsavel: 'p1', prazo: d(-3), status: 'Concluída', indicador: 'Sem retrabalho por prioridade conflitante no trimestre' },
  ]
  const checkinsBemEstar: Item[] = [
    { id: 'cb1', colaborador: 'p3', data: d(-6), carga: 4, energia: 3, sinais: 'Muitas horas na semana do fechamento.', encaminhamento: 'Folga compensatória', proximo: d(8) },
    { id: 'cb2', colaborador: 'p5', data: d(-4), carga: 3, energia: 4, encaminhamento: 'Acompanhar no próximo 1:1', proximo: d(10) },
  ]
  const indicadoresPsico: Item[] = [
    { id: 'ip1', competencia: ym(-3), headcount: 6, absenteismo: 2.4, atestados: 3, afastamentosF: 0, horasExtras: 14, feriasVencidas: 2, turnover: 0, umAum: 70 },
    { id: 'ip2', competencia: ym(-2), headcount: 6, absenteismo: 1.9, atestados: 2, afastamentosF: 0, horasExtras: 11, feriasVencidas: 1, turnover: 0, umAum: 85 },
    { id: 'ip3', competencia: ym(-1), headcount: 6, absenteismo: 1.2, atestados: 1, afastamentosF: 0, horasExtras: 7, feriasVencidas: 0, turnover: 0, umAum: 100 },
  ]
  const nr1checklist: Item[] = [{ id: String(Y), ciclo: String(Y), checks: Object.fromEntries(['0.0', '0.1', '0.2', '1.0', '1.1', '1.2', '2.0', '2.1', '3.0', '3.1', '3.2', '4.1', '5.1', '5.2'].map((k) => [k, { ok: true, data: d(-10), resp: 'p1' }])) }]

  // anotações
  const blocos: Item[] = [{ id: 'bl1', nome: 'Controladoria', cor: 'Azul', ordem: 1 }, { id: 'bl2', nome: 'Pessoal', cor: 'Verde', ordem: 2 }]
  const secoes: Item[] = [
    { id: 'sc1', nome: 'Reuniões', bloco: 'bl1', cor: 'Laranja', ordem: 1 },
    { id: 'sc2', nome: 'Reforma Tributária', bloco: 'bl1', cor: 'Roxo', ordem: 2 },
    { id: 'sc3', nome: 'Ideias', bloco: 'bl2', cor: 'Verde', ordem: 1 },
  ]
  const paginas: Item[] = [
    { id: 'pg1', secao: 'sc1', ordem: 1, nivel: 0, titulo: 'Comitê com a matriz — revisão do forecast', html: '<h2>Pontos discutidos</h2><ul><li>Variação de custo de frete acima do budget (+8%)</li><li>Câmbio: premissa revisada para o 4º tri</li></ul><h3>Próximos passos</h3><ul class="check"><li data-check="1">Enviar bridge de EBITDA atualizada</li><li>Revisar premissas de volume com Comercial</li><li>Agendar follow-up em 15 dias</li></ul><blockquote>Decisão: manter o guidance anual e reforçar o plano de redução de frete.</blockquote>', texto: 'Pontos discutidos Variação de custo de frete acima do budget Câmbio premissa revisada Próximos passos Enviar bridge de EBITDA atualizada Revisar premissas de volume Agendar follow-up' },
    { id: 'pg2', secao: 'sc1', ordem: 2, nivel: 0, titulo: '1:1 com a Camila', html: '<p>Carga alta no fechamento — combinar folga compensatória.</p><p>Interesse em liderar o projeto de automação.</p>', texto: 'Carga alta no fechamento combinar folga compensatória Interesse em liderar o projeto de automação' },
    { id: 'pg3', secao: 'sc2', ordem: 1, nivel: 0, titulo: 'Mapa de impactos CBS/IBS', html: '<h2>Compras</h2><p>Revisar cadastro de NCM e regras de crédito.</p><h2>Vendas</h2><p>Simular preço com split payment.</p>', texto: 'Compras Revisar cadastro de NCM e regras de crédito Vendas Simular preço com split payment' },
  ]
  // um rascunho à mão (fluxo simples: caixa → seta → caixa)
  const linha = (pts: [number, number][], pr = 55) => pts.flatMap(([x, y], i) => [x, y, Math.min(95, pr + (i % 3) * 8)])
  const desenhos: Item[] = [
    {
      id: 'ds1', pagina: 'pg1', ordem: 1, altura: 360,
      tracos: [
        { c: '#1d4ed8', w: 3, t: 'p', p: linha([[80, 80], [300, 80], [300, 180], [80, 180], [80, 80]]) },
        { c: '#1f2937', w: 3, t: 'p', p: linha([[320, 130], [420, 130], [400, 115], [420, 130], [400, 145]]) },
        { c: '#15803d', w: 3, t: 'p', p: linha([[440, 80], [680, 80], [680, 180], [440, 180], [440, 80]]) },
        { c: '#fde047', w: 18, t: 'm', p: linha([[470, 130], [650, 130]]) },
        { c: '#c0392b', w: 3, t: 'p', p: linha([[720, 60], [760, 200], [800, 60]]) },
      ],
    },
  ]
  return {
    humor, avisos, reconhecimentos, gruposTrabalho, ouvidoria, obrigacoes, modelosChecklist, execucoesChecklist, patrimonio, contratos, reembolsos, solicitacoes,
    npsInterno, atividadesArea, beneficios, admissoes, politicas, ciencias, pesquisasClima, pesquisasPsico, riscosPsico, acoesPsico, checkinsBemEstar,
    indicadoresPsico, nr1checklist, blocos, secoes, paginas, desenhos,
  }
}
