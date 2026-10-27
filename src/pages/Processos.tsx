import { useEffect } from 'react'
import { confirmar } from '../components/Dialogs'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { Bar, Chip, Kpi, PageHead, useLocalState } from '../components/ui'
import { get, remove, upsert, useDB, type Item } from '../data/store'
import { getUser } from '../lib/session'
import { MES_CURTO, daysUntil, fmtDate, iso, label, money, todayISO } from '../lib/format'
import { calcNps } from '../lib/pesquisa'

// ───────────────────────── Agenda de obrigações
type Entrega = { ok: boolean; data: string; por?: string }

/** Data de vencimento no mês, antecipando fim de semana para a sexta. */
function venc(ano: number, mes: number, dia: number) {
  const ult = new Date(ano, mes, 0).getDate()
  const d = new Date(ano, mes - 1, Math.min(Math.max(1, dia || 1), ult))
  if (d.getDay() === 6) d.setDate(d.getDate() - 1)
  if (d.getDay() === 0) d.setDate(d.getDate() - 2)
  return iso(d)
}

/** Próximos vencimentos (inclui os vencidos e não entregues dos últimos 3 meses). */
export function vencimentos(o: Item, quantos = 1): string[] {
  const entregas = (o.entregas as Record<string, Entrega>) ?? {}
  const per = String(o.periodicidade ?? 'Mensal')
  if (per === 'Eventual') {
    const d = String(o.dataEventual ?? '')
    return d && !entregas[d.slice(0, 7)]?.ok ? [d] : []
  }
  const hoje = new Date()
  const criado = String(o._created ?? todayISO()).slice(0, 7)
  const out: string[] = []
  for (let k = -3; k <= 24 && out.length < quantos; k++) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() + k, 1)
    const ano = ref.getFullYear(),
      mes = ref.getMonth() + 1
    if (per === 'Trimestral' && ![1, 4, 7, 10].includes(mes)) continue
    if (per === 'Anual' && mes !== Number(o.mesAnual || 1)) continue
    const comp = `${ano}-${String(mes).padStart(2, '0')}`
    if (k < 0 && comp < criado) continue // antes de cadastrar não conta como atrasada
    if (entregas[comp]?.ok) continue
    out.push(venc(ano, mes, Number(o.dia || 1)))
  }
  return out
}

