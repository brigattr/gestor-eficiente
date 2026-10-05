import { useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Bar, Chip, Kpi, PageHead } from '../components/ui'
import { getDB, replaceAll, useList, type Item } from '../data/store'
import { daysUntil, downloadFile, fmtDate, money, parseCSV, pct, toCSV, toISODate, toNumber } from '../lib/format'

// Modelo de importação do sistema de tickets. Cabeçalhos aceitam variações (aliases).
const COLS: { key: string; head: string; alias: string[]; tipo: 'txt' | 'data' | 'num'; ex: string }[] = [
  { key: 'ticket', head: 'ticket_id', alias: ['id', 'ticket', 'chamado', 'numero', 'n'], tipo: 'txt', ex: 'TCK-1001' },
  { key: 'titulo', head: 'titulo', alias: ['assunto', 'resumo', 'summary', 'descricao', 'title'], tipo: 'txt', ex: 'Ajuste de rateio' },
  { key: 'projeto', head: 'projeto', alias: ['project', 'categoria', 'fila', 'area'], tipo: 'txt', ex: 'Fechamento' },
  { key: 'responsavel', head: 'responsavel', alias: ['atribuido', 'assignee', 'owner', 'analista'], tipo: 'txt', ex: 'Camila Duarte' },
  { key: 'status', head: 'status', alias: ['situacao', 'estado', 'state'], tipo: 'txt', ex: 'Concluído' },
  { key: 'abertura', head: 'abertura', alias: ['criado', 'created', 'data_abertura', 'inicio'], tipo: 'data', ex: '01/09/2026' },
  { key: 'prazo', head: 'prazo', alias: ['due', 'vencimento', 'sla', 'data_limite'], tipo: 'data', ex: '05/09/2026' },
  { key: 'conclusao', head: 'conclusao', alias: ['fechado', 'resolved', 'closed', 'data_conclusao', 'fim'], tipo: 'data', ex: '04/09/2026' },
  { key: 'hPlan', head: 'horas_planejadas', alias: ['horas_estimadas', 'estimativa', 'estimated_hours', 'h_plan'], tipo: 'num', ex: '6' },
  { key: 'hReal', head: 'horas_realizadas', alias: ['horas_apontadas', 'horas', 'spent', 'logged', 'h_real'], tipo: 'num', ex: '7,5' },
  { key: 'cPlan', head: 'custo_planejado', alias: ['orcado', 'custo_estimado'], tipo: 'num', ex: '900' },
  { key: 'cReal', head: 'custo_realizado', alias: ['custo', 'custo_real'], tipo: 'num', ex: '1125' },
]
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[\s.-]+/g, '_')
const DONE = /conclu|fechad|resolvid|encerrad|closed|done|resolved|finaliz/i

function isClosed(t: Item) {
  return !!t.conclusao || DONE.test(String(t.status ?? ''))
}
function late(t: Item) {
  if (!t.prazo) return false
  if (t.conclusao) return String(t.conclusao) > String(t.prazo)
  return !isClosed(t) && (daysUntil(t.prazo) ?? 1) < 0
}

