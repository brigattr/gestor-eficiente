import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { TagChip, corEtiqueta } from '../components/Tags'
import { Chip, Kpi, PageHead, useLocalState } from '../components/ui'
import { MOD, MODULES } from '../data/schema'
import { get, useDB, type DB, type Item } from '../data/store'
import { isDone } from '../lib/alerts'
import { daysUntil, fmtDate, label } from '../lib/format'

export type ItemEtiquetado = { col: string; it: Item; done: boolean; data: string | null; tipoData: string | null; atrasado: boolean }

/** Tudo que tem a etiqueta, em todos os módulos. */
export function itensDaEtiqueta(db: DB, tagId: string): ItemEtiquetado[] {
  const out: ItemEtiquetado[] = []
  for (const m of MODULES) {
    if (m.col === 'etiquetas') continue
    for (const it of db[m.col] ?? []) {
      if (!Array.isArray(it.etiquetas) || !it.etiquetas.includes(tagId)) continue
      const done = isDone(m.col, it)
      // primeira data relevante do módulo (prazo, data da reunião, validade…)
      const d = m.dates?.find((x) => typeof it[x.field] === 'string' && it[x.field])
      const data = d ? String(it[d.field]).slice(0, 10) : null
      out.push({ col: m.col, it, done, data, tipoData: d?.label ?? null, atrasado: !done && !!data && (daysUntil(data) ?? 1) < 0 && m.col !== 'reunioes' })
    }
  }
  return out
}

export function Etiquetas() {
  const db = useDB()
  return (
    <ModulePage
      col="etiquetas"
      defaultView="cards"
      extraViews={[
        {
          key: 'cards',
          label: 'Painel',
          render: (rows) =>
            rows.length === 0 ? (
              <div className="empty">Crie sua primeira etiqueta em “Novo”. Depois marque tarefas, reuniões, projetos e o que quiser com ela.</div>
            ) : (
              <div className="grid g3">
                {rows.map((t) => {
                  const its = itensDaEtiqueta(db, t.id)
                  const abertos = its.filter((x) => !x.done)
                  return (
                    <div key={t.id} className="card stack" style={{ gap: 8, borderTop: `4px solid ${corEtiqueta(t.id)}`, opacity: t.arquivada ? 0.6 : 1 }}>
                      <div className="row">
                        <TagChip id={t.id} />
                        <span className="grow" />
                        <button className="btn ghost sm" onClick={() => openEditor('etiquetas', t.id)} title="Editar etiqueta">
                          <Icon name="edit" size={14} />
                        </button>
                      </div>
                      {t.descricao != null && t.descricao !== '' && <span className="small muted">{String(t.descricao)}</span>}
                      <div className="row small">
                        <b>{abertos.length}</b> aberto(s) · {its.length} no total
                        {its.some((x) => x.atrasado) && <Chip t="bad">{its.filter((x) => x.atrasado).length} atrasado(s)</Chip>}
                      </div>
                      <Link className="btn sm" to={`/etiquetas/${t.id}`} style={{ justifySelf: 'start' }}>
                        Ver tudo →
                      </Link>
                    </div>
                  )
                })}
              </div>
            ),
        },
      ]}
    />
  )
}

