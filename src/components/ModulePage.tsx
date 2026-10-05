import { useMemo, type ReactNode } from 'react'
import { MOD } from '../data/schema'
import { list, useDB, type Item } from '../data/store'
import { downloadFile, label, toCSV } from '../lib/format'
import { Icon } from './Icon'
import { openEditor } from './ItemForm'
import { PageHead, Seg, useLocalState } from './ui'
import { Gantt, Kanban, Table, cellText } from './Views'

export type ExtraView = { key: string; label: string; render: (rows: Item[]) => ReactNode }

type Props = {
  col: string
  extraViews?: ExtraView[]
  defaultView?: string
  above?: (rows: Item[]) => ReactNode
  actions?: ReactNode
  embedded?: boolean
  where?: (i: Item) => boolean
  preset?: Record<string, unknown>
}

export function ModulePage({ col, extraViews = [], defaultView, above, actions, embedded, where, preset }: Props) {
  useDB()
  const m = MOD[col]
  const views: { v: string; l: string }[] = [{ v: 'tabela', l: 'Lista' }]
  if (m.statusField) views.push({ v: 'kanban', l: 'Kanban' })
  if (m.timeline) views.push({ v: 'gantt', l: m.col === 'ferias' ? 'Linha do tempo' : 'Gantt' })
  extraViews.forEach((e) => views.push({ v: e.key, l: e.label }))
  const [view, setView] = useLocalState(`view:${col}:${embedded ? 'e' : 'p'}`, defaultView ?? 'tabela')
  const [q, setQ] = useLocalState(`q:${col}`, '')
  const [flt, setFlt] = useLocalState<Record<string, string>>(`f:${col}`, {})

  // filtros automáticos: pessoa, status e selects/refs exibidos na lista
  const filterFields = m.fields.filter((f) => m.columns.includes(f.key) && (f.type === 'select' || f.type === 'ref') && f.key !== m.titleField).slice(0, 4)

  const all = list(col)
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return all.filter((it) => {
      if (where && !where(it)) return false
      for (const [k, val] of Object.entries(flt)) if (val && String(it[k] ?? '') !== val) return false
      if (!s) return true
      return m.fields.some((f) => cellText(col, f.key, it).toLowerCase().includes(s))
    })
  }, [all, q, flt, where, col, m.fields])

  function exportCSV() {
    const fs = m.fields
    const data = [fs.map((f) => f.label), ...rows.map((r) => fs.map((f) => (['number', 'money', 'percent'].includes(f.type) ? (r[f.key] as number) : cellText(col, f.key, r).replace(/^—$/, ''))))]
    downloadFile(`${m.path}.csv`, toCSV(data), 'text/csv')
  }

  const current = views.find((v) => v.v === view) ? view : 'tabela'
  const extra = extraViews.find((e) => e.key === current)

  return (
    <div className="stack">
      {!embedded && (
        <PageHead title={m.title} desc={m.description}>
          {actions}
          <button className="btn primary" onClick={() => openEditor(col, undefined, preset)}>
            <Icon name="plus" size={16} /> Novo
          </button>
        </PageHead>
      )}
      {above?.(rows)}
      <div className="card flush">
        <div className="row" style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          {views.length > 1 && <Seg value={current} options={views} onChange={setView} />}
          <input style={{ maxWidth: 240 }} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          {filterFields.map((f) => {
            const opts = f.type === 'select' ? f.options!.map((o) => ({ v: o, l: o })) : list(f.ref!).map((i) => ({ v: i.id, l: label(f.ref!, i) }))
            return (
              <select key={f.key} style={{ maxWidth: 190 }} value={flt[f.key] ?? ''} onChange={(e) => setFlt({ ...flt, [f.key]: e.target.value })}>
                <option value="">{f.label}: todos</option>
                {opts.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            )
          })}
          <span className="grow" />
          <span className="muted small">{rows.length} registro(s)</span>
          {embedded && (
            <button className="btn sm primary" onClick={() => openEditor(col, undefined, preset)}>
              <Icon name="plus" size={14} /> Novo
            </button>
          )}
          <button className="btn sm" onClick={exportCSV} title="Exportar para Excel (CSV)">
            <Icon name="download" size={14} /> CSV
          </button>
        </div>
        <div style={{ padding: current === 'tabela' ? 0 : 12 }}>
          {current === 'tabela' && <Table col={col} rows={rows} />}
          {current === 'kanban' && <Kanban col={col} rows={rows} preset={preset} />}
          {current === 'gantt' && m.timeline && <Gantt col={col} rows={rows} start={m.timeline.start} end={m.timeline.end} groupBy={m.personField ?? 'responsavel'} />}
          {extra?.render(rows)}
        </div>
      </div>
    </div>
  )
}