export function Eficiencia() {
  const tickets = useList('tickets')
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [proj, setProj] = useState('')
  const [resp, setResp] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  function template() {
    downloadFile('modelo_tickets.csv', toCSV([COLS.map((c) => c.head), COLS.map((c) => c.ex)]), 'text/csv')
  }

  async function importar(f: File, modo: 'somar' | 'substituir') {
    const rows = parseCSV(await f.text())
    if (rows.length < 2) return setMsg('Arquivo vazio ou sem linhas de dados.')
    const head = rows[0].map(norm)
    const idx: Record<string, number> = {}
    for (const c of COLS) {
      const i = head.findIndex((h) => h === c.head || c.alias.includes(h))
      if (i >= 0) idx[c.key] = i
    }
    const faltando = COLS.filter((c) => idx[c.key] == null).map((c) => c.head)
    if (idx.ticket == null && idx.titulo == null) return setMsg('Não encontrei as colunas ticket_id ou titulo. Use o modelo.')
    const novos: Item[] = rows.slice(1).map((r, n) => {
      const o: Item = { id: '' }
      for (const c of COLS) {
        const raw = idx[c.key] != null ? r[idx[c.key]] : undefined
        o[c.key] = c.tipo === 'num' ? toNumber(raw) : c.tipo === 'data' ? toISODate(raw) : raw?.trim() || null
      }
      o.id = 'tk_' + String(o.ticket ?? n)
      return o
    })
    const atual = modo === 'substituir' ? [] : getDB().tickets ?? []
    const map = new Map(atual.map((t) => [t.id, t]))
    novos.forEach((t) => map.set(t.id, t))
    replaceAll({ ...getDB(), tickets: [...map.values()] })
    setMsg(`${novos.length} ticket(s) importado(s). ${faltando.length ? 'Colunas não encontradas (ficaram vazias): ' + faltando.join(', ') : 'Todas as colunas reconhecidas.'}`)
  }

  const projetos = [...new Set(tickets.map((t) => String(t.projeto ?? '—')))].sort()
  const pessoas = [...new Set(tickets.map((t) => String(t.responsavel ?? '—')))].sort()
  const rows = useMemo(
    () =>
      tickets.filter(
        (t) => (!proj || String(t.projeto ?? '—') === proj) && (!resp || String(t.responsavel ?? '—') === resp) && (!de || String(t.abertura ?? '') >= de) && (!ate || String(t.abertura ?? '') <= ate),
      ),
    [tickets, proj, resp, de, ate],
  )
  const s = (k: string, rs = rows) => rs.reduce((a, t) => a + Number(t[k] || 0), 0)
  const fechados = rows.filter(isClosed)
  const atrasados = rows.filter(late)
  const noPrazo = fechados.filter((t) => t.prazo && !late(t)).length
  const grupo = (k: string) => {
    const g: Record<string, Item[]> = {}
    rows.forEach((t) => (g[String(t[k] ?? '—')] ??= []).push(t))
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length)
  }

  return (
    <>
      <PageHead title="Painel de eficiência" desc="Importe o arquivo exportado do sistema de tickets e acompanhe atividades abertas, atrasadas e concluídas, e horas e custos planejados × realizados por projeto e participante.">
        <button className="btn" onClick={template}>
          <Icon name="download" size={15} /> Modelo CSV
        </button>
        <button className="btn primary" onClick={() => file.current?.click()}>
          <Icon name="upload" size={15} /> Importar arquivo
        </button>
        <input
          ref={file}
          type="file"
          accept=".csv,.txt"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importar(f, tickets.length && confirm('Substituir os tickets atuais?\nOK = substituir · Cancelar = somar/atualizar pelo ticket_id') ? 'substituir' : 'somar')
            e.target.value = ''
          }}
        />
      </PageHead>
      {msg && (
        <div className="card row" style={{ background: 'var(--info-soft)' }}>
          <span className="grow">{msg}</span>
          <button className="btn ghost sm" onClick={() => setMsg(null)}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      {tickets.length === 0 ? (
        <div className="card">
          <h2>Como usar</h2>
          <ol className="small" style={{ lineHeight: 1.9 }}>
            <li>Baixe o <a onClick={template} style={{ cursor: 'pointer' }}>modelo CSV</a> e ajuste o relatório do seu sistema de tickets para exportar essas colunas (aceito vírgula ou ponto-e-vírgula, datas DD/MM/AAAA ou AAAA-MM-DD).</li>
            <li>Clique em “Importar arquivo”. Reimportações atualizam pelo <code>ticket_id</code>.</li>
            <li>Colunas reconhecidas: {COLS.map((c) => c.head).join(', ')}.</li>
          </ol>
          <p className="small muted">Se preferir, me envie um exemplo do arquivo real do seu sistema e eu ajusto o mapeamento de colunas.</p>
        </div>
      ) : (
        <>
          <div className="card row">
            <select value={proj} onChange={(e) => setProj(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="">Projeto: todos</option>
              {projetos.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select value={resp} onChange={(e) => setResp(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="">Participante: todos</option>
              {pessoas.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <span className="small muted">Abertura de</span>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ maxWidth: 160 }} />
            <span className="small muted">até</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ maxWidth: 160 }} />
            <span className="grow" />
            <button
              className="btn sm danger"
              onClick={() => {
                if (confirm('Apagar todos os tickets importados?')) replaceAll({ ...getDB(), tickets: [] })
              }}
            >
              Limpar importação
            </button>
          </div>
          <div className="grid g4">
            <Kpi l="Atividades" v={rows.length} d={`${rows.length - fechados.length} abertas · ${fechados.length} concluídas`} />
            <Kpi l="Atrasadas" v={atrasados.length} t={atrasados.length ? 'bad' : undefined} d={`${pct(fechados.length ? (noPrazo / fechados.length) * 100 : 0)} concluídas no prazo`} />
            <Kpi l="Horas real / plan." v={`${Math.round(s('hReal'))} / ${Math.round(s('hPlan'))}`} t={s('hReal') > s('hPlan') ? 'bad' : undefined} d={`eficiência ${pct(s('hReal') ? (s('hPlan') / s('hReal')) * 100 : 0)}`} />
            <Kpi l="Custo real / plan." v={money(s('cReal'))} t={s('cReal') > s('cPlan') ? 'bad' : undefined} d={`de ${money(s('cPlan'))}`} />
          </div>
          <div className="grid g2">
            {(['projeto', 'responsavel'] as const).map((k) => (
              <div key={k} className="card flush">
                <h2 style={{ padding: '14px 16px 8px' }}>Por {k === 'projeto' ? 'projeto' : 'participante'}</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{k === 'projeto' ? 'Projeto' : 'Participante'}</th>
                        <th className="num">Abertas</th>
                        <th className="num">Atras.</th>
                        <th className="num">Concl.</th>
                        <th className="num">h plan.</th>
                        <th className="num">h real</th>
                        <th>Consumo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo(k).map(([g, ts]) => {
                        const hp = s('hPlan', ts)
                        const hr = s('hReal', ts)
                        return (
                          <tr key={g}>
                            <td>{g}</td>
                            <td className="num">{ts.filter((t) => !isClosed(t)).length}</td>
                            <td className={`num ${ts.some(late) ? 'neg' : ''}`}>{ts.filter(late).length}</td>
                            <td className="num">{ts.filter(isClosed).length}</td>
                            <td className="num">{Math.round(hp)}</td>
                            <td className="num">{Math.round(hr)}</td>
                            <td style={{ minWidth: 90 }}>
                              <Bar value={hr} max={hp || hr || 1} t={hr > hp ? 'bad' : 'ok'} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
          <div className="card flush">
            <h2 style={{ padding: '14px 16px 8px' }}>Atividades atrasadas e abertas</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Título</th>
                    <th>Projeto</th>
                    <th>Responsável</th>
                    <th>Status</th>
                    <th>Prazo</th>
                    <th className="num">h plan./real</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((t) => !isClosed(t) || late(t))
                    .sort((a, b) => String(a.prazo ?? '9').localeCompare(String(b.prazo ?? '9')))
                    .map((t) => (
                      <tr key={t.id}>
                        <td>{String(t.ticket ?? '')}</td>
                        <td>{String(t.titulo ?? '')}</td>
                        <td>{String(t.projeto ?? '')}</td>
                        <td>{String(t.responsavel ?? '')}</td>
                        <td>{late(t) ? <Chip t="bad">Atrasado</Chip> : <Chip v={t.status ?? 'Aberto'} />}</td>
                        <td className={late(t) ? 'neg' : ''}>{fmtDate(t.prazo)}</td>
                        <td className="num">
                          {Number(t.hPlan || 0)} / {Number(t.hReal || 0)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}
