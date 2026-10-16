import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { Chip, PageHead } from '../components/ui'
import { get, upsert, useDB, type Item } from '../data/store'
import { label } from '../lib/format'

// ───────────────────────── Organograma (a partir do campo "Gestor imediato" do Time)
export function Organograma() {
  const db = useDB()
  const pessoas = (db.pessoas ?? []).filter((p) => !/deslig/i.test(String(p.status ?? '')))
  const ids = new Set(pessoas.map((p) => p.id))
  const filhos = (id: string) => pessoas.filter((p) => p.gestor === id).sort((a, b) => String(a.nome).localeCompare(String(b.nome)))
  const raizes = pessoas.filter((p) => !p.gestor || !ids.has(String(p.gestor)))
  const vagas = (db.vagas ?? []).filter((v) => !/fechad|cancelad|contratad/i.test(String(v.status ?? '')))
  const semGestor = raizes.length > 1 ? raizes : []

  function No({ p, nivel }: { p: Item; nivel: number }) {
    const fs = nivel < 8 ? filhos(p.id) : []
    return (
      <li>
        <div className="org-card" onClick={() => openEditor('pessoas', p.id)}>
          <span className="avatar">{String(p.nome).split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</span>
          <span className="stack" style={{ gap: 0, minWidth: 0 }}>
            <b className="org-nome">{String(p.nome)}</b>
            <span className="small muted org-nome">{p.cargo ? label('cargos', get('cargos', String(p.cargo))) : String(p.area ?? '')}</span>
          </span>
          {fs.length > 0 && <span className="org-n">{fs.length}</span>}
        </div>
        {fs.length > 0 && (
          <ul>
            {fs.map((f) => (
              <No key={f.id} p={f} nivel={nivel + 1} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <>
      <PageHead title="Organograma" desc="Montado a partir do campo “Gestor imediato” no cadastro do Time. Clique numa pessoa para editar.">
        <Link className="btn" to="/pessoas">
          <Icon name="users" size={15} /> Time
        </Link>
      </PageHead>
      {pessoas.length === 0 ? (
        <div className="card empty">Cadastre o time e informe o gestor imediato de cada pessoa.</div>
      ) : (
        <div className="card org-wrap">
          <ul className="org">
            {raizes.map((r) => (
              <No key={r.id} p={r} nivel={0} />
            ))}
          </ul>
        </div>
      )}
      {semGestor.length > 0 && <div className="small muted">Dica: há {semGestor.length} pessoas sem gestor informado — elas aparecem como topo do organograma.</div>}
      {vagas.length > 0 && (
        <div className="card row small">
          <Icon name="briefcase" />
          <span className="grow">
            <b>{vagas.length}</b> vaga(s) em aberto: {vagas.map((v) => String(v.titulo)).join(', ')}
          </span>
          <Link to="/vagas">ver vagas →</Link>
        </div>
      )}
    </>
  )
}

// ───────────────────────── Matriz de cobertura e polivalência
const NIVEIS = ['—', 'Aprendendo', 'Faz com apoio', 'Faz sozinho', 'Ensina']

export function Cobertura() {
  const db = useDB()
  const pessoas = (db.pessoas ?? []).filter((p) => !/deslig/i.test(String(p.status ?? ''))).sort((a, b) => String(a.nome).localeCompare(String(b.nome)))
  function nivel(a: Item, p: string) {
    return Number(((a.niveis as Record<string, number>) ?? {})[p] ?? 0)
  }
  function setNivel(a: Item, p: string, n: number) {
    upsert('atividadesArea', { id: a.id, niveis: { ...((a.niveis as Record<string, number>) ?? {}), [p]: n } })
  }
  return (
    <ModulePage
      col="atividadesArea"
      above={(rows) => {
        if (!rows.length) return null
        const autonomos = (a: Item) => pessoas.filter((p) => nivel(a, p.id) >= 3 || a.titular === p.id).length
        const unicas = rows.filter((a) => autonomos(a) <= 1)
        const criticasSemBackup = rows.filter((a) => a.criticidade === 'Alta' && (!a.backup || a.backup === a.titular))
        const semDoc = rows.filter((a) => !a.documentado)
        return (
          <div className="stack">
            <div className="grid g3">
              <div className="card stack" style={{ gap: 4 }}>
                <span className="small muted">ONDE SÓ UMA PESSOA SABE</span>
                <b style={{ fontSize: 24, color: unicas.length ? 'var(--bad)' : 'var(--ok)' }}>{unicas.length}</b>
                <span className="small muted">{unicas.slice(0, 4).map((a) => String(a.atividade)).join(' · ')}</span>
              </div>
              <div className="card stack" style={{ gap: 4 }}>
                <span className="small muted">CRÍTICAS SEM BACKUP</span>
                <b style={{ fontSize: 24, color: criticasSemBackup.length ? 'var(--bad)' : 'var(--ok)' }}>{criticasSemBackup.length}</b>
                <span className="small muted">{criticasSemBackup.slice(0, 4).map((a) => String(a.atividade)).join(' · ')}</span>
              </div>
              <div className="card stack" style={{ gap: 4 }}>
                <span className="small muted">SEM PROCEDIMENTO DOCUMENTADO</span>
                <b style={{ fontSize: 24, color: semDoc.length ? 'var(--warn)' : 'var(--ok)' }}>{semDoc.length}</b>
                <span className="small muted">de {rows.length} atividades</span>
              </div>
            </div>
            {pessoas.length > 0 && (
              <div className="card flush">
                <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <h2 className="grow">Polivalência (quem sabe fazer o quê)</h2>
                  <span className="small muted">Clique na célula para mudar o nível: {NIVEIS.slice(1).map((n, i) => `${i + 1} ${n}`).join(' · ')}</span>
                </div>
                <div className="table-wrap">
                  <table className="poli">
                    <thead>
                      <tr>
                        <th>Atividade</th>
                        {pessoas.map((p) => (
                          <th key={p.id} title={String(p.nome)}>
                            {String(p.nome).split(' ')[0]}
                          </th>
                        ))}
                        <th>Cobertura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((a) => {
                        const n = autonomos(a)
                        return (
                          <tr key={a.id}>
                            <td className="click" onClick={() => openEditor('atividadesArea', a.id)}>
                              {String(a.atividade)} {a.criticidade === 'Alta' && <Chip t="bad">crítica</Chip>}
                            </td>
                            {pessoas.map((p) => {
                              const v = nivel(a, p.id)
                              const tit = a.titular === p.id,
                                bk = a.backup === p.id
                              return (
                                <td key={p.id} className={`poli-cel n${v}`} title={`${String(p.nome)}: ${NIVEIS[v]}${tit ? ' (titular)' : bk ? ' (backup)' : ''}`} onClick={() => setNivel(a, p.id, (v + 1) % 5)}>
                                  {v || ''}
                                  {tit ? <sup>T</sup> : bk ? <sup>B</sup> : null}
                                </td>
                              )
                            })}
                            <td>
                              <Chip t={n <= 1 ? 'bad' : n === 2 ? 'warn' : 'ok'}>{n} autônomo(s)</Chip>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      }}
    />
  )
}
