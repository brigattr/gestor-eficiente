import { useMemo, useRef, useState } from 'react'
import { avisar, confirmar } from '../components/Dialogs'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { Bar, Chip, Kpi, Modal, PageHead, useLocalState } from '../components/ui'
import { getDB, getPref, replaceAll, setPref, uid, upsert, useList, type Item } from '../data/store'
import { MES_CURTO, downloadFile, parseCSV, pct, toCSV, toNumber } from '../lib/format'
import { CAMPOS, SLA_PADRAO, autoMap, dataConclusao, detectFmt, diasUteis, isCancel, isClosed, norm, slaDe, toDateTime, type FmtData } from '../lib/tickets'
import { canWrite } from '../lib/session'

type Raw = { head: string[]; rows: unknown[][]; nome: string }

async function lerArquivo(f: File): Promise<Raw> {
  if (/\.xlsx$/i.test(f.name)) {
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const sheets = await readXlsxFile(f)
    const data = (sheets[0]?.data ?? []) as unknown[][]
    return { head: (data[0] ?? []).map((x) => String(x ?? '')), rows: data.slice(1), nome: f.name }
  }
  const rows = parseCSV(await f.text())
  return { head: rows[0] ?? [], rows: rows.slice(1), nome: f.name }
}

const agora = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const fmtD = (s: unknown) => (s ? new Date(String(s)).toLocaleDateString('pt-BR') : '—')
const um = (v: number | null) => (v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }))

const DIMS: { k: string; l: string }[] = [
  { k: 'tipo', l: 'Tipo de solicitação' },
  { k: 'analista', l: 'Analista responsável' },
  { k: 'equipe', l: 'Equipe responsável' },
  { k: 'area', l: 'Área solicitante' },
  { k: 'solicitante', l: 'Solicitante' },
  { k: 'empresa', l: 'Empresa' },
  { k: 'prioridade', l: 'Prioridade' },
  { k: 'status', l: 'Status' },
]

