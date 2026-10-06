import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { PageHead, Seg, useLocalState } from '../components/ui'
import { MOD } from '../data/schema'
import { getPref, setPref, useDB } from '../data/store'
import { allEvents, type CalEvent } from '../lib/alerts'
import { MES_CURTO, MES_LONGO, addDays, fmtDate, iso, startOfWeek, todayISO } from '../lib/format'

// Cor por módulo de origem
const COR: Record<string, string> = {
  tarefas: 'var(--info)', projetos: '#7b5fc4', reunioes: 'var(--accent)', ferias: '#2f8f83', exames: '#c2555b', certificacoes: 'var(--warn)',
  pdis: '#3d7fc9', krs: 'var(--ok)', incentivos: '#b5832a', ponto: '#6b7a99', onboarding: '#2f8f83', avaliacoes: '#7b5fc4', vagas: '#6b7a99', candidatos: '#6b7a99', treinoInterno: '#3d7fc9', umaum: 'var(--accent)',
}
const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

type Modo = 'dia' | 'trabalho' | 'semana' | 'mes' | 'agenda'
const MODOS: { v: Modo; l: string }[] = [
  { v: 'dia', l: 'Dia' },
  { v: 'trabalho', l: 'Semana de trabalho' },
  { v: 'semana', l: 'Semana' },
  { v: 'mes', l: 'Mês' },
  { v: 'agenda', l: 'Agenda' },
]

