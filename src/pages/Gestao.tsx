import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { Bar, Chip, Kpi } from '../components/ui'
import { cellText } from '../components/Views'
import { get, type Item } from '../data/store'
import { isDone } from '../lib/alerts'
import { daysUntil, fmtDate, money, pct } from '../lib/format'

const gut = (t: Item) => Number(t.g || 0) * Number(t.u || 0) * Number(t.t || 0)

export function Tarefas() {
  return (
    <ModulePage
      col="tarefas"
      defaultView="kanban"
      extraViews={[
        {
          key: 'gut',
          label: 'Prioridade GUT',
          render: (rows) => {
            const open = rows.filter((t) => !isDone('tarefas', t)).sort((a, b) => gut(b) - gut(a))
            return (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tarefa</th>
                      <th className="num">G</th>
                      <th className="num">U</th>
                      <th className="num">T</th>
                      <th className="num">GUT</th>
                      <th>Responsável</th>
                      <th>Prazo</th>
                      <th>Delegação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.map((t, i) => (
                      <tr key={t.id} className="click" onClick={() => openEditor('tarefas', t.id)}>
                        <td className="muted">{i + 1}</td>
                        <td>{String(t.titulo)}</td>
                        <td className="num">{String(t.g ?? '—')}</td>
                        <td className="num">{String(t.u ?? '—')}</td>
                        <td className="num">{String(t.t ?? '—')}</td>
                        <td className="num">
                          <Chip t={gut(t) >= 64 ? 'bad' : gut(t) >= 27 ? 'warn' : 'muted'}>{gut(t) || '—'}</Chip>
                        </td>
                        <td>{cellText('tarefas', 'responsavel', t)}</td>
                        <td className={(daysUntil(t.prazo) ?? 1) < 0 ? 'neg' : ''}>{fmtDate(t.prazo)}</td>
                        <td>{String(t.delegacao ?? 'Minha')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small muted" style={{ padding: '0 12px' }}>
                  GUT = Gravidade × Urgência × Tendência (1 a 5). ≥ 64 crítico · ≥ 27 atenção.
                </p>
              </div>
            )
          },
        },
      ]}
    />
  )
}

export function Projetos() {
  return (
    <ModulePage
      col="projetos"
      defaultView="tabela"
      above={(rows) => {
        const ativos = rows.filter((p) => !isDone('projetos', p))
        const s = (k: string) => ativos.reduce((a, p) => a + Number(p[k] || 0), 0)
        return (
          <div className="grid g4">
            <Kpi l="Projetos ativos" v={ativos.length} d={`${ativos.filter((p) => p.status === 'Em risco').length} em risco`} />
            <Kpi l="Horas real / plan." v={`${s('horasReal')} / ${s('horasPlan')}`} d={pct(s('horasPlan') ? (s('horasReal') / s('horasPlan')) * 100 : 0) + ' consumido'} />
            <Kpi l="Custo real / plan." v={money(s('custoReal'))} d={`de ${money(s('custoPlan'))} planejado`} />
            <Kpi l="No Incentive Model" v={ativos.filter((p) => p.noIncentive).length} d="projetos vinculados a metas" />
          </div>
        )
      }}
      extraViews={[
        {
          key: 'pxr',
          label: 'Planejado × realizado',
          render: (rows) => (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Projeto</th>
                    <th>Progresso</th>
                    <th className="num">Horas plan.</th>
                    <th className="num">Horas real</th>
                    <th className="num">Desvio h</th>
                    <th className="num">Custo plan.</th>
                    <th className="num">Custo real</th>
                    <th className="num">Desvio R$</th>
                    <th>Meta do Incentive</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const dh = Number(p.horasReal || 0) - Number(p.horasPlan || 0) * (Number(p.progresso || 0) / 100)
                    const dc = Number(p.custoReal || 0) - Number(p.custoPlan || 0) * (Number(p.progresso || 0) / 100)
                    const meta = get('incentivos', p.incentivo as string)
                    return (
                      <tr key={p.id} className="click" onClick={() => openEditor('projetos', p.id)}>
                        <td>{String(p.nome)}</td>
                        <td style={{ minWidth: 100 }}>
                          <Bar value={Number(p.progresso || 0)} />
                        </td>
                        <td className="num">{Number(p.horasPlan || 0)}</td>
                        <td className="num">{Number(p.horasReal || 0)}</td>
                        <td className={`num ${dh > 0 ? 'neg' : 'pos'}`} title="Real − (planejado × % de progresso)">
                          {dh > 0 ? '+' : ''}
                          {Math.round(dh)}
                        </td>
                        <td className="num">{money(p.custoPlan)}</td>
                        <td className="num">{money(p.custoReal)}</td>
                        <td className={`num ${dc > 0 ? 'neg' : 'pos'}`}>{money(dc)}</td>
                        <td className="small">{meta ? `${String(meta.meta)} · peso ${pct(meta.peso)} · ating. ${pct(meta.atingimento)}` : p.noIncentive ? <Chip t="warn">vincular meta</Chip> : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="small muted" style={{ padding: '0 12px' }}>
                Desvio = realizado − (planejado × % de progresso). Positivo = consumindo mais que o avanço entregue (earned value simplificado).
              </p>
            </div>
          ),
        },
      ]}
    />
  )
}

const QUAD: [string, string][] = [
  ['Forças', 'ok'],
  ['Fraquezas', 'bad'],
  ['Oportunidades', 'info'],
  ['Ameaças', 'warn'],
]

export function Diagnostico() {
  return (
    <ModulePage
      col="swot"
      defaultView="matriz"
      extraViews={[
        {
          key: 'matriz',
          label: 'Matriz SWOT',
          render: (rows) => {
            const temas = [...new Set(rows.map((r) => String(r.tema ?? 'Geral')))]
            return temas.map((tema) => (
              <div key={tema} className="stack" style={{ marginBottom: 16 }}>
                <h2>{tema}</h2>
                <div className="quad">
                  {QUAD.map(([q, t]) => (
                    <div key={q} className="card" style={{ borderTop: `3px solid var(--${t})` }}>
                      <div className="row">
                        <h3 className="grow">{q}</h3>
                        <button className="btn ghost sm" onClick={() => openEditor('swot', undefined, { tema, quadrante: q })}>
                          +
                        </button>
                      </div>
                      <div className="list">
                        {rows
                          .filter((r) => String(r.tema ?? 'Geral') === tema && r.quadrante === q)
                          .sort((a, b) => Number(b.impacto || 0) - Number(a.impacto || 0))
                          .map((r) => (
                            <div key={r.id} style={{ cursor: 'pointer' }} onClick={() => openEditor('swot', r.id)}>
                              <span className="grow">{String(r.item)}</span>
                              <span style={{ color: 'var(--accent)' }}>{'★'.repeat(Number(r.impacto || 0))}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="small muted">Cruze Forças × Oportunidades para ofensivas e Fraquezas × Ameaças para defesas. Transforme cada ação em um objetivo (OKR), projeto ou tarefa.</p>
              </div>
            ))
          },
        },
      ]}
    />
  )
}

