import { Fragment } from 'react'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { Chip } from '../components/ui'
import { get, upsert, useDB, type DB, type Item } from '../data/store'
import { atingimento, bonus, filhos, pontos, scorecard } from '../lib/incentive'
import { label, n, pct } from '../lib/format'

const tom = (b: number | null) => (b == null ? 'muted' : b >= 100 ? 'ok' : b >= 50 ? 'warn' : 'bad')

/** Régua visual: posição do realizado entre 50% / 100% / 150%. */
function Regua({ g }: { g: Item }) {
  const db = useDB()
  const p = pontos(g)
  const b = bonus(db, g)
  if (filhos(db, g).length) return <span className="small muted">sub-KPIs</span>
  if (!p) return b != null ? <Chip t={tom(b)}>manual</Chip> : null
  const pos = b == null ? null : Math.max(0, Math.min(150, b)) / 150
  return (
    <div className="regua" title={`50%: ${n(p.v50)} · 100%: ${n(p.v100)} · 150%: ${n(p.v150)}`}>
      <span style={{ left: '33.3%' }} />
      <span style={{ left: '66.6%' }} />
      {pos != null && <i style={{ left: `${pos * 100}%`, background: `var(--${tom(b)})` }} />}
    </div>
  )
}

function Linha({ g, db, nivel }: { g: Item; db: DB; nivel: number }) {
  const b = bonus(db, g)
  const p = pontos(g)
  const kids = filhos(db, g)
  const at = atingimento(g)
  const projs = (db.projetos ?? []).filter((x) => x.incentivo === g.id)
  return (
    <Fragment>
      <tr>
        <td style={{ paddingLeft: 12 + nivel * 22 }}>
          <a style={{ cursor: 'pointer', fontWeight: nivel ? 600 : 800 }} onClick={() => openEditor('incentivos', g.id)}>
            {nivel ? '↳ ' : ''}
            {String(g.meta)}
          </a>
          {g.detalhes != null && g.detalhes !== '' && <div className="small muted pre">{String(g.detalhes)}</div>}
          {projs.length > 0 && <div className="small muted">Projeto: {projs.map((x) => String(x.nome)).join(', ')}</div>}
        </td>
        <td className="num">{pct(g.peso)}</td>
        <td className="small">{String(g.metrica ?? '')}</td>
        <td className="num muted">{p ? n(p.v50) : '—'}</td>
        <td className="num">
          <b>{p ? n(p.v100) : '—'}</b>
        </td>
        <td className="num muted">{p ? n(p.v150) : '—'}</td>
        <td style={{ width: 110 }}>
          {kids.length ? (
            <span className="small muted">pelos sub-KPIs</span>
          ) : p ? (
            <input
              type="number"
              step="any"
              value={g.real == null ? '' : String(g.real)}
              onChange={(e) => upsert('incentivos', { id: g.id, real: e.target.value === '' ? null : Number(e.target.value) })}
              title="Realizado / proposta de atingimento (simule aqui)"
            />
          ) : (
            <input
              type="number"
              value={g.bonusManual == null ? '' : String(g.bonusManual)}
              placeholder="bônus %"
              onChange={(e) => upsert('incentivos', { id: g.id, bonusManual: e.target.value === '' ? null : Number(e.target.value) })}
              title="Bônus % definido manualmente"
            />
          )}
        </td>
        <td className="num small">{at == null ? '—' : pct(Math.round(at * 10) / 10)}</td>
        <td style={{ width: 110 }}>
          <Regua g={g} />
        </td>
        <td className="num">
          <Chip t={tom(b)}>{b == null ? '—' : pct(Math.round(b))}</Chip>
        </td>
        <td className="num">{nivel === 0 && b != null ? pct(Math.round(((Number(g.peso || 0) * b) / 100) * 10) / 10) : ''}</td>
      </tr>
      {kids.map((k) => (
        <Linha key={k.id} g={k} db={db} nivel={nivel + 1} />
      ))}
    </Fragment>
  )
}

function Scorecards({ rows }: { rows: Item[] }) {
  const db = useDB()
  // grupos colaborador/ano a partir das metas visíveis (filtros da página)
  const chaves = [...new Set(rows.map((r) => `${r.colaborador ?? ''}|${r.ano}`))].sort()
  if (!chaves.length) return <div className="empty">Nenhum goal cadastrado.</div>
  return (
    <div className="stack">
      {chaves.map((k) => {
        const [pid, ano] = k.split('|')
        const sc = scorecard(db, pid || null, Number(ano))
        if (!sc.topo.length) return null
        const nome = pid ? label('pessoas', get('pessoas', pid)) : 'Minhas metas'
        const link = sc.topo.find((g) => g.sfLink)?.sfLink
        return (
          <div key={k} className="card flush">
            <div className="sf-head">
              <div className="grow">
                <div className="small" style={{ opacity: 0.8 }}>Incentives/KPIs {ano}</div>
                <h2 style={{ color: '#fff' }}>{nome}</h2>
              </div>
              <Chip t={Math.abs(sc.pesos - 100) < 0.01 ? 'ok' : 'warn'}>pesos {sc.pesos}%</Chip>
              <div className="sf-fator">
                <span className="small">Bônus projetado</span>
                <b>{pct(Math.round(sc.fator * 10) / 10)}</b>
                <span className="small">do target bonus</span>
              </div>
              {link != null && (
                <a className="btn sm" href={String(link)} target="_blank" rel="noreferrer">
                  <Icon name="link" size={14} /> SuccessFactors
                </a>
              )}
              <button className="btn sm gold" onClick={() => openEditor('incentivos', undefined, { colaborador: pid || null, ano: Number(ano) })}>
                + Goal
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Goal</th>
                    <th className="num">Peso</th>
                    <th>Metric</th>
                    <th className="num">50%</th>
                    <th className="num">100%</th>
                    <th className="num">150%</th>
                    <th>Realizado</th>
                    <th className="num">% target</th>
                    <th>Régua</th>
                    <th className="num">Bônus</th>
                    <th className="num">Contrib.</th>
                  </tr>
                </thead>
                <tbody>
                  {sc.topo.map((g) => (
                    <Linha key={g.id} g={g} db={db} nivel={0} />
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num">{pct(sc.pesos)}</td>
                    <td colSpan={8} className="small muted" style={{ fontWeight: 400 }}>
                      Régua: abaixo do ponto de 50% paga 0; linear entre 50% → 100% → 150%; acima do stretch limita em 150%.
                    </td>
                    <td className="num">{pct(Math.round(sc.fator * 10) / 10)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function Incentive() {
  return <ModulePage col="incentivos" defaultView="score" extraViews={[{ key: 'score', label: 'Formulário (scorecard)', render: (rows) => <Scorecards rows={rows} /> }]} />
}