export function EtiquetaDetalhe() {
  const { id } = useParams()
  const db = useDB()
  const t = get('etiquetas', id)
  const [verConcluidos, setVerConcluidos] = useLocalState('tag:done', false)
  const its = useMemo(() => (id ? itensDaEtiqueta(db, id) : []), [db, id])
  if (!t || !id) return <div className="card empty">Etiqueta não encontrada.</div>
  const abertos = its.filter((x) => !x.done)
  const atrasados = abertos.filter((x) => x.atrasado)
  const comData = abertos.filter((x) => x.data).sort((a, b) => String(a.data).localeCompare(String(b.data)))
  const porModulo = new Map<string, ItemEtiquetado[]>()
  for (const x of its) if (verConcluidos || !x.done) porModulo.set(x.col, [...(porModulo.get(x.col) ?? []), x])

  return (
    <>
      <div className="row">
        <Link to="/etiquetas" className="small">
          ← Etiquetas
        </Link>
      </div>
      <PageHead title={String(t.nome)} desc={t.descricao ? String(t.descricao) : 'Tudo que recebeu esta etiqueta, de todos os módulos.'}>
        <button className="btn" onClick={() => openEditor('etiquetas', t.id)}>
          <Icon name="edit" size={15} /> Editar etiqueta
        </button>
      </PageHead>
      <div className="grid g4">
        <Kpi l="Itens abertos" v={abertos.length} d={`${its.length} no total`} />
        <Kpi l="Atrasados" v={atrasados.length} t={atrasados.length ? 'bad' : undefined} d="prazo vencido e não concluído" />
        <Kpi l="Próximos 7 dias" v={comData.filter((x) => (daysUntil(x.data) ?? -1) >= 0 && (daysUntil(x.data) ?? 99) <= 7).length} d="com data nesta semana" />
        <Kpi l="Módulos" v={new Set(its.map((x) => x.col)).size} d={[...new Set(its.map((x) => MOD[x.col].title))].slice(0, 3).join(', ') || '—'} />
      </div>

      {comData.length > 0 && (
        <div className="card">
          <div className="card-head">
            <Icon name="calendar" />
            <h2 className="grow">Lembretes por data</h2>
          </div>
          <div className="list">
            {comData.slice(0, 12).map((x) => (
              <div key={x.col + x.it.id} style={{ cursor: 'pointer' }} onClick={() => openEditor(x.col, x.it.id)}>
                <span className="small" style={{ width: 84, color: x.atrasado ? 'var(--bad)' : undefined, fontWeight: x.atrasado ? 700 : 400 }}>
                  {fmtDate(x.data)}
                </span>
                <span className="grow">{label(x.col, x.it)}</span>
                <Chip t="muted">{MOD[x.col].singular}</Chip>
                {x.tipoData && <span className="small muted hide-sm">{x.tipoData}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="row">
        <h2 className="grow">Por origem</h2>
        <label className="row small" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={verConcluidos} onChange={(e) => setVerConcluidos(e.target.checked)} /> mostrar concluídos
        </label>
      </div>
      {porModulo.size === 0 && <div className="card empty">Nada {verConcluidos ? '' : 'em aberto '}com esta etiqueta. Abra qualquer tarefa, reunião ou projeto e marque a etiqueta no campo “Etiquetas”.</div>}
      {[...porModulo.entries()].map(([col, xs]) => {
        const m = MOD[col]
        return (
          <div key={col} className="card flush">
            <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <Icon name={m.icon} />
              <h3 className="grow">{m.title}</h3>
              <span className="small muted">{xs.length}</span>
              <Link className="small" to={'/' + (col === 'krs' ? 'okr' : col === 'umaum' ? 'one-on-one' : col === 'budget' || col === 'despesas' ? 'despesas' : m.path)}>
                abrir módulo →
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <tbody>
                  {xs
                    .sort((a, b) => Number(a.done) - Number(b.done) || String(a.data ?? '9').localeCompare(String(b.data ?? '9')))
                    .map((x) => {
                      const st = m.statusField ? x.it[m.statusField] : null
                      const pessoa = m.personField ? x.it[m.personField] : x.it.responsavel
                      return (
                        <tr key={x.it.id} className="click" onClick={() => openEditor(col, x.it.id)} style={{ opacity: x.done ? 0.55 : 1 }}>
                          <td>{label(col, x.it)}</td>
                          <td style={{ width: 160 }}>{st != null && st !== '' ? <Chip v={st} /> : x.done ? <Chip t="ok">concluído</Chip> : null}</td>
                          <td className="small muted" style={{ width: 170 }}>
                            {pessoa ? label('pessoas', get('pessoas', String(pessoa))) : ''}
                          </td>
                          <td className={`small ${x.atrasado ? 'neg' : ''}`} style={{ width: 150, whiteSpace: 'nowrap' }}>
                            {x.data ? `${x.tipoData ?? 'Data'}: ${fmtDate(x.data)}` : ''}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </>
  )
}
