import { useMemo, useState } from 'react'
import { MOD, field } from '../data/schema'
import { upsert, type Item } from '../data/store'
import { MES_CURTO, VIRTUALS, addDays, daysUntil, display, label, parseISO, todayISO } from '../lib/format'
import { openEditor } from './ItemForm'
import { Chip } from './ui'

export function cellText(col: string, key: string, it: Item): string {
  const vf = VIRTUALS[col]?.[key]
  if (vf) {
    const r = vf.value(it)
    return r == null ? '—' : String(r)
  }
  return display(col, field(col, key), it[key])
}

function sortValue(col: string, key: string, it: Item): string | number {
  const vf = VIRTUALS[col]?.[key]
  if (vf) return (vf.value(it) as number) ?? -Infinity
  const f = field(col, key)
  const v = it[key]
  if (f && ['number', 'money', 'percent', 'rating'].includes(f.type)) return v == null || v === '' ? -Infinity : Number(v)
  if (f?.key === 'mes') return Number(v)
  if (f?.type === 'date' || f?.type === 'month') return (v as string) ?? ''
  return cellText(col, key, it).toLowerCase()
}

/** Destaque de prazo: vencido em vermelho, próximos 7 dias em âmbar. */
function dateCls(col: string, key: string, it: Item) {
  const f = field(col, key)
  if (f?.type !== 'date') return ''
  const st = MOD[col].statusField ? String(it[MOD[col].statusField!] ?? '') : ''
  if (/conclu|realizad|aprovad|fechad|atingida|contratad/i.test(st)) return ''
  const dd = daysUntil(it[key])
  if (dd == null) return ''
  if (dd < 0 && MOD[col].dates?.some((d) => d.field === key)) return 'neg'
  return ''
}

export function Cell({ col, k, it }: { col: string; k: string; it: Item }) {
  const f = field(col, k)
  const txt = cellText(col, k, it)
  if (f && (k === MOD[col].statusField || f.key === 'tipo' || f.key === 'status')) return <Chip v={txt === '—' ? null : txt} />
  if (f?.type === 'percent' && typeof it[k] === 'number') return <span className="num">{txt}</span>
  if (f?.type === 'rating') return <span style={{ color: 'var(--accent)' }}>{txt === '—' ? '' : txt}</span>
  if (f?.type === 'url' && it[k])
    return (
      <a href={String(it[k])} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        abrir
      </a>
    )
  return <>{txt}</>
}

