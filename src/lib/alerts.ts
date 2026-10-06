import { useMemo } from 'react'
import { MODULES, MOD } from '../data/schema'
import { get, useDB, type DB, type Item } from '../data/store'
import { addDays, daysUntil, iso, label, startOfWeek } from './format'

export const DONE = /conclu|realizad|aprovad|fechad|atingida|contratad|cancelad|recusad|reprovad|comunicada|lançada|em gozo/i

export function isDone(col: string, it: Item) {
  const sf = MOD[col]?.statusField
  if (col === 'reunioes') return !!it.preparado
  return sf ? DONE.test(String(it[sf] ?? '')) : false
}

export type CalEvent = { date: string; col: string; id: string; title: string; nome: string; kind: string; done: boolean; path: string; hora?: string; fim?: string; cancelada?: boolean }

/** Todos os itens com prazo de todos os módulos, para o Calendário e a agenda. */
export function allEvents(db: DB): CalEvent[] {
  const out: CalEvent[] = []
  for (const m of MODULES) {
    if (!m.dates) continue
    for (const it of db[m.col] ?? []) {
      for (const d of m.dates) {
        const v = it[d.field]
        if (typeof v !== 'string' || !v) continue
        let title = label(m.col, it)
        if (m.personField && m.titleField !== m.personField) title = `${label('pessoas', get('pessoas', it[m.personField] as string))} – ${title}`
        if (m.col === 'reunioes' && it.hora) title = `${it.hora} ${title}`
        const reuniao = m.col === 'reunioes' && d.field === 'data'
        out.push({
          date: v.slice(0, 10),
          col: m.col,
          id: it.id,
          title,
          nome: reuniao ? String(it.titulo ?? '') : title,
          kind: d.label,
          // reunião "preparada" não é concluída: continua aparecendo no calendário
          done: m.col === 'reunioes' ? false : isDone(m.col, it),
          path: m.path,
          hora: reuniao && typeof it.hora === 'string' && it.hora ? it.hora : undefined,
          fim: reuniao && typeof it.horaFim === 'string' && it.horaFim ? it.horaFim : undefined,
          cancelada: !!it.canceladaOutlook,
        })
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export type Alert = { level: 'bad' | 'warn'; text: string; col: string; id?: string; path: string }

export function computeAlerts(db: DB): Alert[] {
  const a: Alert[] = []
  const P = (id: unknown) => label('pessoas', get('pessoas', id as string))
  for (const t of db.tarefas ?? []) {
    const d = daysUntil(t.prazo)
    if (d != null && d < 0 && !isDone('tarefas', t)) a.push({ level: 'bad', text: `Tarefa atrasada ${-d}d: ${t.titulo}`, col: 'tarefas', id: t.id, path: 'tarefas' })
    const fu = daysUntil(t.followup)
    if (fu != null && fu <= 0 && !isDone('tarefas', t)) a.push({ level: 'warn', text: `Follow-up ${fu < 0 ? `atrasado ${-fu}d` : 'hoje'}: ${t.titulo}${t.aguardando ? ` (${t.aguardando})` : ''}`, col: 'tarefas', id: t.id, path: 'tarefas' })
  }
  for (const c of db.certificacoes ?? []) {
    const d = daysUntil(c.validade)
    if (d == null) continue
    if (d < 0) a.push({ level: 'bad', text: `Certificação vencida: ${c.nome} (${P(c.colaborador)})`, col: 'certificacoes', id: c.id, path: 'treinamentos' })
    else if (d <= 45) a.push({ level: 'warn', text: `Certificação vence em ${d}d: ${c.nome} (${P(c.colaborador)})`, col: 'certificacoes', id: c.id, path: 'treinamentos' })
  }
  for (const x of db.exames ?? []) {
    const d = daysUntil(x.proximo)
    if (d == null || x.status === 'Realizado') continue
    if (d < 0) a.push({ level: 'bad', text: `ASO vencido: ${P(x.colaborador)}`, col: 'exames', id: x.id, path: 'exames' })
    else if (d <= 30 && x.status !== 'Agendado') a.push({ level: 'warn', text: `Agendar ASO em ${d}d: ${P(x.colaborador)}`, col: 'exames', id: x.id, path: 'exames' })
  }
  for (const f of db.ferias ?? []) {
    const d = daysUntil(f.limite)
    if (d != null && d <= 90 && !f.inicio && !isDone('ferias', f)) a.push({ level: d <= 45 ? 'bad' : 'warn', text: `Férias sem programação, limite concessivo em ${d}d: ${P(f.colaborador)}`, col: 'ferias', id: f.id, path: 'ferias' })
  }
  for (const p of db.ponto ?? []) {
    const d = daysUntil(p.prazo)
    if (d != null && d <= 3 && !isDone('ponto', p)) a.push({ level: d < 0 ? 'bad' : 'warn', text: `Cartão-ponto pendente: ${P(p.colaborador)}`, col: 'ponto', id: p.id, path: 'ponto' })
  }
  for (const p of db.projetos ?? []) {
    if (p.status === 'Em risco') a.push({ level: 'bad', text: `Projeto em risco: ${p.nome}`, col: 'projetos', id: p.id, path: 'projetos' })
    const d = daysUntil(p.fim)
    if (d != null && d < 0 && !isDone('projetos', p)) a.push({ level: 'bad', text: `Projeto passou do prazo: ${p.nome}`, col: 'projetos', id: p.id, path: 'projetos' })
  }
  for (const k of db.krs ?? []) if (k.confianca === 'Baixa') a.push({ level: 'warn', text: `KR com confiança baixa: ${k.titulo}`, col: 'krs', id: k.id, path: 'okr' })
  const mon = startOfWeek(new Date())
  const wkS = iso(mon)
  const wkE = iso(addDays(mon, 6))
  for (const r of db.reunioes ?? []) {
    const d = String(r.data ?? '')
    if (d >= wkS && d <= wkE && !r.preparado && (daysUntil(d) ?? -1) >= 0) a.push({ level: 'warn', text: `Preparar: ${r.titulo} (${d.slice(8, 10)}/${d.slice(5, 7)})`, col: 'reunioes', id: r.id, path: 'semana' })
  }
  const soma: Record<string, number> = {}
  for (const i of db.incentivos ?? []) {
    if (i.pai) continue
    const k = `${i.colaborador ?? ''}|${i.ano}`
    soma[k] = (soma[k] ?? 0) + Number(i.peso || 0)
  }
  for (const [k, s] of Object.entries(soma)) {
    if (Math.abs(s - 100) > 0.01) {
      const [p, ano] = k.split('|')
      a.push({ level: 'warn', text: `Incentive ${ano}: pesos ${p ? `de ${P(p)}` : 'das suas metas'} somam ${s}% (devem somar 100%)`, col: 'incentivos', path: 'incentive' })
    }
  }
  return a.sort((x, y) => (x.level === y.level ? 0 : x.level === 'bad' ? -1 : 1))
}

export function useAlerts() {
  const db = useDB()
  return useMemo(() => computeAlerts(db), [db])
}
