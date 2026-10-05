import { Bar, Chip, PageHead, useLocalState } from '../components/ui'
import { FECHAMENTO } from '../data/content'
import { get, upsert, useDB, type Item } from '../data/store'
import { fmtMonth, todayISO } from '../lib/format'

type Check = { ok?: boolean; resp?: string; data?: string; obs?: string }
const TOTAL = FECHAMENTO.reduce((a, g) => a + g.itens.length, 0)
const keyOf = (g: number, i: number) => `${g}.${i}`

function prevMonth() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function Fechamento() {
  const db = useDB()
  const [comp, setComp] = useLocalState('fech:comp', prevMonth())
  const reg = get('fechamento', comp)
  const checks = (reg?.checks as Record<string, Check>) ?? {}
  const pessoas = db.pessoas ?? []
  const feitos = Object.values(checks).filter((c) => c.ok).length

  function set(k: string, patch: Check) {
    const cur = checks[k] ?? {}
    const next = { ...cur, ...patch }
    if (patch.ok && !cur.data) next.data = todayISO()
    upsert('fechamento', { id: comp, competencia: comp, checks: { ...checks, [k]: next } })
  }

  const hist = [...(db.fechamento ?? [])].sort((a, b) => String(b.id).localeCompare(String(a.id)))

  return (
    <>
      <PageHead title="Checklist de fechamento mensal" desc="Organização é sinônimo de confiabilidade: dados consistentes, compliance e decisões mais assertivas. Um checklist por competência, com responsável e data.">
        <input type="month" value={comp} onChange={(e) => e.target.value && setComp(e.target.value)} style={{ width: 170 }} />
      </PageHead>
      <div className="card row">
        <b>
          {fmtMonth(comp)} · {feitos} de {TOTAL} itens
        </b>
        <span style={{ width: 260 }}>
          <Bar value={feitos} max={TOTAL} t={feitos === TOTAL ? 'ok' : undefined} />
        </span>
        <span className="grow" />
        {hist.slice(0, 6).map((h: Item) => {
          const n = Object.values((h.checks as Record<string, Check>) ?? {}).filter((c) => c.ok).length
          return (
            <button key={h.id} className={`chip ${h.id === comp ? 'gold' : n === TOTAL ? 'ok' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setComp(h.id)}>
              {fmtMonth(h.id)} {Math.round((n / TOTAL) * 100)}%
            </button>
          )
        })}
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        {FECHAMENTO.map((g, gi) => {
          const done = g.itens.filter((_, i) => checks[keyOf(gi, i)]?.ok).length
          return (
            <div key={g.grupo} className="card flush">
              <div className="row" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <h3 className="grow">{g.grupo}</h3>
                <Chip t={done === g.itens.length ? 'ok' : done ? 'info' : 'muted'}>
                  {done}/{g.itens.length}
                </Chip>
              </div>
              <table>
                <tbody>
                  {g.itens.map((it, i) => {
                    const k = keyOf(gi, i)
                    const c = checks[k] ?? {}
                    return (
                      <tr key={k}>
                        <td style={{ width: 28 }}>
                          <input type="checkbox" checked={!!c.ok} onChange={(e) => set(k, { ok: e.target.checked })} />
                        </td>
                        <td style={{ textDecoration: c.ok ? 'line-through' : undefined, color: c.ok ? 'var(--muted)' : undefined }}>{it}</td>
                        <td style={{ width: 130 }}>
                          <select value={c.resp ?? ''} onChange={(e) => set(k, { resp: e.target.value })} style={{ padding: '3px 6px', fontSize: 12 }}>
                            <option value="">resp.</option>
                            {pessoas.map((p) => (
                              <option key={p.id} value={p.id}>
                                {String(p.nome).split(' ')[0]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="small muted" style={{ width: 52 }}>
                          {c.data ? `${c.data.slice(8, 10)}/${c.data.slice(5, 7)}` : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </>
  )
}
