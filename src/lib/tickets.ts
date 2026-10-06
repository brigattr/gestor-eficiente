import type { Item } from '../data/store'

// Modelo de ticket a partir da lista "Tickets_Header" (SharePoint / Microsoft Lists).
// Cada campo aceita o nome interno (Descricao_Detalhada) e variações/nomes de exibição.

export type Campo = { key: string; label: string; alias: string[]; tipo: 'txt' | 'data' | 'num'; obrig?: boolean }
export const CAMPOS: Campo[] = [
  { key: 'id', label: 'ID', alias: ['id', 'ticket', 'ticket_id', 'chamado', 'numero'], tipo: 'txt', obrig: true },
  { key: 'titulo', label: 'Título', alias: ['title', 'titulo', 'assunto', 'resumo'], tipo: 'txt' },
  { key: 'descricao', label: 'Descrição detalhada', alias: ['descricao_detalhada', 'descricao', 'description', 'detalhes'], tipo: 'txt' },
  { key: 'empresa', label: 'Empresa', alias: ['empresa', 'company', 'entidade'], tipo: 'txt' },
  { key: 'area', label: 'Área solicitante', alias: ['area_solicitante', 'area', 'departamento'], tipo: 'txt' },
  { key: 'solicitante', label: 'Solicitante', alias: ['solicitante', 'requester', 'created_by', 'criado_por', 'autor'], tipo: 'txt' },
  { key: 'prioridade', label: 'Prioridade', alias: ['prioridade', 'priority'], tipo: 'txt' },
  { key: 'status', label: 'Status', alias: ['status', 'situacao', 'estado'], tipo: 'txt' },
  { key: 'tipo', label: 'Tipo de solicitação', alias: ['tipo_solicitacao', 'tipo', 'categoria', 'category'], tipo: 'txt' },
  { key: 'equipe', label: 'Equipe responsável', alias: ['equipe_responsavel', 'equipe', 'time', 'fila'], tipo: 'txt' },
  { key: 'analista', label: 'Analista responsável', alias: ['analista_responsavel', 'analista', 'responsavel', 'assigned_to', 'atribuido_a'], tipo: 'txt' },
  { key: 'criado', label: 'Criado (abertura)', alias: ['created', 'criado', 'data_abertura', 'abertura'], tipo: 'data', obrig: true },
  { key: 'modificado', label: 'Modificado', alias: ['modified', 'modificado', 'ultima_alteracao'], tipo: 'data' },
  { key: 'fechado', label: 'Fechado (conclusão)', alias: ['fechado', 'data_fechamento', 'conclusao', 'closed', 'resolved'], tipo: 'data' },
  { key: 'prazo', label: 'Prazo (se houver)', alias: ['prazo', 'due_date', 'vencimento', 'data_limite'], tipo: 'data' },
  { key: 'comentarios', label: 'Comentários', alias: ['comentarios', 'comments', 'observacoes'], tipo: 'txt' },
  { key: 'link', label: 'Link do item', alias: ['link', 'ref_spo_link', 'url', 'detalhes'], tipo: 'txt' },
  { key: 'hPlan', label: 'Horas planejadas', alias: ['horas_planejadas', 'horas_estimadas', 'estimativa'], tipo: 'num' },
  { key: 'hReal', label: 'Horas realizadas', alias: ['horas_realizadas', 'horas_apontadas', 'horas'], tipo: 'num' },
]

export const norm = (s: string) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s.\-/]+/g, '_')
    .replace(/_+/g, '_')

/** Sugere o mapeamento campo → índice da coluna pelo cabeçalho. */
export function autoMap(head: string[]): Record<string, number> {
  const h = head.map(norm)
  const m: Record<string, number> = {}
  const usados = new Set<number>()
  for (const c of CAMPOS) {
    const i = h.findIndex((x, k) => !usados.has(k) && (x === c.key || c.alias.includes(x)))
    if (i >= 0) {
      m[c.key] = i
      usados.add(i)
    }
  }
  return m
}

export type FmtData = 'dmy' | 'mdy'

/** Detecta DD/MM ou MM/DD olhando valores que só cabem em um dos formatos. */
export function detectFmt(vals: unknown[]): FmtData {
  for (const v of vals) {
    const m = String(v ?? '').match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}/)
    if (!m) continue
    if (Number(m[1]) > 12) return 'dmy'
    if (Number(m[2]) > 12) return 'mdy'
  }
  return 'dmy'
}

/** Converte texto/Date em 'YYYY-MM-DDTHH:mm' (horário local). */
export function toDateTime(v: unknown, fmt: FmtData): string | null {
  if (v == null || v === '') return null
  const pad = (x: number) => String(x).padStart(2, '0')
  const out = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (v instanceof Date) return isNaN(v.getTime()) ? null : out(v)
  if (typeof v === 'number') {
    // serial do Excel
    const d = new Date(Math.round((v - 25569) * 86400000))
    return out(new Date(d.getTime() + d.getTimezoneOffset() * 60000))
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${pad(Number(m[4] ?? 0))}:${m[5] ?? '00'}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?)?/i)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    const [dia, mes] = fmt === 'mdy' ? [b, a] : [a, b]
    let ano = Number(m[3])
    if (ano < 100) ano += 2000
    let hh = Number(m[4] ?? 0)
    if (m[6]?.toUpperCase() === 'PM' && hh < 12) hh += 12
    if (m[6]?.toUpperCase() === 'AM' && hh === 12) hh = 0
    return `${ano}-${pad(mes)}-${pad(dia)}T${pad(hh)}:${m[5] ?? '00'}`
  }
  return null
}

const FECHADO = /conclu|fechad|resolvid|encerrad|cancelad|closed|done|resolved|finaliz/i
export const isClosed = (t: Item) => !!t.fechado || FECHADO.test(String(t.status ?? ''))
export const isCancel = (t: Item) => /cancel/i.test(String(t.status ?? ''))

/** Data de conclusão: "Fechado"; se vazio e o status está concluído, usa "Modificado" (estimativa). */
export function dataConclusao(t: Item): { data: string | null; estimada: boolean } {
  if (t.fechado) return { data: String(t.fechado), estimada: false }
  if (isClosed(t) && t.modificado) return { data: String(t.modificado), estimada: true }
  return { data: null, estimada: false }
}

const toDate = (s: string) => new Date(s.length <= 10 ? s + 'T00:00' : s)

/** Dias úteis (seg–sex) entre duas datas, com fração pelo horário. */
export function diasUteis(a: string, b: string): number {
  const ini = toDate(a)
  const fim = toDate(b)
  if (fim <= ini) return 0
  let ms = 0
  const d = new Date(ini)
  while (d < fim) {
    const prox = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    const ate = prox < fim ? prox : fim
    if (d.getDay() !== 0 && d.getDay() !== 6) ms += ate.getTime() - d.getTime()
    d.setTime(prox.getTime())
  }
  return ms / 86400000
}

export const SLA_PADRAO: Record<string, number> = { Urgente: 0.5, Crítica: 0.5, Alta: 1, Média: 3, Media: 3, Normal: 3, Baixa: 5 }

export function slaDe(t: Item, sla: Record<string, number>): number | null {
  const p = String(t.prioridade ?? '').trim()
  const k = Object.keys(sla).find((x) => norm(x) === norm(p))
  return k ? sla[k] : null
}