export function Eficiencia() {
  const tickets = useList('tickets')
  const file = useRef<HTMLInputElement>(null)
  const [raw, setRaw] = useState<Raw | null>(null)
  const [cfg, setCfg] = useState(false)
  const [sla, setSla] = useState<Record<string, number>>(() => getPref('tk:sla', SLA_PADRAO))
  const [base, setBase] = useState<string>(() => getPref('tk:base', ''))
  const [f, setF] = useLocalState<Record<string, string>>('tk:f', {})
  const [de, setDe] = useLocalState('tk:de', '')
  const [ate, setAte] = useLocalState('tk:ate', '')
  const [dim, setDim] = useLocalState('tk:dim', 'tipo')
  const [q, setQ] = useLocalState('tk:q', '')

  const filtrados = useMemo(
    () =>
      tickets.filter((t) => {
        for (const [k, v] of Object.entries(f)) if (v && String(t[k] ?? '—') !== v) return false
        const s = q.trim().toLowerCase()
        if (s && ![t.id, t.titulo, t.descricao, t.solicitante].some((x) => String(x ?? '').toLowerCase().includes(s))) return false
        return true
      }),
    [tickets, f, q],
  )
  // período: aplica sobre a data de abertura (recebidos) e de conclusão (concluídos)
  const noPeriodo = (d: string | null) => !!d && (!de || d.slice(0, 10) >= de) && (!ate || d.slice(0, 10) <= ate)
  const now = agora()
  const enriched = useMemo(
    () =>
      filtrados.map((t) => {
        const c = dataConclusao(t)
        const lead = c.data && t.criado ? diasUteis(String(t.criado), c.data) : null
        const idade = !isClosed(t) && t.criado ? diasUteis(String(t.criado), now) : null
        const lim = slaDe(t, sla)
        const prazoOk = t.prazo ? (c.data ? c.data <= String(t.prazo) : now <= String(t.prazo)) : null
        const dentro = prazoOk ?? (lim == null ? null : lead != null ? lead <= lim : idade != null ? idade <= lim : null)
        return { t, conclusao: c.data, estimada: c.estimada, lead, idade, dentro }
      }),
    [filtrados, sla, now],
  )
  const recebidos = enriched.filter((e) => noPeriodo((e.t.criado as string) ?? null) || (!de && !ate))
  const concluidos = enriched.filter((e) => e.conclusao && !isCancel(e.t) && (noPeriodo(e.conclusao) || (!de && !ate)))
  const backlog = enriched.filter((e) => !isClosed(e.t))
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  const leadMed = avg(concluidos.map((e) => e.lead))
  const comSla = concluidos.filter((e) => e.dentro != null)
  const pctSla = comSla.length ? (comSla.filter((e) => e.dentro).length / comSla.length) * 100 : null
  const foraSla = backlog.filter((e) => e.dentro === false)
  const estimadas = concluidos.filter((e) => e.estimada).length
  const horas = { p: enriched.reduce((a, e) => a + Number(e.t.hPlan || 0), 0), r: enriched.reduce((a, e) => a + Number(e.t.hReal || 0), 0) }

  const opts = (k: string) => [...new Set(tickets.map((t) => String(t[k] ?? '—')))].sort()

  async function escolher(fl: File | undefined) {
    if (!fl) return
    try {
      const r = await lerArquivo(fl)
      if (!r.head.length || !r.rows.length) return avisar('Arquivo sem linhas de dados.')
      setRaw(r)
    } catch (e) {
      console.error(e)
      avisar('Não foi possível ler o arquivo. Use CSV (Exportar → CSV na lista) ou .xlsx.')
    }
  }

  function criarTarefa(t: Item) {
    const id = uid()
    upsert('tarefas', {
      id,
      titulo: `Ticket ${String(t.id)}: ${String(t.titulo ?? '')}`,
      status: 'A fazer',
      lista: 'Rotina',
      aguardando: t.analista ? String(t.analista) : undefined,
      comentarios: [`Solicitante: ${String(t.solicitante ?? '—')}`, `Tipo: ${String(t.tipo ?? '—')}`, `Status no SharePoint: ${String(t.status ?? '—')}`, linkDe(t, base)].filter(Boolean).join('\n'),
      anexo: linkDe(t, base) || undefined,
    })
    openEditor('tarefas', id)
  }

  return (
    <>
      <PageHead title="Painel de eficiência" desc="Tickets da Controladoria (lista Tickets_Header do SharePoint): entradas × saídas, backlog, tempo de atendimento em dias úteis e SLA por prioridade, por tipo, analista, área e solicitante.">
        <button className="btn" onClick={() => setCfg(true)}>
          <Icon name="settings" size={15} /> SLA e link
        </button>
        {canWrite() && (
          <button className="btn primary" onClick={() => file.current?.click()}>
            <Icon name="upload" size={15} /> Importar lista
          </button>
        )}
        <input ref={file} type="file" accept=".csv,.txt,.xlsx" hidden onChange={(e) => (void escolher(e.target.files?.[0]), (e.target.value = ''))} />
      </PageHead>

      {tickets.length === 0 ? (
        <div className="card stack">
          <h2>Como trazer os tickets do SharePoint</h2>
          <ol className="small" style={{ lineHeight: 1.9, margin: 0 }}>
            <li>
              Abra a lista <b>Tickets_Header</b> no Microsoft Lists/SharePoint, escolha a visão <b>Todos os itens</b> (sem filtro) e clique em <b>Exportar → Exportar para CSV</b>.
            </li>
            <li>
              Aqui, clique em <b>Importar lista</b> e escolha o arquivo (CSV ou .xlsx). O sistema reconhece as colunas ID, Title, Descricao_Detalhada, Empresa, Area_Solicitante, Solicitante, Prioridade, Status, Tipo_Solicitacao, Equipe_Responsavel, Analista_Responsavel, Created,
              Modified, Fechado e Link. Você confere o mapeamento antes de importar.
            </li>
            <li>Reimporte quando quiser: os tickets são atualizados pelo ID.</li>
          </ol>
          <div className="row">
            <button className="btn sm" onClick={() => downloadFile('modelo_tickets_header.csv', toCSV([['ID', 'Title', 'Descricao_Detalhada', 'Empresa', 'Area_Solicitante', 'Solicitante', 'Prioridade', 'Status', 'Tipo_Solicitacao', 'Equipe_Responsavel', 'Analista_Responsavel', 'Created', 'Modified', 'Fechado', 'Link'], ['14', 'New Analise de Credito Request', 'New Analise de Credito Request', 'N/A', 'Comercial', 'Wenzel, Ana', 'Baixa', 'Concluído', '[Financeiro] Análise de crédito', 'Financeiro', '', '30/06/2026 16:53', '18/09/2026 13:54', '', '']]), 'text/csv')}>
              <Icon name="download" size={14} /> Modelo de exemplo
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card row">
            <input id="tk-q" placeholder="Buscar ID, título, solicitante…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 230 }} />
            {(['tipo', 'equipe', 'analista', 'empresa', 'prioridade'] as const).map((k) => (
              <select key={k} id={`tk-${k}`} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} style={{ maxWidth: 190 }}>
                <option value="">{DIMS.find((d) => d.k === k)!.l}: todos</option>
                {opts(k).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ))}
            <span className="small muted">Período de</span>
            <input id="tk-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ maxWidth: 150 }} />
            <span className="small muted">até</span>
            <input id="tk-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ maxWidth: 150 }} />
          </div>

          <div className="grid g4">
            <Kpi l="Recebidos" v={recebidos.length} d={de || ate ? 'abertos no período' : 'total importado'} />
            <Kpi l="Concluídos" v={concluidos.length} d={estimadas ? `${estimadas} com data estimada (Modified)` : 'com data de fechamento'} />
            <Kpi l="Backlog aberto" v={backlog.length} t={foraSla.length ? 'bad' : undefined} d={`${foraSla.length} fora do SLA · idade média ${um(avg(backlog.map((e) => e.idade)))} d.u.`} />
            <Kpi l="Tempo de atendimento" v={`${um(leadMed)} d.u.`} d={pctSla == null ? 'configure o SLA por prioridade' : `${pct(Math.round(pctSla))} dentro do SLA`} t={pctSla != null && pctSla < 80 ? 'warn' : undefined} />
          </div>
          {horas.p + horas.r > 0 && (
            <div className="card row small">
              Horas: <b>{Math.round(horas.r)}</b> realizadas de <b>{Math.round(horas.p)}</b> planejadas
              <span style={{ width: 200 }}>
                <Bar value={horas.r} max={horas.p || horas.r} t={horas.r > horas.p ? 'bad' : 'ok'} />
              </span>
            </div>
          )}
          {estimadas > 0 && (
            <div className="card small" style={{ background: 'var(--warn-soft)', boxShadow: 'none' }}>
              {estimadas} ticket(s) concluído(s) estão sem a data em <b>Fechado</b>; usei <b>Modified</b> como data de conclusão. Se houve alteração em massa na lista, o tempo de atendimento fica distorcido. Preencher “Fechado” no fluxo do SharePoint (Power Automate ao mudar o status) resolve.
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <h2 className="grow">Entradas × saídas por mês</h2>
              <span className="small muted">barras: recebidos / concluídos · linha: backlog ao fim do mês</span>
            </div>
            <Fluxo items={enriched} />
          </div>

          <div className="card flush">
            <div className="row" style={{ padding: '12px 16px' }}>
              <h2 className="grow">Quebra por dimensão</h2>
              <select id="tk-dim" value={dim} onChange={(e) => setDim(e.target.value)} style={{ maxWidth: 230 }}>
                {DIMS.map((d) => (
                  <option key={d.k} value={d.k}>
                    {d.l}
                  </option>
                ))}
              </select>
            </div>
            <Agrupado items={enriched} dim={dim} noPeriodo={(d) => noPeriodo(d) || (!de && !ate)} onFiltrar={(v) => setF({ ...f, [dim]: v })} />
          </div>

          <div className="card flush">
            <h2 style={{ padding: '14px 16px 8px' }}>Backlog aberto ({backlog.length})</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Título</th>
                    <th>Tipo</th>
                    <th>Solicitante</th>
                    <th>Analista</th>
                    <th>Prioridade</th>
                    <th>Status</th>
                    <th>Aberto em</th>
                    <th className="num">Idade (d.u.)</th>
                    <th>SLA</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {backlog
                    .sort((a, b) => (b.idade ?? 0) - (a.idade ?? 0))
                    .map(({ t, idade, dentro }) => (
                      <tr key={t.id}>
                        <td>{String(t.id)}</td>
                        <td>{String(t.titulo ?? '')}</td>
                        <td className="small">{String(t.tipo ?? '')}</td>
                        <td className="small">{String(t.solicitante ?? '')}</td>
                        <td className="small">{String(t.analista ?? '—')}</td>
                        <td>
                          <Chip t={/alta|urgen|crít/i.test(String(t.prioridade)) ? 'bad' : /m[ée]dia/i.test(String(t.prioridade)) ? 'warn' : 'muted'}>{String(t.prioridade ?? '—')}</Chip>
                        </td>
                        <td>
                          <Chip v={t.status} />
                        </td>
                        <td className="small">{fmtD(t.criado)}</td>
                        <td className={`num ${dentro === false ? 'neg' : ''}`}>{um(idade)}</td>
                        <td>{dentro == null ? <span className="muted small">—</span> : dentro ? <Chip t="ok">no SLA</Chip> : <Chip t="bad">fora</Chip>}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {linkDe(t, base) && (
                            <a className="btn ghost sm" href={linkDe(t, base)} target="_blank" rel="noreferrer" title="Abrir no SharePoint">
                              <Icon name="link" size={14} />
                            </a>
                          )}
                          <button className="btn ghost sm" title="Criar tarefa de acompanhamento" onClick={() => criarTarefa(t)}>
                            <Icon name="plus" size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="row">
            <span className="small muted grow">{tickets.length} tickets importados. d.u. = dias úteis.</span>
            {canWrite() && (
              <button
                className="btn sm danger"
                onClick={async () => {
                  if (await confirmar('Apagar todos os tickets importados?', { ok: 'Apagar', danger: true })) replaceAll({ ...getDB(), tickets: [] })
                }}
              >
                Limpar importação
              </button>
            )}
          </div>
        </>
      )}
      {raw && <Mapeamento raw={raw} onClose={() => setRaw(null)} />}
      {cfg && (
        <Config
          prioridades={opts('prioridade')}
          sla={sla}
          base={base}
          onSave={(s, b) => {
            setSla(s)
            setBase(b)
            setPref('tk:sla', s)
            setPref('tk:base', b)
            setCfg(false)
          }}
          onClose={() => setCfg(false)}
        />
      )}
    </>
  )
}

function linkDe(t: Item, base: string) {
  const l = String(t.link ?? '')
  if (/^https?:/i.test(l)) return l
  return base && t.id ? base + encodeURIComponent(String(t.id)) : ''
}

type Enr = { t: Item; conclusao: string | null; lead: number | null; idade: number | null; dentro: boolean | null }

function Agrupado({ items, dim, noPeriodo, onFiltrar }: { items: Enr[]; dim: string; noPeriodo: (d: string | null) => boolean; onFiltrar: (v: string) => void }) {
  const g = new Map<string, Enr[]>()
  items.forEach((e) => {
    const k = String(e.t[dim] ?? '—') || '—'
    g.set(k, [...(g.get(k) ?? []), e])
  })
  const linhas = [...g.entries()]
    .map(([k, es]) => {
      const rec = es.filter((e) => noPeriodo((e.t.criado as string) ?? null)).length
      const conc = es.filter((e) => e.conclusao && !isCancel(e.t) && noPeriodo(e.conclusao))
      const leads = conc.map((e) => e.lead).filter((x): x is number => x != null)
      const sla = conc.filter((e) => e.dentro != null)
      const abertos = es.filter((e) => !isClosed(e.t))
      return {
        k,
        rec,
        conc: conc.length,
        abertos: abertos.length,
        fora: abertos.filter((e) => e.dentro === false).length,
        lead: leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : null,
        sla: sla.length ? (sla.filter((e) => e.dentro).length / sla.length) * 100 : null,
      }
    })
    .sort((a, b) => b.rec - a.rec)
  const max = Math.max(1, ...linhas.map((l) => l.rec))
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{DIMS.find((d) => d.k === dim)?.l}</th>
            <th className="num">Recebidos</th>
            <th style={{ width: 140 }} />
            <th className="num">Concluídos</th>
            <th className="num">Abertos</th>
            <th className="num">Fora SLA</th>
            <th className="num">Tempo médio (d.u.)</th>
            <th className="num">% no SLA</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.k} className="click" onClick={() => onFiltrar(l.k)} title="Filtrar por este valor">
              <td>{l.k}</td>
              <td className="num">{l.rec}</td>
              <td>
                <Bar value={l.rec} max={max} />
              </td>
              <td className="num">{l.conc}</td>
              <td className="num">{l.abertos}</td>
              <td className={`num ${l.fora ? 'neg' : ''}`}>{l.fora || ''}</td>
              <td className="num">{um(l.lead)}</td>
              <td className="num">{l.sla == null ? '—' : pct(Math.round(l.sla))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Recebidos × concluídos por mês e backlog ao fim de cada mês (últimos 12 meses com dados). */
function Fluxo({ items }: { items: Enr[] }) {
  const meses = new Set<string>()
  items.forEach((e) => {
    if (e.t.criado) meses.add(String(e.t.criado).slice(0, 7))
    if (e.conclusao) meses.add(e.conclusao.slice(0, 7))
  })
  const ms = [...meses].sort().slice(-12)
  if (!ms.length) return <div className="empty">Sem datas para montar o gráfico.</div>
  const dados = ms.map((m) => {
    const fim = m + '-31T23:59'
    return {
      m,
      rec: items.filter((e) => String(e.t.criado ?? '').startsWith(m)).length,
      conc: items.filter((e) => e.conclusao?.startsWith(m)).length,
      back: items.filter((e) => String(e.t.criado ?? '') <= fim && !(e.conclusao && e.conclusao <= fim) && !(isClosed(e.t) && !e.conclusao)).length,
    }
  })
  const max = Math.max(1, ...dados.flatMap((d) => [d.rec, d.conc, d.back]))
  const W = 720
  const H = 210
  const pad = 30
  const bw = (W - pad) / dados.length
  const y = (v: number) => H - 24 - (v / max) * (H - 40)
  const line = dados.map((d, i) => `${pad + i * bw + bw / 2},${y(d.back)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Recebidos e concluídos por mês">
      {[0.5, 1].map((g) => (
        <g key={g}>
          <line x1={pad} x2={W} y1={y(max * g)} y2={y(max * g)} stroke="var(--border)" />
          <text x={pad - 5} y={y(max * g) + 4} fontSize="10" textAnchor="end" fill="var(--muted)">
            {Math.round(max * g)}
          </text>
        </g>
      ))}
      {dados.map((d, i) => {
        const x = pad + i * bw
        const w = bw * 0.32
        const [ano, mes] = d.m.split('-').map(Number)
        return (
          <g key={d.m}>
            <title>{`${MES_CURTO[mes - 1]}/${ano}: ${d.rec} recebidos · ${d.conc} concluídos · backlog ${d.back}`}</title>
            <rect x={x + bw * 0.16} y={y(d.rec)} width={w} height={H - 24 - y(d.rec)} rx="3" fill="var(--brand-2)" />
            <rect x={x + bw * 0.16 + w + 2} y={y(d.conc)} width={w} height={H - 24 - y(d.conc)} rx="3" fill="var(--accent)" />
            <text x={x + bw / 2} y={H - 8} fontSize="10.5" textAnchor="middle" fill="var(--muted)">
              {MES_CURTO[mes - 1]}
              {mes === 1 || i === 0 ? `/${String(ano).slice(2)}` : ''}
            </text>
          </g>
        )
      })}
      <polyline points={line} fill="none" stroke="var(--bad)" strokeWidth="2" />
      {dados.map((d, i) => (
        <circle key={d.m} cx={pad + i * bw + bw / 2} cy={y(d.back)} r="3" fill="var(--bad)" />
      ))}
    </svg>
  )
}

function Mapeamento({ raw, onClose }: { raw: Raw; onClose: () => void }) {
  const sig = raw.head.map(norm).join('|')
  const [map, setMap] = useState<Record<string, number>>(() => getPref<Record<string, Record<string, number>>>('tk:maps', {})[sig] ?? autoMap(raw.head))
  const [fmt, setFmt] = useState<FmtData>(() => detectFmt(raw.rows.slice(0, 200).flatMap((r) => [r[map.criado ?? -1], r[map.modificado ?? -1]])))
  const [modo, setModo] = useState<'somar' | 'substituir'>('somar')
  const faltam = CAMPOS.filter((c) => c.obrig && map[c.key] == null)

  function converter(): Item[] {
    return raw.rows
      .map((r) => {
        const o: Item = { id: '' }
        for (const c of CAMPOS) {
          const i = map[c.key]
          const v = i == null ? undefined : r[i]
          o[c.key] = c.tipo === 'data' ? toDateTime(v, fmt) : c.tipo === 'num' ? toNumber(v) : v == null || v === '' ? null : String(v).trim()
        }
        return o
      })
      .filter((o) => o.id)
  }

  function importar() {
    const novos = converter().map((t) => ({ ...t, id: String(t.id) }))
    const atual = modo === 'substituir' ? [] : (getDB().tickets ?? [])
    const m = new Map(atual.map((t) => [t.id, t]))
    novos.forEach((t) => m.set(t.id, t))
    replaceAll({ ...getDB(), tickets: [...m.values()] })
    const maps = getPref<Record<string, Record<string, number>>>('tk:maps', {})
    setPref('tk:maps', { ...maps, [sig]: map })
    avisar(`${novos.length} ticket(s) importado(s) de ${raw.nome}.`)
    onClose()
  }

  const prev = converter().slice(0, 3)
  return (
    <Modal
      wide
      title={`Importar ${raw.nome} · ${raw.rows.length} linhas`}
      onClose={onClose}
      foot={
        <>
          <select id="tk-modo" value={modo} onChange={(e) => setModo(e.target.value as 'somar' | 'substituir')} style={{ maxWidth: 300 }}>
            <option value="somar">Atualizar pelo ID e somar novos</option>
            <option value="substituir">Substituir todos os tickets</option>
          </select>
          <span className="grow small" style={{ color: 'var(--bad)' }}>
            {faltam.length ? `Mapeie: ${faltam.map((c) => c.label).join(', ')}` : ''}
          </span>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={!!faltam.length} onClick={importar}>
            Importar
          </button>
        </>
      }
    >
      <div className="modal-body" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <p className="wide small muted" style={{ margin: 0 }}>
          Confira de qual coluna do arquivo vem cada informação. O mapeamento fica salvo para as próximas importações deste mesmo layout.
        </p>
        {CAMPOS.map((c) => (
          <label key={c.key} className="field">
            <span>
              {c.label}
              {c.obrig && ' *'}
            </span>
            <select id={`map-${c.key}`} value={map[c.key] ?? ''} onChange={(e) => setMap({ ...map, [c.key]: e.target.value === '' ? (undefined as unknown as number) : Number(e.target.value) })}>
              <option value="">— não usar —</option>
              {raw.head.map((h, i) => (
                <option key={i} value={i}>
                  {h || `Coluna ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="field">
          <span>Formato das datas</span>
          <select id="map-fmt" value={fmt} onChange={(e) => setFmt(e.target.value as FmtData)}>
            <option value="dmy">DD/MM/AAAA (Brasil)</option>
            <option value="mdy">MM/DD/AAAA (EUA)</option>
          </select>
        </label>
        <div className="wide table-wrap">
          <table>
            <thead>
              <tr>
                {['ID', 'Título', 'Status', 'Prioridade', 'Tipo', 'Solicitante', 'Criado', 'Fechado'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prev.map((t) => (
                <tr key={t.id}>
                  <td>{String(t.id)}</td>
                  <td>{String(t.titulo ?? '')}</td>
                  <td>{String(t.status ?? '')}</td>
                  <td>{String(t.prioridade ?? '')}</td>
                  <td>{String(t.tipo ?? '')}</td>
                  <td>{String(t.solicitante ?? '')}</td>
                  <td>{t.criado ? new Date(String(t.criado)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                  <td>{t.fechado ? new Date(String(t.fechado)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}

function Config({ prioridades, sla, base, onSave, onClose }: { prioridades: string[]; sla: Record<string, number>; base: string; onSave: (s: Record<string, number>, b: string) => void; onClose: () => void }) {
  const lista = [...new Set([...prioridades.filter((p) => p !== '—'), ...(prioridades.length ? [] : Object.keys(sla))])]
  const [v, setV] = useState<Record<string, number>>(() => Object.fromEntries(lista.map((p) => [p, slaDe({ id: '', prioridade: p }, sla) ?? 3])))
  const [b, setB] = useState(base)
  return (
    <Modal
      title="SLA e link dos tickets"
      onClose={onClose}
      foot={
        <>
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={() => onSave({ ...sla, ...v }, b.trim())}>
            Salvar
          </button>
        </>
      }
    >
      <div className="modal-body">
        <p className="wide small muted" style={{ margin: 0 }}>
          Prazo de atendimento em <b>dias úteis</b> por prioridade, contado da abertura (Created) até a conclusão (Fechado).
        </p>
        {lista.map((p) => (
          <label key={p} className="field">
            <span>{p}</span>
            <input id={`sla-${norm(p)}`} type="number" step="0.5" min="0" value={v[p] ?? ''} onChange={(e) => setV({ ...v, [p]: Number(e.target.value) })} />
          </label>
        ))}
        <label className="field wide">
          <span>Endereço do item no SharePoint (quando o arquivo não traz o link)</span>
          <input id="sla-base" value={b} onChange={(e) => setB(e.target.value)} placeholder="https://<empresa>.sharepoint.com/sites/<site>/Lists/Tickets_Header/DispForm.aspx?ID=" />
          <span className="help">O ID do ticket é adicionado ao final.</span>
        </label>
      </div>
    </Modal>
  )
}
