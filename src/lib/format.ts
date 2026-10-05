import { get, type Item } from '../data/store'
import { MOD, type Field } from '../data/schema'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const money = (v: unknown, cents = false) => (v == null || v === '' ? '—' : (cents ? brl2 : brl).format(Number(v)))
export const n = (v: unknown) => (v == null || v === '' ? '—' : num.format(Number(v)))
export const pct = (v: unknown) => (v == null || v === '' || !isFinite(Number(v)) ? '—' : `${num.format(Number(v))}%`)

/** Data local em 'YYYY-MM-DD' (sem fuso). */
export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const todayISO = () => iso(new Date())
export function parseISO(s: unknown): Date | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(d: Date, k: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + k)
  return x
}
/** Dias corridos de hoje até a data (negativo = passado). */
export function daysUntil(s: unknown): number | null {
  const d = parseISO(s)
  if (!d) return null
  const t = parseISO(todayISO())!
  return Math.round((d.getTime() - t.getTime()) / 86400000)
}
export function fmtDate(s: unknown) {
  const d = parseISO(s)
  return d ? d.toLocaleDateString('pt-BR') : '—'
}
export function fmtMonth(s: unknown) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}/.test(s)) return '—'
  const [y, m] = s.split('-').map(Number)
  return `${MES_CURTO[m - 1]}/${y}`
}
/** Segunda-feira da semana da data. */
export function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7
  return addDays(x, -dow)
}

/** Texto de exibição de um item (usa o titleField do módulo). */
export function label(col: string, item: Item | undefined): string {
  if (!item) return '—'
  const m = MOD[col]
  if (!m) return item.id
  const f = m.fields.find((x) => x.key === m.titleField)
  const v = item[m.titleField]
  if (f?.type === 'ref') return label(f.ref!, get(f.ref!, v as string))
  if (col === 'centrosCusto') return `${item.codigo ?? ''} · ${item.nome ?? ''}`
  return v == null || v === '' ? '(sem título)' : String(v)
}

// Colunas calculadas (não editáveis) que podem aparecer nas tabelas
export const VIRTUALS: Record<string, Record<string, { label: string; value: (i: Item) => number | string | null }>> = {
  tarefas: {
    gut: { label: 'GUT', value: (i) => (i.g && i.u && i.t ? Number(i.g) * Number(i.u) * Number(i.t) : null) },
  },
}

export function display(col: string, f: Field | undefined, v: unknown): string {
  if (!f) return v == null ? '—' : String(v)
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return f.type === 'bool' ? 'Não' : '—'
  switch (f.type) {
    case 'money':
      return money(v)
    case 'percent':
      return pct(v)
    case 'number':
      return n(v)
    case 'date':
      return fmtDate(v)
    case 'month':
      return fmtMonth(v)
    case 'bool':
      return v ? 'Sim' : 'Não'
    case 'rating':
      return '★'.repeat(Number(v)) + '☆'.repeat(Math.max(0, 5 - Number(v)))
    case 'ref':
      return label(f.ref!, get(f.ref!, v as string))
    case 'multiref':
      return (v as string[]).map((id) => label(f.ref!, get(f.ref!, id))).join(', ')
    case 'select':
      if (col && f.key === 'mes') return MES_CURTO[Number(v) - 1] ?? String(v)
      return String(v)
    default:
      return String(v)
  }
}

/** Tom semântico para chips de status. */
export function tone(v: unknown): 'ok' | 'warn' | 'bad' | 'info' | 'muted' {
  const s = String(v ?? '').toLowerCase()
  if (/(conclu|aprovad|realizad|fechad|atingida$|contratad|válido|lançada|comunicada|calibrada|positiva|^ativo|alta$)/.test(s)) return 'ok'
  if (/(risco|crític|vencid|recusad|reprovad|negativa|cancelad|não atingida|desligad|baixa$|atrasad)/.test(s)) return 'bad'
  if (/(atenção|pendente|aguardando|ajuste|a agendar|pausad|vencendo|média$|aprovação|solicitad)/.test(s)) return 'warn'
  if (/(andamento|em gozo|agendad|aberta|triagem|entrevist|proposta|revis|prepara|no prazo)/.test(s)) return 'info'
  return 'muted'
}

export function downloadFile(name: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type: type + ';charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function toCSV(rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // ; e BOM: abre direto no Excel em pt-BR
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n')
}

/** Parser CSV tolerante (vírgula ou ponto-e-vírgula, aspas). */
export function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, '')
  const first = text.split(/\r?\n/)[0] ?? ''
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ';' : ','
  const out: string[][] = []
  let row: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === sep) {
      row.push(cur)
      cur = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      if (row.some((x) => x.trim() !== '')) out.push(row)
      row = []
      cur = ''
    } else cur += c
  }
  row.push(cur)
  if (row.some((x) => x.trim() !== '')) out.push(row)
  return out
}

/** Converte "1.234,56", "1234.56", "R$ 1.234" em número. */
export function toNumber(s: unknown): number | null {
  if (s == null) return null
  if (typeof s === 'number') return s
  let t = String(s).replace(/[R$\s%]/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const v = Number(t)
  return isFinite(v) ? v : null
}

/** Aceita YYYY-MM-DD ou DD/MM/AAAA (com hora opcional) e devolve YYYY-MM-DD. */
export function toISODate(s: unknown): string | null {
  if (!s) return null
  const t = String(s).trim()
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}