export function Obrigacoes() {
  const db = useDB()
  const obrigs = db.obrigacoes ?? []
  // mantém o campo "próximo vencimento" atualizado (é ele que aparece no Calendário)
  useEffect(() => {
    for (const o of obrigs) {
      const p = vencimentos(o)[0] ?? null
      if ((o.proximo ?? null) !== p) upsert('obrigacoes', { id: o.id, proximo: p })
    }
  }, [obrigs])
  function entregar(o: Item, data: string) {
    const comp = data.slice(0, 7)
    const ent = { ...((o.entregas as Record<string, Entrega>) ?? {}), [comp]: { ok: true, data: todayISO(), por: getUser()?.nome } }
    const prox = vencimentos({ ...o, entregas: ent })[0] ?? null
    upsert('obrigacoes', { id: o.id, entregas: ent, proximo: prox })
  }
  async function desfazer(o: Item, comp: string) {
    if (!(await confirmar(`Desmarcar a entrega de ${comp}?`))) return
    const ent = { ...((o.entregas as Record<string, Entrega>) ?? {}) }
    delete ent[comp]
    upsert('obrigacoes', { id: o.id, entregas: ent, proximo: vencimentos({ ...o, entregas: ent })[0] ?? null })
  }
  const linhas = obrigs
    .map((o) => ({ o, d: vencimentos(o)[0] ?? null }))
    .sort((a, b) => String(a.d ?? '9').localeCompare(String(b.d ?? '9')))
  const atrasadas = linhas.filter((x) => x.d && (daysUntil(x.d) ?? 0) < 0)
  const semana = linhas.filter((x) => x.d && (daysUntil(x.d) ?? -1) >= 0 && (daysUntil(x.d) ?? 99) <= 7)
  const mesAtual = todayISO().slice(0, 7)
  const entreguesMes = obrigs.filter((o) => Object.values((o.entregas as Record<string, Entrega>) ?? {}).some((e) => e.ok && e.data.startsWith(mesAtual))).length

  return (
    <>
      <div className="grid g4">
        <Kpi l="Atrasadas" v={atrasadas.length} t={atrasadas.length ? 'bad' : undefined} />
        <Kpi l="Vencem em 7 dias" v={semana.length} t={semana.length ? 'warn' : undefined} />
        <Kpi l="Entregues no mês" v={entreguesMes} />
        <Kpi l="Obrigações cadastradas" v={obrigs.length} />
      </div>
      {linhas.length > 0 && (
        <div className="card flush">
          <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <h2 className="grow">Próximos vencimentos</h2>
            <span className="small muted">Fim de semana antecipa para a sexta. Feriados: ajuste o dia na obrigação.</span>
          </div>
          <div className="table-wrap">
            <table>
              <tbody>
                {linhas.map(({ o, d }) => {
                  const dd = daysUntil(d)
                  const ultimas = Object.entries((o.entregas as Record<string, Entrega>) ?? {})
                    .filter(([, e]) => e.ok)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 3)
                  return (
                    <tr key={o.id}>
                      <td style={{ width: 120 }}>
                        {d ? <Chip t={dd != null && dd < 0 ? 'bad' : dd != null && dd <= 7 ? 'warn' : 'info'}>{fmtDate(d)}</Chip> : <span className="muted small">—</span>}
                        {dd != null && <div className="small muted">{dd < 0 ? `${-dd}d atrasada` : dd === 0 ? 'hoje' : `em ${dd}d`}</div>}
                      </td>
                      <td className="click" onClick={() => openEditor('obrigacoes', o.id)}>
                        <b>{String(o.nome)}</b>
                        <div className="small muted">
                          {[o.tipo, o.periodicidade, o.destino].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="small" style={{ width: 170 }}>
                        {label('pessoas', get('pessoas', String(o.responsavel ?? '')))}
                        {o.backup ? <div className="muted">backup: {label('pessoas', get('pessoas', String(o.backup)))}</div> : null}
                      </td>
                      <td className="small muted hide-sm" style={{ width: 170 }}>
                        {ultimas.map(([c, e]) => (
                          <span key={c} className="obr-ent" title={`Entregue em ${fmtDate(e.data)}${e.por ? ` por ${e.por}` : ''} — clique para desfazer`} onClick={() => void desfazer(o, c)}>
                            ✓ {MES_CURTO[Number(c.slice(5)) - 1]}/{c.slice(2, 4)}
                          </span>
                        ))}
                      </td>
                      <td style={{ width: 130, textAlign: 'right' }}>
                        {d && (
                          <button className="btn sm primary" onClick={() => entregar(o, d)}>
                            ✓ Entregue
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

export function ObrigacoesPage() {
  return <ModulePage col="obrigacoes" above={() => <Obrigacoes />} />
}

// ───────────────────────── Checklists recorrentes
type Marca = { ok: boolean; por?: string; data?: string }
const itensDoTexto = (t: unknown) =>
  String(t ?? '')
    .split('\n')
    .map((x) => x.replace(/^\s*(\[[ x]?\]|[-•*]|\d+[.)])\s*/i, '').trim())
    .filter(Boolean)

function referenciaPadrao(per: string) {
  const d = new Date()
  if (per === 'Mensal') return `${MES_CURTO[d.getMonth()]}/${d.getFullYear()}`
  if (per === 'Trimestral') return `${Math.floor(d.getMonth() / 3) + 1}º tri/${d.getFullYear()}`
  if (per === 'Anual') return String(d.getFullYear())
  return fmtDate(todayISO())
}

export function Checklists() {
  const db = useDB()
  const modelos = (db.modelosChecklist ?? []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome)))
  const execs = (db.execucoesChecklist ?? []).slice().sort((a, b) => Number(!!a.concluido) - Number(!!b.concluido) || String(b._created ?? '').localeCompare(String(a._created ?? '')))
  const [abertaId, setAberta] = useLocalState('chk:aberta', '')
  const aberta = execs.find((e) => e.id === abertaId)

  function iniciar(m: Item) {
    const e = upsert('execucoesChecklist', {
      modelo: m.id,
      nome: m.nome,
      referencia: referenciaPadrao(String(m.periodicidade ?? '')),
      responsavel: m.responsavel ?? null,
      itens: itensDoTexto(m.itens),
      marcas: {},
    })
    if (e) setAberta(e.id)
  }
  function marcar(e: Item, i: number, ok: boolean) {
    const marcas: Record<string, Marca> = { ...((e.marcas as Record<string, Marca>) ?? {}), [i]: ok ? { ok, por: getUser()?.nome, data: todayISO() } : { ok: false } }
    const itens = (e.itens as string[]) ?? []
    const concluido = itens.every((_, k) => marcas[k]?.ok)
    upsert('execucoesChecklist', { id: e.id, marcas, concluido, concluidoEm: concluido ? todayISO() : null })
  }
  const progresso = (e: Item) => {
    const itens = (e.itens as string[]) ?? []
    const m = (e.marcas as Record<string, Marca>) ?? {}
    return { feitos: itens.filter((_, k) => m[k]?.ok).length, total: itens.length }
  }

  return (
    <>
      <PageHead title="Checklists recorrentes" desc="Modelos reaproveitáveis (reconciliações, abertura de período, auditoria, desligamento, rotinas). Inicie um checklist a cada ciclo e acompanhe quem marcou cada item e quando.">
        <button className="btn primary" onClick={() => openEditor('modelosChecklist')}>
          <Icon name="plus" size={15} /> Novo modelo
        </button>
      </PageHead>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2 className="grow">Modelos</h2>
            </div>
            {modelos.length === 0 && <span className="small muted">Crie um modelo com um item por linha. Ex.: “Conciliação bancária”, “Conferir provisões”…</span>}
            <div className="list">
              {modelos.map((m) => (
                <div key={m.id}>
                  <span className="grow click" onClick={() => openEditor('modelosChecklist', m.id)}>
                    <b>{String(m.nome)}</b>
                    <div className="small muted">
                      {[m.area, m.periodicidade, `${itensDoTexto(m.itens).length} itens`].filter(Boolean).join(' · ')}
                    </div>
                  </span>
                  <button className="btn sm" onClick={() => iniciar(m)}>
                    ▶ Iniciar
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2 className="grow">Execuções</h2>
            </div>
            {execs.length === 0 && <span className="small muted">Nenhum checklist iniciado.</span>}
            <div className="list">
              {execs.map((e) => {
                const p = progresso(e)
                return (
                  <div key={e.id} className={`click ${aberta?.id === e.id ? 'sel' : ''}`} onClick={() => setAberta(e.id)}>
                    <span className="grow">
                      <b>{String(e.nome ?? label('modelosChecklist', get('modelosChecklist', String(e.modelo))))}</b> <span className="muted small">· {String(e.referencia)}</span>
                    </span>
                    <span style={{ width: 90 }}>
                      <Bar value={p.feitos} max={p.total || 1} t={e.concluido ? 'ok' : undefined} />
                    </span>
                    <span className="small">
                      {p.feitos}/{p.total}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        {aberta ? (
          <div className="card stack">
            <div className="row">
              <h2 className="grow">
                {String(aberta.nome ?? '')} · {String(aberta.referencia)}
              </h2>
              {aberta.concluido ? <Chip t="ok">concluído {fmtDate(aberta.concluidoEm)}</Chip> : null}
              <button
                className="btn ghost sm danger"
                title="Excluir esta execução"
                onClick={async () => {
                  if (await confirmar('Excluir esta execução do checklist?', { ok: 'Excluir', danger: true })) {
                    remove('execucoesChecklist', aberta.id)
                    setAberta('')
                  }
                }}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
            <div className="row small">
              <span>Referência</span>
              <input value={String(aberta.referencia ?? '')} onChange={(e) => upsert('execucoesChecklist', { id: aberta.id, referencia: e.target.value })} style={{ width: 160 }} />
              <span>Prazo</span>
              <input type="date" value={String(aberta.prazo ?? '')} onChange={(e) => upsert('execucoesChecklist', { id: aberta.id, prazo: e.target.value || null })} style={{ width: 160 }} />
            </div>
            <div className="chk-itens">
              {((aberta.itens as string[]) ?? []).map((t, i) => {
                const m = ((aberta.marcas as Record<string, Marca>) ?? {})[i]
                return (
                  <label key={i} className={`chk-item ${m?.ok ? 'ok' : ''}`}>
                    <input type="checkbox" checked={!!m?.ok} onChange={(e) => marcar(aberta, i, e.target.checked)} />
                    <span className="grow">{t}</span>
                    {m?.ok && (
                      <span className="small muted">
                        {m.por?.split(' ')[0]} · {fmtDate(m.data)}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="card empty">Escolha uma execução ou inicie um checklist a partir de um modelo.</div>
        )}
      </div>
    </>
  )
}

// ───────────────────────── NPS dos clientes internos
export function NpsInterno() {
  return (
    <ModulePage
      col="npsInterno"
      above={(rows) => {
        const ciclos = [...new Set(rows.map((r) => String(r.ciclo ?? '')))].sort().reverse()
        if (!ciclos.length) return null
        const atual = ciclos[0]
        const doCiclo = rows.filter((r) => String(r.ciclo) === atual)
        const geral = calcNps(doCiclo.map((r) => Number(r.nota)))
        const areas = [...new Set(doCiclo.map((r) => String(r.area ?? '')))]
        const cor = (v: number | null | undefined) => (v == null ? undefined : v >= 50 ? 'var(--ok)' : v >= 0 ? 'var(--warn)' : 'var(--bad)')
        return (
          <div className="grid g2" style={{ alignItems: 'start' }}>
            <div className="card stack" style={{ gap: 6 }}>
              <h2>NPS do ciclo {atual}</h2>
              <div className="row">
                <span className="enps" style={{ color: cor(geral?.valor) }}>
                  {geral?.valor ?? '—'}
                </span>
                <span className="small muted">
                  {geral ? `${geral.n} resposta(s) · ${geral.prom} promotores · ${geral.neutros} neutros · ${geral.det} detratores` : ''}
                </span>
              </div>
              <div className="list">
                {ciclos.slice(0, 6).map((c) => {
                  const v = calcNps(rows.filter((r) => String(r.ciclo) === c).map((r) => Number(r.nota)))
                  return (
                    <div key={c}>
                      <span className="grow">{c}</span>
                      <b style={{ color: cor(v?.valor) }}>{v?.valor ?? '—'}</b>
                      <span className="small muted">{v?.n ?? 0} resp.</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h2 className="grow">Por área cliente ({atual})</h2>
              </div>
              <div className="list">
                {areas.map((a) => {
                  const v = calcNps(doCiclo.filter((r) => String(r.area) === a).map((r) => Number(r.nota)))
                  return (
                    <div key={a}>
                      <span className="grow">{a}</span>
                      <b style={{ color: cor(v?.valor) }}>{v?.valor ?? '—'}</b>
                      <span className="small muted">{v?.n} resp.</span>
                    </div>
                  )
                })}
              </div>
              <span className="small muted">NPS = % notas 9–10 − % notas 0–6. Pergunta sugerida: “De 0 a 10, quanto você recomendaria o serviço da Controladoria?”</span>
            </div>
          </div>
        )
      }}
    />
  )
}


// ───────────────────────── Contratos e vencimentos
const MESES_POR: Record<string, number> = { Mensal: 1, Trimestral: 3, Semestral: 6, Anual: 12, '2 anos': 24, '3 anos': 36 }
const ativo = (c: Item) => !/encerrad|cancelad/i.test(String(c.status ?? ''))

/** Soma meses mantendo o dia (31/01 + 1 mês = 28 ou 29/02). */
function somarMeses(isoData: string, meses: number) {
  const [y, m, d] = isoData.split('-').map(Number)
  const alvo = new Date(Date.UTC(y, m - 1 + meses, 1))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(d, ultimo))
  return alvo.toISOString().slice(0, 10)
}

function Contratos() {
  const db = useDB()
  const lista = (db.contratos ?? []).filter(ativo)
  const comPrazo = lista.map((c) => ({ c, d: daysUntil(c.vencimento) })).filter((x): x is { c: Item; d: number } => x.d != null)
  const vencidos = comPrazo.filter((x) => x.d < 0)
  const ate = (n: number) => comPrazo.filter((x) => x.d >= 0 && x.d <= n).length
  const anual = lista.reduce((s, c) => {
    const m = MESES_POR[String(c.periodicidade ?? '')]
    return s + (m ? (Number(c.valor) || 0) * (12 / m) : 0)
  }, 0)
  const proximos = comPrazo.filter((x) => x.d <= Math.max(Number(x.c.avisoDias ?? 30) || 30, 0)).sort((a, b) => a.d - b.d)

  async function renovar(c: Item) {
    const meses = MESES_POR[String(c.periodicidade ?? '')]
    const atual = String(c.vencimento ?? '')
    if (!meses || !atual) return openEditor('contratos', c.id)
    const novo = somarMeses(atual, meses)
    const ok = await confirmar(`Renovar "${c.item}"?\n\nVencimento atual: ${fmtDate(atual)}\nNovo vencimento: ${fmtDate(novo)}\n\nO vencimento anterior fica registrado no histórico. Se a data ou o valor mudaram, ajuste depois no cadastro.`, { ok: 'Renovar' })
    if (!ok) return
    const linha = `${fmtDate(todayISO())}: renovado por ${getUser()?.nome ?? '—'} — vencia em ${fmtDate(atual)}, novo vencimento ${fmtDate(novo)}${c.valor ? ` (valor ${money(c.valor, true)})` : ''}`
    upsert('contratos', { id: c.id, vencimento: novo, status: 'Vigente', historico: [linha, String(c.historico ?? '').trim()].filter(Boolean).join('\n') })
  }

  return (
    <>
      <div className="grid g4">
        <Kpi l="Vencidos" v={vencidos.length} t={vencidos.length ? 'bad' : undefined} />
        <Kpi l="Vencem em 30 dias" v={ate(30)} t={ate(30) ? 'warn' : undefined} d={`60 dias: ${ate(60)} · 90 dias: ${ate(90)}`} />
        <Kpi l="Custo anual (ativos)" v={money(anual)} d="Valor por período convertido para 12 meses" />
        <Kpi l="Itens ativos" v={lista.length} />
      </div>
      {proximos.length > 0 && (
        <div className="card flush">
          <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <h2 className="grow">Precisam de atenção</h2>
            <span className="small muted">Dentro do prazo de aviso de cada item</span>
          </div>
          <div className="table-wrap">
            <table>
              <tbody>
                {proximos.map(({ c, d }) => (
                  <tr key={c.id}>
                    <td className="click" onClick={() => openEditor('contratos', c.id)}>
                      <b>{String(c.item)}</b>
                      <div className="small muted">
                        {[c.tipo, c.fornecedor, c.responsavel ? label('pessoas', get('pessoas', String(c.responsavel))) : null].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td>{fmtDate(c.vencimento)}</td>
                    <td>
                      <Chip t={d < 0 ? 'bad' : d <= 7 ? 'bad' : 'warn'}>{d < 0 ? `vencido há ${-d}d` : d === 0 ? 'vence hoje' : `faltam ${d}d`}</Chip>
                      {Boolean(c.renovacaoAuto) && <span className="small muted"> renovação automática</span>}
                    </td>
                    <td className="num">
                      <button className="btn sm" onClick={() => renovar(c)} title="Registra a renovação e calcula o próximo vencimento">
                        <Icon name="check" size={14} /> Renovar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

export function ContratosPage() {
  return <ModulePage col="contratos" above={() => <Contratos />} />
}