const minDe = (h?: string) => {
  const m = h?.match(/^(\d{1,2}):(\d{2})/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export function Calendario() {
  const db = useDB()
  const events = useMemo(() => allEvents(db), [db])
  // visão preferida fica lembrada neste computador
  const [modo, setModoState] = useState<Modo>(() => getPref<Modo>('cal:modo', 'trabalho'))
  const setModo = (m: Modo) => {
    setModoState(m)
    setPref('cal:modo', m)
  }
  const [ref, setRef] = useState(() => new Date())
  const [hideDone, setHideDone] = useLocalState('cal:hide', true)
  const [off, setOff] = useLocalState<string[]>('cal:off', [])
  const cols = [...new Set(events.map((e) => e.col))]
  const vis = useMemo(() => events.filter((e) => !(hideDone && e.done) && !off.includes(e.col)), [events, hideDone, off])
  const byDay = useMemo(() => {
    const m: Record<string, CalEvent[]> = {}
    for (const e of vis) (m[e.date] ??= []).push(e)
    for (const k in m) m[k].sort((a, b) => (a.hora ?? '99').localeCompare(b.hora ?? '99'))
    return m
  }, [vis])

  const dia = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const seg = startOfWeek(dia)
  const dias = modo === 'dia' ? [dia] : modo === 'trabalho' ? Array.from({ length: 5 }, (_, i) => addDays(seg, i)) : Array.from({ length: 7 }, (_, i) => addDays(seg, i))

  function mover(n: number) {
    if (modo === 'dia') setRef(addDays(dia, n))
    else if (modo === 'trabalho' || modo === 'semana') setRef(addDays(dia, 7 * n))
    else setRef(new Date(dia.getFullYear(), dia.getMonth() + n, 1))
  }
  const titulo =
    modo === 'dia'
      ? `${DOW[dia.getDay()]}, ${dia.getDate()} de ${MES_LONGO[dia.getMonth()]} ${dia.getFullYear()}`
      : modo === 'trabalho' || modo === 'semana'
        ? (() => {
            const a = dias[0]
            const b = dias[dias.length - 1]
            return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} de ${MES_LONGO[a.getMonth()]} ${a.getFullYear()}` : `${a.getDate()} ${MES_CURTO[a.getMonth()]} – ${b.getDate()} ${MES_CURTO[b.getMonth()]} ${b.getFullYear()}`
          })()
        : `${MES_LONGO[dia.getMonth()]} ${dia.getFullYear()}`

  return (
    <>
      <PageHead title="Calendário" desc="Tudo que tem data, de todos os módulos, num só lugar. Clique em um item para abrir; clique num horário vazio para marcar uma reunião.">
        <Seg value={modo} onChange={setModo} options={MODOS} />
      </PageHead>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn sm" onClick={() => setRef(new Date())}>
            Hoje
          </button>
          <button className="btn sm" onClick={() => mover(-1)} aria-label="Anterior">
            <Icon name="chevronL" size={15} />
          </button>
          <button className="btn sm" onClick={() => mover(1)} aria-label="Próximo">
            <Icon name="chevronR" size={15} />
          </button>
          <h2>{titulo.charAt(0).toUpperCase() + titulo.slice(1)}</h2>
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
        {modo === 'mes' && <Mes ref0={dia} byDay={byDay} />}
        {modo === 'agenda' && <Agenda ref0={dia} vis={vis} />}
        {(modo === 'dia' || modo === 'trabalho' || modo === 'semana') && <Grade dias={dias} byDay={byDay} />}
      </div>
    </>
  )
}

function Mes({ ref0, byDay }: { ref0: Date; byDay: Record<string, CalEvent[]> }) {
  const ini = startOfWeek(new Date(ref0.getFullYear(), ref0.getMonth(), 1))
  const days = Array.from({ length: 42 }, (_, i) => addDays(ini, i))
  const hoje = todayISO()
  return (
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
          <div key={k} className={`day ${d.getMonth() !== ref0.getMonth() ? 'out' : ''} ${k === hoje ? 'today' : ''}`}>
            <span className="dn">{d.getDate()}</span>
            {evs.slice(0, 4).map((e, i) => (
              <a key={i} className="ev" style={{ borderLeftColor: COR[e.col], opacity: e.done || e.cancelada ? 0.5 : 1 }} title={`${e.kind}: ${e.title}`} onClick={() => openEditor(e.col, e.id)}>
                {e.title}
              </a>
            ))}
            {evs.length > 4 && <span className="small muted">+{evs.length - 4}</span>}
          </div>
        )
      })}
    </div>
  )
}

function Agenda({ ref0, vis }: { ref0: Date; vis: CalEvent[] }) {
  const ini = iso(new Date(ref0.getFullYear(), ref0.getMonth(), 1))
  const fim = iso(new Date(ref0.getFullYear(), ref0.getMonth() + 1, 0))
  const hoje = todayISO()
  const lista = vis.filter((e) => e.date >= ini && e.date <= fim).sort((a, b) => (a.date + (a.hora ?? '99')).localeCompare(b.date + (b.hora ?? '99')))
  if (!lista.length) return <div className="empty">Nada neste mês.</div>
  return (
    <div className="list">
      {lista.map((e, i) => (
        <div key={i}>
          <span className="small" style={{ width: 84, fontWeight: e.date === hoje ? 700 : 400 }}>
            {fmtDate(e.date)}
          </span>
          <span className="dot" style={{ background: COR[e.col] }} />
          <a className="grow" onClick={() => openEditor(e.col, e.id)} style={{ cursor: 'pointer', textDecoration: e.cancelada ? 'line-through' : undefined }}>
            {e.title}
          </a>
          <span className="chip">{e.kind}</span>
          <Link className="small" to={'/' + (e.col === 'krs' ? 'okr' : e.col === 'umaum' ? 'one-on-one' : e.path)}>
            módulo →
          </Link>
        </div>
      ))}
    </div>
  )
}

// ───────── grade de horários (dia / semana de trabalho / semana)
const H = 48 // px por hora

type Bloco = { e: CalEvent; ini: number; fim: number; col: number; cols: number }

/** Distribui reuniões sobrepostas lado a lado. */
function blocos(evs: CalEvent[]): Bloco[] {
  const bs = evs
    .map((e) => {
      const ini = minDe(e.hora)!
      const f = minDe(e.fim)
      return { e, ini, fim: f && f > ini ? f : ini + 30, col: 0, cols: 1 }
    })
    .sort((a, b) => a.ini - b.ini || b.fim - a.fim)
  let grupo: Bloco[] = []
  let fimGrupo = -1
  const fechar = () => {
    const n = Math.max(1, ...grupo.map((b) => b.col + 1))
    grupo.forEach((b) => (b.cols = n))
    grupo = []
  }
  for (const b of bs) {
    if (b.ini >= fimGrupo && grupo.length) fechar()
    const ocupadas = grupo.filter((x) => x.fim > b.ini).map((x) => x.col)
    let c = 0
    while (ocupadas.includes(c)) c++
    b.col = c
    grupo.push(b)
    fimGrupo = Math.max(fimGrupo, b.fim)
  }
  if (grupo.length) fechar()
  return bs
}

function Grade({ dias, byDay }: { dias: Date[]; byDay: Record<string, CalEvent[]> }) {
  const hoje = todayISO()
  const corpo = useRef<HTMLDivElement>(null)
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const chaves = dias.map(iso)
  const comHora = chaves.flatMap((k) => (byDay[k] ?? []).filter((e) => minDe(e.hora) != null))
  const ini = Math.min(7, ...comHora.map((e) => Math.floor(minDe(e.hora)! / 60)))
  const fim = Math.max(20, ...comHora.map((e) => Math.ceil((minDe(e.fim) ?? minDe(e.hora)! + 30) / 60)))
  const horas = Array.from({ length: fim - ini }, (_, i) => ini + i)
  const nAgora = agora.getHours() * 60 + agora.getMinutes()
  // abre já mostrando a partir das 7h
  useEffect(() => {
    if (corpo.current) corpo.current.scrollTop = Math.max(0, (7 - ini) * H)
  }, [ini])
  const tpl = `56px repeat(${dias.length}, minmax(0, 1fr))`

  function novo(e: React.MouseEvent<HTMLDivElement>, data: string) {
    if (e.target !== e.currentTarget) return
    const y = e.nativeEvent.offsetY
    const m = Math.floor(((y / H) * 60) / 30) * 30 + ini * 60
    const hora = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    const fimM = m + 30
    openEditor('reunioes', undefined, { data, hora, horaFim: `${String(Math.floor(fimM / 60)).padStart(2, '0')}:${String(fimM % 60).padStart(2, '0')}`, origem: 'Manual' })
  }

  return (
    <div className="tg">
      <div className="tg-head" style={{ gridTemplateColumns: tpl }}>
        <div />
        {dias.map((d) => {
          const k = iso(d)
          return (
            <div key={k} className={`tg-dia ${k === hoje ? 'hoje' : ''}`}>
              <b>{String(d.getDate()).padStart(2, '0')}</b>
              <span>{DOW[d.getDay()]}</span>
            </div>
          )
        })}
      </div>
      {/* itens sem hora (prazos, dia inteiro) */}
      <div className="tg-head tg-allday" style={{ gridTemplateColumns: tpl }}>
        <div className="small muted" style={{ padding: '4px 6px' }}>
          dia todo
        </div>
        {chaves.map((k) => (
          <div key={k} className="tg-allcell">
            {(byDay[k] ?? [])
              .filter((e) => minDe(e.hora) == null)
              .map((e, i) => (
                <a key={i} className="ev" style={{ borderLeftColor: COR[e.col], opacity: e.done ? 0.5 : 1 }} title={`${e.kind}: ${e.title}`} onClick={() => openEditor(e.col, e.id)}>
                  {e.col === 'reunioes' ? e.nome : `${e.kind}: ${e.title}`}
                </a>
              ))}
          </div>
        ))}
      </div>
      <div className="tg-body" ref={corpo}>
        <div className="tg-grid" style={{ gridTemplateColumns: tpl, height: horas.length * H }}>
          <div className="tg-horas">
            {horas.map((h) => (
              <span key={h} style={{ top: (h - ini) * H }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {chaves.map((k) => (
            <div key={k} className={`tg-col ${k === hoje ? 'hoje' : ''}`} style={{ backgroundSize: `100% ${H}px` }} onClick={(e) => novo(e, k)} title="Clique para marcar uma reunião">
              {blocos((byDay[k] ?? []).filter((e) => minDe(e.hora) != null)).map((b, i) => (
                <a
                  key={i}
                  className={`tg-ev ${b.e.cancelada ? 'cancelada' : ''}`}
                  style={{
                    top: ((b.ini - ini * 60) / 60) * H,
                    height: Math.max(18, ((b.fim - b.ini) / 60) * H - 2),
                    left: `calc(${(b.col / b.cols) * 100}% + 2px)`,
                    width: `calc(${100 / b.cols}% - 4px)`,
                    borderLeftColor: COR[b.e.col],
                  }}
                  title={`${b.e.hora}${b.e.fim ? '–' + b.e.fim : ''} ${b.e.nome}`}
                  onClick={() => openEditor(b.e.col, b.e.id)}
                >
                  <b>{b.e.nome}</b>
                  {b.fim - b.ini >= 45 && (
                    <span>
                      {b.e.hora}
                      {b.e.fim ? `–${b.e.fim}` : ''}
                    </span>
                  )}
                </a>
              ))}
              {k === hoje && nAgora >= ini * 60 && nAgora <= fim * 60 && <i className="tg-agora" style={{ top: ((nAgora - ini * 60) / 60) * H }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
