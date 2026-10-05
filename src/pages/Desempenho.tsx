import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { get, useDB, type Item } from '../data/store'
import { label } from '../lib/format'

const NOMES: Record<string, string> = {
  '2-0': 'Enigma', '2-1': 'Forte potencial', '2-2': 'Talento / estrela',
  '1-0': 'Questionável', '1-1': 'Mantenedor', '1-2': 'Forte desempenho',
  '0-0': 'Insuficiente', '0-1': 'Eficaz', '0-2': 'Comprometido',
}
const COR: Record<string, string> = {
  '2-2': 'var(--ok-soft)', '2-1': 'var(--ok-soft)', '1-2': 'var(--ok-soft)',
  '0-0': 'var(--bad-soft)', '1-0': 'var(--warn-soft)', '0-1': 'var(--warn-soft)',
}

function NineBox({ rows }: { rows: Item[] }) {
  // usa a avaliação mais recente de cada pessoa
  const ult = new Map<string, Item>()
  for (const a of [...rows].sort((x, y) => String(x.ciclo).localeCompare(String(y.ciclo)))) ult.set(String(a.colaborador), a)
  const pos = (a: Item) => {
    const d = Number(a.desempenho || 0)
    const x = d >= 4 ? 2 : d === 3 ? 1 : 0
    const y = a.potencial === 'Alto' ? 2 : a.potencial === 'Médio' ? 1 : 0
    return `${y}-${x}`
  }
  const cells = [2, 1, 0].flatMap((y) => [0, 1, 2].map((x) => `${y}-${x}`))
  return (
    <div className="stack">
      <div className="ninebox">
        {[2, 1, 0].map((y) => (
          <div key={'l' + y} style={{ display: 'contents' }}>
            <div className="axis v">{['Baixo', 'Médio', 'Alto'][y]}</div>
            {cells
              .filter((c) => c.startsWith(`${y}-`))
              .map((c) => (
                <div key={c} className="cell" style={{ background: COR[c] ?? 'var(--surface-2)' }}>
                  <b className="small">{NOMES[c]}</b>
                  {[...ult.values()]
                    .filter((a) => a.desempenho && a.potencial && pos(a) === c)
                    .map((a) => (
                      <a key={a.id} style={{ cursor: 'pointer' }} onClick={() => openEditor('avaliacoes', a.id)}>
                        {label('pessoas', get('pessoas', a.colaborador as string))}
                        {a.movimentacao ? <span className="muted"> · {String(a.movimentacao)}</span> : null}
                      </a>
                    ))}
                </div>
              ))}
          </div>
        ))}
        <div />
        {['Baixo', 'Médio', 'Alto'].map((l) => (
          <div key={l} className="axis">
            {l}
          </div>
        ))}
      </div>
      <p className="small muted">Eixo vertical: potencial · horizontal: desempenho (1–2 baixo, 3 médio, 4–5 alto). Considera a avaliação mais recente de cada pessoa.</p>
    </div>
  )
}

export function Avaliacoes() {
  return <ModulePage col="avaliacoes" defaultView="9box" extraViews={[{ key: '9box', label: 'Matriz 9-Box', render: (rows) => <NineBox rows={rows} /> }]} />
}

function GapMap({ rows }: { rows: Item[] }) {
  const db = useDB()
  const pessoas = (db.pessoas ?? []).filter((p) => rows.some((r) => r.colaborador === p.id))
  const comps = (db.competencias ?? []).filter((c) => rows.some((r) => r.competencia === c.id))
  if (!pessoas.length) return <div className="empty">Registre avaliações de competência para ver o mapa.</div>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Colaborador</th>
            {comps.map((c) => (
              <th key={c.id} style={{ whiteSpace: 'normal', minWidth: 110 }}>
                {String(c.nome)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pessoas.map((p) => (
            <tr key={p.id}>
              <td>{String(p.nome)}</td>
              {comps.map((c) => {
                const r = rows.find((x) => x.colaborador === p.id && x.competencia === c.id)
                if (!r) return <td key={c.id} className="muted">—</td>
                const gap = Number(r.esperado || 0) - Number(r.atual || 0)
                const bg = gap >= 2 ? 'var(--bad-soft)' : gap === 1 ? 'var(--warn-soft)' : 'var(--ok-soft)'
                return (
                  <td key={c.id} style={{ background: bg, cursor: 'pointer' }} onClick={() => openEditor('mapaCompetencias', r.id)} title="Atual / esperado">
                    <b>{String(r.atual ?? '—')}</b>
                    <span className="muted"> / {String(r.esperado ?? '—')}</span>
                    {gap > 0 && (
                      <button
                        className="btn ghost sm"
                        style={{ marginLeft: 4 }}
                        title="Criar ação de PDI para este gap"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditor('pdis', undefined, { colaborador: p.id, competencia: c.id, porque: `Gap de ${gap} nível(is) em ${String(c.nome)}` })
                        }}
                      >
                        + PDI
                      </button>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted" style={{ padding: '0 12px' }}>
        Verde: no nível · âmbar: gap de 1 · vermelho: gap ≥ 2. Use “+ PDI” para transformar o gap em ação 5W2H.
      </p>
    </div>
  )
}

export function Competencias() {
  return (
    <>
      <ModulePage col="competencias" />
      <h2>Mapa de competências do time</h2>
      <ModulePage col="mapaCompetencias" embedded defaultView="gaps" extraViews={[{ key: 'gaps', label: 'Mapa de gaps', render: (rows) => <GapMap rows={rows} /> }]} />
    </>
  )
}
