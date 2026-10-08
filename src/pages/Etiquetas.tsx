import { useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { TagChip, TagChips, corEtiqueta } from '../components/Tags'
import { Chip, Kpi, PageHead, useLocalState } from '../components/ui'
import { MOD, MODULES } from '../data/schema'
import { get, useDB, type DB, type Item } from '../data/store'
import { isDone } from '../lib/alerts'
import { daysUntil, fmtDate, label } from '../lib/format'

export type ItemEtiquetado = { col: string; it: Item; done: boolean; data: string | null; tipoData: string | null; atrasado: boolean }

/** Tudo que tem alguma das etiquetas (ou qualquer etiqueta, se a lista vier vazia), em todos os módulos. */
export function itensEtiquetados(db: DB, tagIds: string[] = []): ItemEtiquetado[] {
  const out: ItemEtiquetado[] = []
  for (const m of MODULES) {
    if (m.col === 'etiquetas') continue
    for (const it of db[m.col] ?? []) {
      if (!Array.isArray(it.etiquetas) || !it.etiquetas.length) continue
      if (tagIds.length && !tagIds.some((t) => (it.etiquetas as string[]).includes(t))) continue
      const done = isDone(m.col, it)
      // primeira data relevante do módulo (prazo, data da reunião, validade…)
      const d = m.dates?.find((x) => typeof it[x.field] === 'string' && it[x.field])
      const data = d ? String(it[d.field]).slice(0, 10) : null
      out.push({ col: m.col, it, done, data, tipoData: d?.label ?? null, atrasado: !done && !!data && (daysUntil(data) ?? 1) < 0 && m.col !== 'reunioes' })
    }
  }
  return out
}

export const itensDaEtiqueta = (db: DB, tagId: string) => itensEtiquetados(db, [tagId])

/** Cadastro das etiquetas (nome, cor, descrição, arquivar). */
export function ConfigurarEtiquetas() {
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
                      <Link className="btn sm" to={`/etiquetas?t=${t.id}`} style={{ justifySelf: 'start' }}>
                        Ver itens →
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

/** Painel único: tudo que tem etiqueta, com filtro por etiqueta no topo. */
export function Etiquetas() {
  const db = useDB()
  const [params, setParams] = useSearchParams()
  const [lembrado, setLembrado] = useLocalState<string[]>('tag:filtro', [])
  const [verConcluidos, setVerConcluidos] = useLocalState('tag:done', false)
  const tags = (db.etiquetas ?? []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome)))
  const existe = new Set(tags.map((t) => t.id))
  const daUrl = params.get('t')
  const filtro = (daUrl != null ? daUrl.split(',') : lembrado).filter((id) => existe.has(id))
  function filtrar(ids: string[]) {
    setLembrado(ids)
    setParams(ids.length ? { t: ids.join(',') } : {}, { replace: true })
  }
  const alternar = (id: string) => filtrar(filtro.includes(id) ? filtro.filter((x) => x !== id) : [...filtro, id])
  const its = useMemo(() => itensEtiquetados(db, filtro), [db, filtro.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  const abertosPorTag = useMemo(() => {
    const n = new Map<string, number>()
    for (const x of itensEtiquetados(db)) if (!x.done) for (const id of x.it.etiquetas as string[]) n.set(id, (n.get(id) ?? 0) + 1)
    return n
  }, [db])
  const visiveis = tags.filter((t) => !t.arquivada || filtro.includes(t.id))
  const abertos = its.filter((x) => !x.done)
  const atrasados = abertos.filter((x) => x.atrasado)
  const comData = abertos.filter((x) => x.data).sort((a, b) => String(a.data).localeCompare(String(b.data)))
  const porModulo = new Map<string, ItemEtiquetado[]>()
  for (const x of its) if (verConcluidos || !x.done) porModulo.set(x.col, [...(porModulo.get(x.col) ?? []), x])
  const um = filtro.length === 1 ? get('etiquetas', filtro[0]) : undefined

  return (
    <>
      <PageHead title="Etiquetas" desc={um?.descricao ? String(um.descricao) : 'Tudo que recebeu etiqueta, de todos os módulos. Escolha uma ou mais etiquetas para filtrar.'}>
        {um && (
          <button className="btn" onClick={() => openEditor('etiquetas', um.id)}>
            <Icon name="edit" size={15} /> Editar “{String(um.nome)}”
          </button>
        )}
        <Link className="btn" to="/etiquetas/configurar">
          <Icon name="tag" size={15} /> Configurar etiquetas
        </Link>
      </PageHead>

      {tags.length === 0 ? (
        <div className="card empty">
          Nenhuma etiqueta ainda. Crie em <Link to="/etiquetas/configurar">Configurar etiquetas</Link> ou direto no campo “Etiquetas” de qualquer tarefa, reunião ou projeto.
        </div>
      ) : (
        <div className="card">
          <div className="row" style={{ gap: 6 }}>
            <span className={`tag lg ${filtro.length ? 'off' : ''}`} style={{ ['--tag' as string]: 'var(--accent)', cursor: 'pointer' }} onClick={() => filtrar([])}>
              {filtro.length ? '' : '✓ '}Todas
            </span>
            {visiveis.map((t) => {
              const on = filtro.includes(t.id)
              const n = abertosPorTag.get(t.id) ?? 0
              return (
                <span key={t.id} className={`tag lg ${on ? '' : 'off'}`} style={{ ['--tag' as string]: corEtiqueta(t.id), cursor: 'pointer' }} onClick={() => alternar(t.id)} title={String(t.descricao ?? t.nome)}>
                  {on ? '✓ ' : ''}
                  {String(t.nome)}
                  {n > 0 && <span style={{ opacity: 0.75, marginLeft: 4 }}>{n}</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}

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
                <span className="grow">
                  {label(x.col, x.it)} <TagChips ids={x.it.etiquetas} />
                </span>
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
      {porModulo.size === 0 && <div className="card empty">Nada {verConcluidos ? '' : 'em aberto '}com {filtro.length > 1 ? 'estas etiquetas' : filtro.length ? 'esta etiqueta' : 'etiqueta'}. Abra qualquer tarefa, reunião ou projeto e marque a etiqueta no campo “Etiquetas”.</div>}
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
                          <td>
                            {label(col, x.it)} <TagChips ids={x.it.etiquetas} />
                          </td>
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

/** Endereço antigo /etiquetas/:id → painel já filtrado. */
export function EtiquetaDetalhe() {
  const { id } = useParams()
  return <Navigate to={id ? `/etiquetas?t=${id}` : '/etiquetas'} replace />
}
