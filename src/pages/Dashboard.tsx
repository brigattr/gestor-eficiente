import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BudgetChart, Donut } from '../components/Charts'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { Bar, Chip, Kpi, PageHead } from '../components/ui'
import { useDB } from '../data/store'
import { allEvents, computeAlerts, isDone } from '../lib/alerts'
import { budgetVsReal, krProgress, objProgress, ytd } from '../lib/calc'
import { addDays, daysUntil, fmtDate, iso, money, pct, todayISO } from '../lib/format'

export function Dashboard() {
  const db = useDB()
  const ano = new Date().getFullYear()
  const alerts = useMemo(() => computeAlerts(db), [db])
  const events = useMemo(() => allEvents(db), [db])
  const hoje = todayISO()
  const em7 = iso(addDays(new Date(), 7))
  const proximos = events.filter((e) => e.date >= hoje && e.date <= em7 && !e.done)

  const tarefas = db.tarefas ?? []
  const abertas = tarefas.filter((t) => !isDone('tarefas', t))
  const atrasadas = abertas.filter((t) => (daysUntil(t.prazo) ?? 1) < 0)
  const projetos = (db.projetos ?? []).filter((p) => !isDone('projetos', p))
  const risco = projetos.filter((p) => p.status === 'Em risco')
  const bvr = budgetVsReal(db, ano)
  const y = ytd(bvr.months)
  const consumo = y.budget ? (y.real / y.budget) * 100 : 0
  const objs = (db.objetivos ?? []).filter((o) => !o.pai)
  const okr = objs.length ? objs.reduce((a, o) => a + objProgress(db, o.id), 0) / objs.length : 0
  const krs = db.krs ?? []
  const sem = { ok: krs.filter((k) => k.confianca === 'Alta').length, warn: krs.filter((k) => k.confianca === 'Média').length, bad: krs.filter((k) => k.confianca === 'Baixa').length }
  const ativos = (db.pessoas ?? []).filter((p) => p.status !== 'Desligado')

  return (
    <>
      <PageHead title="Visão geral" desc="O que precisa da sua atenção hoje: prazos, riscos, pessoas e números da área." />
      <div className="grid g4">
        <Kpi l="Tarefas abertas" v={abertas.length} d={<span style={{ color: atrasadas.length ? 'var(--bad)' : undefined }}>{atrasadas.length} atrasada(s)</span>} />
        <Kpi l="Projetos ativos" v={projetos.length} d={<span style={{ color: risco.length ? 'var(--bad)' : undefined }}>{risco.length} em risco</span>} />
        <Kpi l={`Despesas YTD ${ano}`} v={pct(Math.round(consumo))} t={consumo > 100 ? 'bad' : undefined} d={`${money(y.real)} de ${money(y.budget)} orçado`} />
        <Kpi l="Time ativo" v={ativos.length} d={`${(db.vagas ?? []).filter((v) => !isDone('vagas', v)).length} vaga(s) aberta(s)`} />
      </div>

      <div className="grid g3">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-head">
            <Icon name="alert" />
            <h2 className="grow">Pontos de atenção</h2>
            <span className="muted small">{alerts.length}</span>
          </div>
          {alerts.length === 0 ? (
            <div className="empty">Nada pendente. 👏</div>
          ) : (
            <div className="list" style={{ maxHeight: 330, overflowY: 'auto' }}>
              {alerts.map((a, i) => (
                <div key={i}>
                  <span className="dot" style={{ background: `var(--${a.level})` }} />
                  <span className="grow">{a.text}</span>
                  {a.id ? (
                    <button className="btn sm" onClick={() => openEditor(a.col, a.id)}>
                      Abrir
                    </button>
                  ) : (
                    <Link className="btn sm" to={'/' + a.path}>
                      Ver
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <Icon name="calendar" />
            <h2 className="grow">Próximos 7 dias</h2>
            <Link to="/calendario" className="small">
              calendário →
            </Link>
          </div>
          {proximos.length === 0 ? (
            <div className="empty">Sem prazos na semana.</div>
          ) : (
            <div className="list" style={{ maxHeight: 330, overflowY: 'auto' }}>
              {proximos.map((e, i) => (
                <div key={i} style={{ cursor: 'pointer' }} onClick={() => openEditor(e.col, e.id)}>
                  <span className="small muted" style={{ width: 44 }}>
                    {fmtDate(e.date).slice(0, 5)}
                  </span>
                  <span className="grow small">{e.title}</span>
                  <Chip t="muted">{e.kind}</Chip>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid g3">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-head">
            <Icon name="wallet" />
            <h2 className="grow">Budget × realizado {ano} (todos os centros de custo)</h2>
            <Link to="/despesas" className="small">
              detalhar →
            </Link>
          </div>
          <BudgetChart months={bvr.months} />
          <div className="row small muted">
            <span className="dot" style={{ background: 'var(--brand-2)' }} /> realizado
            <span className="dot" style={{ background: 'var(--bad)' }} /> acima do budget
            <span style={{ border: '1px dashed var(--brand-2)', width: 12, height: 8 }} /> budget · FY {money(y.fy)}
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <Icon name="crosshair" />
            <h2 className="grow">OKR</h2>
            <Link to="/okr" className="small">
              árvore →
            </Link>
          </div>
          <div className="row" style={{ gap: 16 }}>
            <Donut value={okr} />
            <div className="small">
              <div>Semáforo de confiança dos KRs</div>
              <div className="row" style={{ marginTop: 6 }}>
                <Chip t="ok">Alta {sem.ok}</Chip>
                <Chip t="warn">Média {sem.warn}</Chip>
                <Chip t="bad">Baixa {sem.bad}</Chip>
              </div>
            </div>
          </div>
          <div className="list" style={{ marginTop: 8 }}>
            {krs.slice(0, 5).map((k) => (
              <div key={k.id} style={{ cursor: 'pointer' }} onClick={() => openEditor('krs', k.id)}>
                <span className="grow small">{String(k.titulo)}</span>
                <span style={{ width: 70 }}>
                  <Bar value={krProgress(k)} t={k.confianca === 'Baixa' ? 'bad' : k.confianca === 'Média' ? 'warn' : 'ok'} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card flush">
        <div className="card-head" style={{ padding: '14px 16px 0' }}>
          <Icon name="folder" />
          <h2 className="grow">Projetos em andamento</h2>
          <Link to="/projetos" className="small">
            todos →
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Projeto</th>
                <th>Status</th>
                <th>Progresso</th>
                <th className="num">Horas plan./real</th>
                <th className="num">Custo plan./real</th>
                <th>Término</th>
                <th>Incentive</th>
              </tr>
            </thead>
            <tbody>
              {projetos.map((p) => (
                <tr key={p.id} className="click" onClick={() => openEditor('projetos', p.id)}>
                  <td>{String(p.nome)}</td>
                  <td>
                    <Chip v={p.status} />
                  </td>
                  <td style={{ minWidth: 110 }}>
                    <Bar value={Number(p.progresso || 0)} />
                  </td>
                  <td className="num">
                    {Number(p.horasPlan || 0)} / {Number(p.horasReal || 0)}
                  </td>
                  <td className="num">
                    {money(p.custoPlan)} / {money(p.custoReal)}
                  </td>
                  <td className={(daysUntil(p.fim) ?? 1) < 0 ? 'neg' : ''}>{fmtDate(p.fim)}</td>
                  <td>{p.noIncentive ? <Chip t="gold">Sim</Chip> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
