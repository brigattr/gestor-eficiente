import type { DB, Item } from '../data/store'

// Régua do Incentive/KPI (SuccessFactors): três pontos de atingimento → bônus.
//   v50  = atingimento que paga 50% (≈ 80% do target)
//   v100 = target / budget (100%)
//   v150 = stretch que paga 150% (≈ 120% do target)
// Entre os pontos o bônus é linear; abaixo de v50 paga 0; acima de v150 limita em 150%.
// Funciona para "maior é melhor" e "menor é melhor" (a ordem dos pontos define o sentido).

const num = (v: unknown) => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v))

export function pontos(g: Item) {
  const v100 = num(g.v100)
  if (v100 == null) return null
  const menor = g.sentido === 'Menor é melhor'
  const v50 = num(g.v50) ?? v100 * (menor ? 1.2 : 0.8)
  const v150 = num(g.v150) ?? v100 * (menor ? 0.8 : 1.2)
  return { v50, v100, v150 }
}

/** Bônus % de uma meta sem sub-metas (null = sem dados). */
export function bonusSimples(g: Item): number | null {
  const manual = num(g.bonusManual)
  if (manual != null) return manual
  const p = pontos(g)
  const real = num(g.real)
  if (!p || real == null) return null
  const { v50, v100, v150 } = p
  const s = Math.sign(v100 - v50) || 1 // +1 maior é melhor, −1 menor é melhor
  if ((real - v50) * s < 0) return 0
  if ((real - v100) * s <= 0) return 50 + (50 * (real - v50)) / (v100 - v50 || 1)
  if ((real - v150) * s < 0) return 100 + (50 * (real - v100)) / (v150 - v100 || 1)
  return 150
}

export const filhos = (db: DB, g: Item) => (db.incentivos ?? []).filter((x) => x.pai === g.id)

/** Bônus % considerando sub-metas (média ponderada pelos pesos internos). */
export function bonus(db: DB, g: Item, depth = 0): number | null {
  const kids = depth < 4 ? filhos(db, g) : []
  if (!kids.length) return bonusSimples(g)
  let w = 0
  let s = 0
  for (const k of kids) {
    const b = bonus(db, k, depth + 1)
    if (b == null) continue
    w += Number(k.peso || 0)
    s += Number(k.peso || 0) * b
  }
  return w ? s / w : bonusSimples(g)
}

/** Atingimento do realizado contra o target (% do budget). */
export function atingimento(g: Item): number | null {
  const p = pontos(g)
  const real = num(g.real)
  if (!p || real == null || !p.v100) return null
  return g.sentido === 'Menor é melhor' ? (p.v100 / real) * 100 : (real / p.v100) * 100
}

/** Metas de primeiro nível de um colaborador/ano e o fator de bônus ponderado. */
export function scorecard(db: DB, colaborador: string | null | undefined, ano: number) {
  const topo = (db.incentivos ?? []).filter((g) => !g.pai && (g.colaborador ?? null) === (colaborador ?? null) && Number(g.ano) === ano)
  const pesos = topo.reduce((a, g) => a + Number(g.peso || 0), 0)
  const fator = topo.reduce((a, g) => a + (Number(g.peso || 0) * (bonus(db, g) ?? 0)) / 100, 0)
  return { topo, pesos, fator }
}
