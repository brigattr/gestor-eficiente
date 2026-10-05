import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { PageHead, Seg, useLocalState } from '../components/ui'
import { MOD } from '../data/schema'
import { useDB } from '../data/store'
import { allEvents, type CalEvent } from '../lib/alerts'
import { MES_LONGO, addDays, fmtDate, iso, startOfWeek, todayISO } from '../lib/format'

// Cor por módulo de origem
const COR: Record<string, string> = {
  tarefas: 'var(--info)', projetos: '#7b5fc4', reunioes: 'var(--accent)', ferias: '#2f8f83', exames: '#c2555b', certificacoes: 'var(--warn)',
  pdis: '#3d7fc9', krs: 'var(--ok)', incentivos: '#b5832a', ponto: '#6b7a99', onboarding: '#2f8f83', avaliacoes: '#7b5fc4', vagas: '#6b7a99', candidatos: '#6b7a99', treinoInterno: '#3d7fc9', umaum: 'var(--accent)',
}

export function Calendario() {
  const db = useDB()
  const events = useMemo(() => allEvents(db), [db])
  const [ref, setRef] = useState(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })
  const [mode, setMode] = useLocalState<'mes' | 'agenda'>('cal:mode', 'mes')
  const [hideDone, setHideDone] = useLocalState('cal:hide', true)
  const [off, setOff] = useLocalState<string[]>('cal:off', [])
  const cols = [...new Set(events.map((e) => e.col))]
  const vis = events.filter((e) => !(hideDone && e.done) && !off.includes(e.col))
  const byDay = useMemo(() => {
    const m: Record<string, CalEvent[]> = {}
    for (const e of vis) (m[e.date] ??= []).push(e)
    return m
  }, [vis])

  const start = startOfWeek(ref)
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const hoje = todayISO()
  const mesIni = iso(ref)
  const mesFim = iso(new Date(ref.getFullYear(), ref.getMonth() + 1, 0))

  return (
    <>
      <PageHead title="Calendário" desc="Tudo que tem data, de todos os módulos, num só lugar. Clique em um item para abrir o registro de origem.">
        <Seg value={mode} onChange={setMode} options={[{ v: 'mes', l: 'Mês' }, { v: 'agenda', l: 'Agenda' }]} />
      </PageHead>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn sm" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}>
            <Icon name="chevronL" size={15} />
          </button>
          <h2 style={{ minWidth: 170, textAlign: 'center', textTransform: 'capitalize' }}>
            {MES_LONGO[ref.getMonth()]} {ref.getFullYear()}
          </h2>
          <button className="btn sm" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}>
            <Icon name="chevronR" size={15} />
          </button>
          <button
            className="btn sm"
            onClick={() => {
              const t = new Date()
              setRef(new Date(t.getFullYear(), t.getMonth(), 1))
            }}
          >
            Hoje
          </button>
          <span className="grow" />
          <label className="row small">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> ocultar concluídos
          </label>
        </div>
        <div className="row" style={{ marginBottom: 12, gap: 6 }}>
          {cols.map((c) => (
            <button key={c} className={`chip ${off.includes(c) ? '' : 'info'}`} style={{ cursor: 'pointer', borderLeft: `4px solid ${COR[c] ?? 'var(--info)'}` }} onClick={() => setOff(off.includes(c) ? off.filter((x) => x !== c) : [...off, c])}>
              {MOD[c].title}
            </button>
          ))}
        </div>
        {mode === 'mes' ? (
          <div className="cal">
            {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => (
              <div key={d} className="dow">
                {d}
              </div>
            ))}
            {days.map((d) => {
              const k = iso(d)
              const evs = byDay[k] ?? []
              return (
                <div key={k} className={`day ${d.getMonth() !== ref.getMonth() ? 'out' : ''} ${k === hoje ? 'today' : ''}`}>
                  <span className="dn">{d.getDate()}</span>
                  {evs.slice(0, 4).map((e, i) => (
                    <a key={i} className="ev" style={{ borderLeftColor: COR[e.col], opacity: e.done ? 0.5 : 1 }} title={`${e.kind}: ${e.title}`} onClick={() => openEditor(e.col, e.id)}>
                      {e.title}
                    </a>
                  ))}
                  {evs.length > 4 && <span className="small muted">+{evs.length - 4}</span>}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="list">
            {vis.filter((e) => e.date >= mesIni && e.date <= mesFim).map((e, i) => (
              <div key={i}>
                <span className="small" style={{ width: 84, fontWeight: e.date === hoje ? 700 : 400 }}>
                  {fmtDate(e.date)}
                </span>
                <span className="dot" style={{ background: COR[e.col] }} />
                <a className="grow" onClick={() => openEditor(e.col, e.id)} style={{ cursor: 'pointer' }}>
                  {e.title}
                </a>
                <span className="chip">{e.kind}</span>
                <Link className="small" to={'/' + (e.col === 'krs' ? 'okr' : e.col === 'umaum' ? 'one-on-one' : e.path)}>
                  módulo →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
