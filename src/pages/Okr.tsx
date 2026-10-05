import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { Bar, Chip, PageHead, useLocalState } from '../components/ui'
import { upsert, useDB, type DB, type Item } from '../data/store'
import { krProgress, objProgress } from '../lib/calc'
import { fmtDate, n } from '../lib/format'

export function Okr() {
  const db = useDB()
  const ciclos = [...new Set((db.objetivos ?? []).map((o) => String(o.ciclo ?? '')))].sort().reverse()
  const [ciclo, setCiclo] = useLocalState('okr:ciclo', '')
  const objs = (db.objetivos ?? []).filter((o) => !ciclo || o.ciclo === ciclo)
  const ids = new Set(objs.map((o) => o.id))
  const roots = objs.filter((o) => !o.pai || !ids.has(o.pai as string))
  return (
    <>
      <PageHead title="OKR" desc="Objetivos desdobrados (empresa → área → equipe → pessoa), resultados-chave com check-in de progresso e confiança, e os projetos que os movem.">
        <select value={ciclo} onChange={(e) => setCiclo(e.target.value)} style={{ width: 150 }}>
          <option value="">Todos os ciclos</option>
          {ciclos.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="btn primary" onClick={() => openEditor('objetivos')}>
          <Icon name="plus" size={16} /> Objetivo
        </button>
      </PageHead>
      {roots.length === 0 && <div className="card empty">Nenhum objetivo neste ciclo.</div>}
      {roots.map((o) => (
        <Node key={o.id} o={o} db={db} depth={0} />
      ))}
    </>
  )
}

function Node({ o, db, depth }: { o: Item; db: DB; depth: number }) {
  const krs = (db.krs ?? []).filter((k) => k.objetivo === o.id)
  const kids = (db.objetivos ?? []).filter((x) => x.pai === o.id)
  const p = objProgress(db, o.id)
  return (
    <div style={{ marginLeft: depth ? 28 : 0, borderLeft: depth ? '2px solid var(--border)' : undefined, paddingLeft: depth ? 14 : 0 }} className="stack">
      <div className="card">
        <div className="row">
          <Chip t="gold">{String(o.nivel ?? 'Objetivo')}</Chip>
          <h2 className="grow" style={{ cursor: 'pointer' }} onClick={() => openEditor('objetivos', o.id)}>
            {String(o.titulo)}
          </h2>
          <span className="muted small">
            {String(o.dono ?? '')} · {String(o.ciclo ?? '')}
          </span>
          <b style={{ width: 44, textAlign: 'right' }}>{Math.round(p)}%</b>
          <span style={{ width: 120 }}>
            <Bar value={p} t={p >= 70 ? 'ok' : p >= 40 ? 'warn' : 'bad'} />
          </span>
        </div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <tbody>
              {krs.map((k) => (
                <KrRow key={k.id} k={k} db={db} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn sm" onClick={() => openEditor('krs', undefined, { objetivo: o.id })}>
            + Resultado-chave
          </button>
          <button className="btn sm ghost" onClick={() => openEditor('objetivos', undefined, { pai: o.id, ciclo: o.ciclo, nivel: o.nivel === 'Empresa' ? 'Área' : o.nivel === 'Área' ? 'Equipe' : 'Pessoa' })}>
            + Desdobrar objetivo
          </button>
        </div>
      </div>
      {kids.map((c) => (
        <Node key={c.id} o={c} db={db} depth={depth + 1} />
      ))}
    </div>
  )
}

function KrRow({ k, db }: { k: Item; db: DB }) {
  const p = krProgress(k)
  const projs = (db.projetos ?? []).filter((x) => x.okr === k.id)
  return (
    <tr>
      <td style={{ width: '40%' }}>
        <a style={{ cursor: 'pointer' }} onClick={() => openEditor('krs', k.id)}>
          {String(k.titulo)}
        </a>
        {projs.length > 0 && <div className="small muted">Projetos: {projs.map((x) => String(x.nome)).join(', ')}</div>}
        {k.checkin != null && k.checkin !== '' && <div className="small muted">⚑ {String(k.checkin)}</div>}
      </td>
      <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
        {n(k.inicial)} → <b style={{ color: 'var(--text)' }}>{n(k.alvo)}</b> {String(k.unidade ?? '')}
      </td>
      <td style={{ width: 110 }}>
        <input type="number" value={String(k.atual ?? '')} onChange={(e) => upsert('krs', { id: k.id, atual: e.target.value === '' ? null : Number(e.target.value) })} title="Check-in: valor atual" />
      </td>
      <td style={{ width: 120 }}>
        <select value={String(k.confianca ?? 'Média')} onChange={(e) => upsert('krs', { id: k.id, confianca: e.target.value })}>
          <option>Alta</option>
          <option>Média</option>
          <option>Baixa</option>
        </select>
      </td>
      <td style={{ width: 130 }}>
        <Bar value={p} t={k.confianca === 'Baixa' ? 'bad' : k.confianca === 'Média' ? 'warn' : 'ok'} />
        <span className="small muted">{Math.round(p)}%</span>
      </td>
      <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
        {fmtDate(k.prazo)}
      </td>
    </tr>
  )
}
