import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { Bar, Chip, Kpi, useLocalState } from '../components/ui'
import { MODULES } from '../data/schema'
import { get, useDB, type Item } from '../data/store'
import { isDone } from '../lib/alerts'
import { scorecard } from '../lib/incentive'
import { daysUntil, fmtDate, label, money, pct } from '../lib/format'

const initials = (s: unknown) =>
  String(s ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase()

function Avatar({ nome, size = 40 }: { nome: unknown; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--brand)', color: 'var(--brand-ink)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: size / 2.8, flex: 'none' }}>
      {initials(nome)}
    </span>
  )
}

export function Pessoas() {
  const db = useDB()
  return (
    <ModulePage
      col="pessoas"
      defaultView="cards"
      extraViews={[
        {
          key: 'cards',
          label: 'Cartões',
          render: (rows) => (
            <div className="grid g3">
              {rows.map((p) => {
                const abertas = (db.tarefas ?? []).filter((t) => t.responsavel === p.id && !isDone('tarefas', t)).length
                const pdi = (db.pdis ?? []).filter((t) => t.colaborador === p.id && !isDone('pdis', t)).length
                const av = (db.avaliacoes ?? []).filter((a) => a.colaborador === p.id).slice(-1)[0]
                return (
                  <Link key={p.id} to={`/pessoas/${p.id}`} className="card" style={{ color: 'inherit', textDecoration: 'none', display: 'grid', gap: 8 }}>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <Avatar nome={p.nome} />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <b>{String(p.nome)}</b>
                        <div className="small muted">{label('cargos', get('cargos', p.cargo as string))}</div>
                      </div>
                      <Chip v={p.status ?? 'Ativo'} />
                    </div>
                    <div className="row small muted">
                      <span>{String(p.area ?? '')}</span>·<span>{abertas} tarefa(s)</span>·<span>{pdi} PDI</span>
                      {av?.potencial != null && <Chip t="gold">Potencial {String(av.potencial)}</Chip>}
                    </div>
                  </Link>
                )
              })}
            </div>
          ),
        },
      ]}
    />
  )
}

// Abas do perfil: cada módulo ligado à pessoa
const ABAS: { col: string; key: string; label: string }[] = [
  ...MODULES.filter((m) => m.personField).map((m) => ({ col: m.col, key: m.personField!, label: m.title })),
  { col: 'tarefas', key: 'responsavel', label: 'Tarefas' },
  { col: 'projetos', key: 'responsavel', label: 'Projetos' },
]

export function PessoaPerfil() {
  const { id } = useParams()
  const db = useDB()
  const p = get('pessoas', id)
  const [aba, setAba] = useLocalState('perfil:aba', 'ocorrencias')
  if (!p) return <div className="card empty">Colaborador não encontrado.</div>
  const cargo = get('cargos', p.cargo as string)
  const cr = cargo?.faixaMid && p.salario ? (Number(p.salario) / Number(cargo.faixaMid)) * 100 : null
  const ano = new Date().getFullYear()
  const { topo: metas, fator: ating } = scorecard(db, p.id, ano)
  const ocorr = (db.ocorrencias ?? []).filter((o) => o.colaborador === p.id)
  const count = (col: string, key: string) => (db[col] ?? []).filter((x) => x[key] === p.id).length
  const atual = ABAS.find((a) => a.col === aba) ?? ABAS[0]
  return (
    <>
      <div className="row">
        <Link to="/pessoas" className="small">
          ← Time
        </Link>
      </div>
      <div className="card row" style={{ gap: 16 }}>
        <Avatar nome={p.nome} size={60} />
        <div className="grow">
          <h1>{String(p.nome)}</h1>
          <div className="muted">
            {label('cargos', cargo)} · {String(p.area ?? '')} · {label('centrosCusto', get('centrosCusto', p.centroCusto as string))} · desde {fmtDate(p.admissao)}
          </div>
        </div>
        <button className="btn" onClick={() => openEditor('pessoas', p.id)}>
          <Icon name="edit" size={15} /> Editar cadastro
        </button>
        <Link className="btn primary" to="/one-on-one">
          <Icon name="chat" size={15} /> 1:1
        </Link>
      </div>
      <div className="grid g4">
        <Kpi l="Compa-ratio" v={cr ? pct(Math.round(cr)) : '—'} t={cr && (cr < 90 || cr > 110) ? 'warn' : undefined} d={cargo ? `faixa ${money(cargo.faixaMin)} – ${money(cargo.faixaMax)}` : 'sem cargo'} />
        <Kpi l={`Bônus projetado ${ano}`} v={pct(Math.round(ating))} d={`${metas.length} meta(s) · pesos ${metas.reduce((a, m) => a + Number(m.peso || 0), 0)}%`} />
        <Kpi l="Ocorrências" v={ocorr.length} d={`${ocorr.filter((o) => o.tipo === 'Positiva').length} positivas · ${ocorr.filter((o) => o.tipo === 'Negativa').length} negativas`} />
        <Kpi l="Tarefas abertas" v={(db.tarefas ?? []).filter((t) => t.responsavel === p.id && !isDone('tarefas', t)).length} d={`${(db.pdis ?? []).filter((x) => x.colaborador === p.id && !isDone('pdis', x)).length} ações de PDI abertas`} />
      </div>
      <div className="tabs">
        {ABAS.map((a) => (
          <button key={a.col} className={a.col === atual.col ? 'on' : ''} onClick={() => setAba(a.col)}>
            {a.label} <span className="muted small">{count(a.col, a.key)}</span>
          </button>
        ))}
      </div>
      <ModulePage key={atual.col} col={atual.col} embedded where={(i) => i[atual.key] === p.id} preset={{ [atual.key]: p.id }} />
    </>
  )
}

