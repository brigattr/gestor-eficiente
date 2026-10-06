import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { Bar, Chip, PageHead } from '../components/ui'
import { ROTEIROS } from '../data/content'
import { upsert, useDB, type DB, type Item } from '../data/store'
import { allEvents, isDone } from '../lib/alerts'
import { addDays, fmtDate, iso, startOfWeek } from '../lib/format'

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

/** Pessoa do time citada nos participantes (para trazer contexto do 1:1). */
function pessoaDa(db: DB, r: Item) {
  const txt = String(r.participantes ?? '') + ' ' + String(r.titulo ?? '')
  return (db.pessoas ?? []).find((p) => {
    const nome = String(p.nome ?? '')
    return nome && (txt.includes(nome) || txt.includes(nome.split(' ')[0]))
  })
}

export function Semana() {
  const db = useDB()
  const [ref, setRef] = useState(() => startOfWeek(new Date()))
  const ini = iso(ref)
  const fim = iso(addDays(ref, 6))
  const reunioes = (db.reunioes ?? []).filter((r) => String(r.data) >= ini && String(r.data) <= fim).sort((a, b) => `${a.data}${a.hora ?? ''}`.localeCompare(`${b.data}${b.hora ?? ''}`))
  const prontas = reunioes.filter((r) => r.preparado).length
  const outros = useMemo(() => allEvents(db).filter((e) => e.date >= ini && e.date <= fim && e.col !== 'reunioes' && !e.done), [db, ini, fim])

  return (
    <>
      <PageHead title="Preparação da semana" desc="Momento de revisar todas as reuniões da semana e se preparar: arquivos, pauta, roteiro e contexto de cada pessoa.">
        <button className="btn" onClick={() => setRef(addDays(ref, -7))}>
          <Icon name="chevronL" size={15} />
        </button>
        <b>
          {fmtDate(ini).slice(0, 5)} – {fmtDate(fim)}
        </b>
        <button className="btn" onClick={() => setRef(addDays(ref, 7))}>
          <Icon name="chevronR" size={15} />
        </button>
        <button className="btn primary" onClick={() => openEditor('reunioes', undefined, { data: ini })}>
          <Icon name="plus" size={16} /> Reunião
        </button>
      </PageHead>
      <div className="card row">
        <b>
          {prontas} de {reunioes.length} reuniões preparadas
        </b>
        <span style={{ width: 220 }}>
          <Bar value={prontas} max={reunioes.length || 1} t={prontas === reunioes.length ? 'ok' : 'warn'} />
        </span>
        <span className="grow" />
        <span className="muted small">{outros.length} outros prazos nesta semana</span>
      </div>

      {DIAS.map((dia, i) => {
        const d = iso(addDays(ref, i))
        const rs = reunioes.filter((r) => r.data === d)
        const os = outros.filter((e) => e.date === d)
        if (!rs.length && !os.length) return null
        return (
          <div key={d} className="stack" style={{ gap: 10 }}>
            <h2>
              {dia} <span className="muted small">{fmtDate(d)}</span>
            </h2>
            {rs.map((r) => (
              <Prep key={r.id} r={r} db={db} />
            ))}
            {os.length > 0 && (
              <div className="row small">
                {os.map((e, k) => (
                  <button key={k} className="chip" style={{ cursor: 'pointer' }} onClick={() => openEditor(e.col, e.id)}>
                    {e.kind}: {e.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {!reunioes.length && !outros.length && <div className="card empty">Semana livre. Cadastre reuniões em Reuniões ou pelo botão acima.</div>}
    </>
  )
}

function Prep({ r, db }: { r: Item; db: DB }) {
  const p = pessoaDa(db, r)
  const materiais = String(r.materiais ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const perguntas = r.roteiro ? ROTEIROS[String(r.roteiro)] ?? [] : []
  const tarefas = p ? (db.tarefas ?? []).filter((t) => t.responsavel === p.id && !isDone('tarefas', t)) : []
  const ult = p ? (db.umaum ?? []).filter((u) => u.colaborador === p.id).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0] : undefined
  const pdis = p ? (db.pdis ?? []).filter((x) => x.colaborador === p.id && !isDone('pdis', x)) : []
  return (
    <div className="card" style={{ borderLeft: `4px solid ${r.preparado ? 'var(--ok)' : 'var(--accent)'}` }}>
      <div className="row">
        <b>
          {String(r.hora ?? '')}
          {r.horaFim ? `–${String(r.horaFim)}` : ''}
        </b>
        <h3 className="grow" style={r.canceladaOutlook ? { textDecoration: 'line-through' } : undefined}>
          {String(r.titulo)}
        </h3>
        {Boolean(r.canceladaOutlook) && <Chip t="bad">cancelada no Outlook</Chip>}
        {r.origem === 'Outlook' && <Chip t="info">Outlook</Chip>}
        {r.tipo != null && <Chip t="muted">{String(r.tipo)}</Chip>}
        <label className="row small" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={!!r.preparado} onChange={(e) => upsert('reunioes', { id: r.id, preparado: e.target.checked })} /> preparado
        </label>
        <button className="btn sm" onClick={() => openEditor('reunioes', r.id)}>
          <Icon name="edit" size={14} /> Editar
        </button>
      </div>
      <div className="grid g3" style={{ marginTop: 10 }}>
        <div className="small">
          <div className="muted">Pauta / o que preciso entender</div>
          <div className="pre">{String(r.pauta ?? '—')}</div>
          {r.local != null && r.local !== '' && <div className="muted" style={{ marginTop: 6 }}>Local: {String(r.local)}</div>}
          {r.organizador != null && <div className="muted">Organizador: {String(r.organizador)}</div>}
          {r.participantes != null && <div className="muted" style={{ marginTop: 6 }}>Participantes: {String(r.participantes)}</div>}
          {r.descricaoOutlook != null && r.descricaoOutlook !== '' && (
            <details style={{ marginTop: 6 }}>
              <summary className="muted" style={{ cursor: 'pointer' }}>Convite do Outlook</summary>
              <div className="pre" style={{ maxHeight: 180, overflow: 'auto' }}>{String(r.descricaoOutlook)}</div>
            </details>
          )}
        </div>
        <div className="small">
          <div className="muted">Arquivos e materiais</div>
          {materiais.length ? (
            materiais.map((m, i) => (
              <div key={i}>
                {/^https?:|^\\\\|^[a-z]:\\/i.test(m) ? (
                  <a href={m} target="_blank" rel="noreferrer">
                    {m}
                  </a>
                ) : (
                  <>☐ {m}</>
                )}
              </div>
            ))
          ) : (
            <div className="muted">Nenhum material listado.</div>
          )}
        </div>
        <div className="small">
          {perguntas.length > 0 && (
            <>
              <div className="muted">Roteiro: {String(r.roteiro)}</div>
              <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
                {perguntas.slice(0, 4).map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </>
          )}
          {p && (
            <div style={{ marginTop: 6 }}>
              <div className="muted">Contexto de {String(p.nome)}</div>
              {ult && <div>Último 1:1 ({fmtDate(ult.data)}): {String(ult.acordos ?? '—')}</div>}
              <div>{tarefas.length} tarefa(s) aberta(s) · {pdis.length} ação(ões) de PDI</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