export function Table({ col, rows, columns }: { col: string; rows: Item[]; columns?: string[] }) {
  const m = MOD[col]
  const cols = columns ?? m.columns
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 } | null>(null)
  const sorted = useMemo(() => {
    if (!sort) return rows
    return [...rows].sort((a, b) => {
      const x = sortValue(col, sort.k, a)
      const y = sortValue(col, sort.k, b)
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
    })
  }, [rows, sort, col])
  const numeric = (k: string) => ['number', 'money', 'percent'].includes(field(col, k)?.type ?? '') || !!VIRTUALS[col]?.[k]
  if (!rows.length) return <div className="empty">Nenhum registro. Use “Novo” para começar.</div>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((k) => (
              <th key={k} className={numeric(k) ? 'num' : ''} onClick={() => setSort((s) => (s?.k === k ? { k, dir: (s.dir * -1) as 1 | -1 } : { k, dir: 1 }))}>
                {VIRTUALS[col]?.[k]?.label ?? field(col, k)?.label ?? k}
                {sort?.k === k ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((it) => (
            <tr key={it.id} className="click" onClick={() => openEditor(col, it.id)}>
              {cols.map((k) => (
                <td key={k} className={`${numeric(k) ? 'num' : ''} ${dateCls(col, k, it)}`}>
                  <Cell col={col} k={k} it={it} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Kanban({ col, rows, by, preset }: { col: string; rows: Item[]; by?: string; preset?: Record<string, unknown> }) {
  const m = MOD[col]
  const key = by ?? m.statusField!
  const f = field(col, key)!
  const lanes = f.options ?? []
  const [over, setOver] = useState<string | null>(null)
  const secondary = m.columns.filter((c) => c !== m.titleField && c !== key).slice(0, 3)
  return (
    <div className="kanban">
      {lanes.map((lane) => {
        const items = rows.filter((r) => (r[key] ?? lanes[0]) === lane)
        return (
          <div
            key={lane}
            className={`lane ${over === lane ? 'drop' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(lane)
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/plain')
              setOver(null)
              if (id) upsert(col, { id, [key]: lane })
            }}
          >
            <div className="lane-head">
              <Chip v={lane} />
              <span className="muted small">{items.length}</span>
              <span className="grow" />
              <button className="btn ghost sm" title="Adicionar" onClick={() => openEditor(col, undefined, { ...preset, [key]: lane })}>
                +
              </button>
            </div>
            {items.map((it) => (
              <div key={it.id} className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', it.id)} onClick={() => openEditor(col, it.id)}>
                <span className="t">{label(col, it)}</span>
                {secondary.map((k) => {
                  const t = cellText(col, k, it)
                  if (t === '—' || t === 'Não') return null
                  return (
                    <span key={k} className={`small ${dateCls(col, k, it) === 'neg' ? '' : 'muted'}`} style={dateCls(col, k, it) === 'neg' ? { color: 'var(--bad)' } : undefined}>
                      {VIRTUALS[col]?.[k]?.label ?? field(col, k)?.label}: {t}
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

const COLORS = ['var(--brand-2)', '#2f8f83', '#b5832a', '#7b5fc4', '#c2555b', '#3d7fc9']

export function Gantt({ col, rows, start, end, groupBy }: { col: string; rows: Item[]; start: string; end: string; groupBy?: string }) {
  const items = rows
    .map((r) => ({ r, s: parseISO(r[start]) ?? parseISO(r[end]), e: parseISO(r[end]) ?? parseISO(r[start]) }))
    .filter((x) => x.s && x.e) as { r: Item; s: Date; e: Date }[]
  if (!items.length) return <div className="empty">Sem registros com datas de início e fim.</div>
  items.sort((a, b) => a.s.getTime() - b.s.getTime())
  const today = parseISO(todayISO())!
  let min = new Date(Math.min(today.getTime(), ...items.map((i) => i.s.getTime())))
  let max = new Date(Math.max(today.getTime(), ...items.map((i) => i.e.getTime())))
  min = new Date(min.getFullYear(), min.getMonth(), 1)
  max = addDays(new Date(max.getFullYear(), max.getMonth() + 1, 1), 0)
  const span = max.getTime() - min.getTime()
  const x = (d: Date) => ((d.getTime() - min.getTime()) / span) * 100
  const ticks: Date[] = []
  for (let d = new Date(min); d < max; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) ticks.push(d)
  const groups = groupBy ? [...new Set(items.map((i) => String(i.r[groupBy] ?? '')))] : []
  return (
    <div className="gantt">
      <div className="gl gh" />
      <div className="gh">
        {ticks.map((t) => (
          <span key={t.getTime()} className="tick" style={{ left: `${x(t)}%` }}>
            {MES_CURTO[t.getMonth()]}
            {t.getMonth() === 0 || t === ticks[0] ? `/${String(t.getFullYear()).slice(2)}` : ''}
          </span>
        ))}
      </div>
      {items.map(({ r, s, e }) => {
        const c = groupBy ? COLORS[groups.indexOf(String(r[groupBy] ?? '')) % COLORS.length] : COLORS[0]
        const st = MOD[col].statusField ? String(r[MOD[col].statusField!] ?? '') : ''
        return (
          <div key={r.id} style={{ display: 'contents' }}>
            <div className="gl" title={label(col, r)}>
              {label(col, r)}
            </div>
            <div className="gr">
              <span className="today" style={{ left: `${x(today)}%` }} />
              <span
                className="gbar"
                onClick={() => openEditor(col, r.id)}
                title={`${s.toLocaleDateString('pt-BR')} → ${e.toLocaleDateString('pt-BR')} ${st}`}
                style={{
                  left: `${x(s)}%`,
                  width: `max(6px, ${x(addDays(e, 1)) - x(s)}%)`,
                  background: /risco|recusad/i.test(st) ? 'var(--bad)' : /conclu/i.test(st) ? 'var(--ok)' : c,
                  opacity: /planejad|solicitad/i.test(st) ? 0.65 : 1,
                }}
              >
                {st}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