export function Vagas() {
  return (
    <>
      <ModulePage col="vagas" defaultView="kanban" />
      <h2>Candidatos</h2>
      <ModulePage col="candidatos" embedded defaultView="kanban" />
    </>
  )
}

export function Ferias() {
  return (
    <ModulePage
      col="ferias"
      defaultView="gantt"
      above={(rows) => {
        const semProg = rows.filter((f) => !f.inicio && !isDone('ferias', f))
        const limite = rows.filter((f) => (daysUntil(f.limite) ?? 999) <= 90 && !f.inicio)
        const prox = rows.filter((f) => (daysUntil(f.inicio) ?? -1) >= 0 && (daysUntil(f.inicio) ?? 999) <= 60)
        return (
          <div className="grid g3">
            <Kpi l="Sem programação" v={semProg.length} t={semProg.length ? 'warn' : undefined} d="períodos ainda sem data de gozo" />
            <Kpi l="Limite concessivo ≤ 90 dias" v={limite.length} t={limite.length ? 'bad' : undefined} d="risco de pagamento em dobro" />
            <Kpi l="Saídas nos próximos 60 dias" v={prox.length} d={prox.map((f) => label('pessoas', get('pessoas', f.colaborador as string)).split(' ')[0]).join(', ') || '—'} />
          </div>
        )
      }}
    />
  )
}

export function Cargos() {
  const db = useDB()
  return (
    <ModulePage
      col="cargos"
      extraViews={[
        {
          key: 'compa',
          label: 'Compa-ratio do time',
          render: () => {
            const rows = (db.pessoas ?? []).filter((p) => p.status !== 'Desligado')
            return (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Cargo</th>
                      <th className="num">Mínimo</th>
                      <th className="num">Ponto médio</th>
                      <th className="num">Máximo</th>
                      <th className="num">Salário</th>
                      <th className="num">Compa-ratio</th>
                      <th>Posição na faixa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p: Item) => {
                      const c = get('cargos', p.cargo as string)
                      const s = Number(p.salario || 0)
                      const cr = c?.faixaMid && s ? (s / Number(c.faixaMid)) * 100 : null
                      const pos = c && s ? ((s - Number(c.faixaMin)) / (Number(c.faixaMax) - Number(c.faixaMin))) * 100 : 0
                      return (
                        <tr key={p.id} className="click" onClick={() => openEditor('pessoas', p.id)}>
                          <td>{String(p.nome)}</td>
                          <td>{label('cargos', c)}</td>
                          <td className="num">{money(c?.faixaMin)}</td>
                          <td className="num">{money(c?.faixaMid)}</td>
                          <td className="num">{money(c?.faixaMax)}</td>
                          <td className="num">{money(p.salario)}</td>
                          <td className="num">{cr ? <Chip t={cr < 90 ? 'warn' : cr > 110 ? 'bad' : 'ok'}>{pct(Math.round(cr))}</Chip> : '—'}</td>
                          <td style={{ minWidth: 120 }}>{c && s ? <Bar value={pos} t={pos < 0 || pos > 100 ? 'bad' : undefined} /> : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="small muted" style={{ padding: '0 12px' }}>
                  Compa-ratio = salário ÷ ponto médio da faixa. Abaixo de 90%: risco de retenção · acima de 110%: pouco espaço para mérito.
                </p>
              </div>
            )
          },
        },
      ]}
    />
  )
}
