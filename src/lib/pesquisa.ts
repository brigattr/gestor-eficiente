// Motor genérico de pesquisas anônimas: lê a planilha exportada do Forms (ou CSV),
// reconhece as perguntas pelo texto ou pelo código (P1, P2…) e devolve só o AGREGADO.
// As respostas individuais nunca são gravadas.

export type Escala = 'conc' | 'freq' | 'nps' | 'simnao'
export type PerguntaP = { n: number; texto: string; dim: string; inv?: boolean; escala: Escala }
export type AgregadoP = { n: number; q: Record<string, { soma: number; cont: number }>; sim: Record<string, number>; nps: Record<string, number[]> }

export const ESC_FREQ = ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre']
export const ESC_CONC = ['Discordo totalmente', 'Discordo', 'Nem concordo nem discordo', 'Concordo', 'Concordo totalmente']
export const MIN_N = 5

const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
const so = (x: unknown) => norm(x).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function valor(v: unknown, esc: Escala, base1: boolean): number | null {
  if (v == null || v === '') return null
  const t = norm(v)
  if (esc === 'simnao') return /^(s|sim|yes|y|1|true)$/.test(t) ? 1 : /^(n|nao|no|0|false)$/.test(t) ? 0 : null
  const num = Number(t.replace(',', '.'))
  if (esc === 'nps') return !isNaN(num) && num >= 0 && num <= 10 ? Math.round(num) : null
  if (!isNaN(num)) return Math.max(0, Math.min(4, base1 ? num - 1 : num))
  const lista = esc === 'freq' ? ESC_FREQ : ESC_CONC
  const i = lista.findIndex((x) => norm(x) === t)
  if (i >= 0) return i
  const j = lista.findIndex((x) => t.startsWith(norm(x).slice(0, 6)))
  return j >= 0 ? j : null
}

export function agregarP(linhas: unknown[][], perguntas: PerguntaP[]): { ag: AgregadoP; mapeadas: number } {
  const [cab, ...dados] = linhas
  const cabN = (cab ?? []).map(norm)
  const cabS = (cab ?? []).map(so)
  const col: Record<number, number> = {}
  const usadas = new Set<number>()
  for (const p of perguntas) {
    const alvo = so(p.texto)
    let i = cabS.findIndex((h, k) => !usadas.has(k) && (h === alvo || h.includes(alvo) || (h.length > 30 && alvo.includes(h))))
    if (i < 0) {
      const ids = [`p${p.n}`, `q${p.n}`, `${p.n}`]
      i = cabN.findIndex((h, k) => !usadas.has(k) && ids.some((id) => h === id || h.startsWith(id + '.') || h.startsWith(id + ')') || h.startsWith(id + ' ') || h.startsWith(id + '-')))
    }
    if (i >= 0) {
      col[p.n] = i
      usadas.add(i)
    }
  }
  const resp = dados.filter((r) => r.some((x) => x != null && String(x).trim() !== ''))
  const nums = perguntas.filter((p) => (p.escala === 'conc' || p.escala === 'freq') && col[p.n] != null).flatMap((p) => resp.map((r) => Number(r[col[p.n]])).filter((x) => !isNaN(x)))
  const base1 = nums.length > 0 && !nums.includes(0) && nums.includes(5)
  const ag: AgregadoP = { n: resp.length, q: {}, sim: {}, nps: {} }
  for (const p of perguntas) {
    if (col[p.n] == null) continue
    for (const r of resp) {
      const v = valor(r[col[p.n]], p.escala, base1)
      if (v == null) continue
      if (p.escala === 'simnao') ag.sim[p.n] = (ag.sim[p.n] ?? 0) + v
      else if (p.escala === 'nps') (ag.nps[p.n] ??= Array(11).fill(0))[v]++
      else {
        const a = (ag.q[p.n] ??= { soma: 0, cont: 0 })
        a.soma += v
        a.cont++
      }
    }
  }
  return { ag, mapeadas: Object.keys(col).length }
}

/** Índice 0–100 por dimensão (média; itens "inv" são invertidos) e NPS das perguntas 0–10. */
export function resultadoP(ag: AgregadoP | undefined, perguntas: PerguntaP[]) {
  const a = ag ?? { n: 0, q: {}, sim: {}, nps: {} }
  const dimsNomes = [...new Set(perguntas.filter((p) => p.escala === 'conc' || p.escala === 'freq').map((p) => p.dim))]
  const dims = dimsNomes.map((dim) => {
    let soma = 0,
      cont = 0
    for (const p of perguntas.filter((x) => x.dim === dim)) {
      const q = a.q[p.n]
      if (!q?.cont) continue
      const m = q.soma / q.cont
      soma += p.inv ? 4 - m : m
      cont++
    }
    return { dim, score: cont ? Math.round((soma / cont) * 25) : null }
  })
  const nps = perguntas
    .filter((p) => p.escala === 'nps')
    .map((p) => {
      const c = a.nps[p.n] ?? Array(11).fill(0)
      const tot = c.reduce((x, y) => x + y, 0)
      const prom = c[9] + c[10],
        det = c.slice(0, 7).reduce((x, y) => x + y, 0)
      return { p, tot, prom, det, neutros: tot - prom - det, valor: tot ? Math.round(((prom - det) / tot) * 100) : null }
    })
  return { n: a.n, dims, nps }
}

/** NPS a partir de notas soltas (0–10). */
export function calcNps(notas: number[]) {
  const v = notas.filter((x) => x >= 0 && x <= 10)
  if (!v.length) return null
  const prom = v.filter((x) => x >= 9).length,
    det = v.filter((x) => x <= 6).length
  return { valor: Math.round(((prom - det) / v.length) * 100), prom, det, neutros: v.length - prom - det, n: v.length }
}
