import type { DB, Item } from '../data/store'

export function krProgress(k: Item): number {
  const ini = Number(k.inicial ?? 0)
  const alvo = Number(k.alvo ?? 0)
  const at = Number(k.atual ?? ini)
  if (alvo === ini) return at === alvo ? 100 : 0
  return Math.max(0, Math.min(100, ((at - ini) / (alvo - ini)) * 100))
}

export function objProgress(db: DB, objId: string): number {
  const krs = (db.krs ?? []).filter((k) => k.objetivo === objId)
  const kids = (db.objetivos ?? []).filter((o) => o.pai === objId)
  const parts = [...krs.map(krProgress), ...kids.map((o) => objProgress(db, o.id))]
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0
}

export type BvR = { budget: number; real: number }

/** Budget × realizado por mês (1..12) e por conta, filtrado por ano e centros de custo. */
export function budgetVsReal(db: DB, ano: number, ccs?: string[]) {
  const inCC = (i: Item) => !ccs?.length || ccs.includes(i.centroCusto as string)
  const months: BvR[] = Array.from({ length: 12 }, () => ({ budget: 0, real: 0 }))
  const byConta: Record<string, BvR> = {}
  const byCC: Record<string, BvR[]> = {}
  const add = (i: Item, k: 'budget' | 'real') => {
    if (Number(i.ano) !== ano || !inCC(i)) return
    const m = Number(i.mes) - 1
    if (m < 0 || m > 11) return
    const v = Number(i.valor || 0)
    months[m][k] += v
    const c = String(i.conta ?? 'Outros')
    byConta[c] ??= { budget: 0, real: 0 }
    byConta[c][k] += v
    const cc = String(i.centroCusto)
    byCC[cc] ??= Array.from({ length: 12 }, () => ({ budget: 0, real: 0 }))
    byCC[cc][m][k] += v
  }
  for (const b of db.budget ?? []) add(b, 'budget')
  for (const e of db.despesas ?? []) add(e, 'real')
  return { months, byConta, byCC }
}

/** Soma até o último mês com realizado (YTD comparável). */
export function ytd(months: BvR[]) {
  let last = -1
  months.forEach((m, i) => m.real && (last = i))
  const s = months.slice(0, last + 1)
  return { last, budget: s.reduce((a, b) => a + b.budget, 0), real: s.reduce((a, b) => a + b.real, 0), fy: months.reduce((a, b) => a + b.budget, 0) }
}
