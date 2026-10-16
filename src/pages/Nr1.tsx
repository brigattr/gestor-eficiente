import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Attachments } from '../components/Attachments'
import { avisar, confirmar } from '../components/Dialogs'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { Bar, Chip, PageHead, useLocalState } from '../components/ui'
import {
  CAMPANHAS,
  CHECKLIST_NR1,
  DIM_FATOR,
  ESCALA_CONC,
  ESCALA_FREQ,
  FATORES_PSICO,
  INDICADORES_ALERTA,
  MIN_RESPOSTAS,
  PERGUNTAS,
  PROBABILIDADE,
  SEVERIDADE,
  SITUACAO_JURIDICA,
  TOTAL_CHECK_NR1,
  classeRisco,
  nivelRisco,
} from '../data/nr1'
import { get, upsert, useDB, type Item } from '../data/store'
import { isDone } from '../lib/alerts'
import { daysUntil, downloadFile, fmtDate, fmtMonth, label, parseCSV, pct, todayISO, toCSV } from '../lib/format'

// ───────────────────────── utilitários
const corClasse: Record<string, string> = { Alto: 'bad', Moderado: 'warn', Baixo: 'info', Trivial: 'muted' }
const anoAtual = () => String(new Date().getFullYear())
const normaliza = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

type Check = { ok?: boolean; resp?: string; data?: string; obs?: string }
const chaveCheck = (g: number, i: number) => `${g}.${i}`

function treinosAssedio(db: Record<string, Item[]>) {
  const re = /ass[eé]dio|14\.?457|viol[eê]ncia/i
  return (db.certificacoes ?? []).filter((t) => re.test(String(t.nome ?? '')) || re.test(String(t.tipo ?? '')))
}

// ───────────────────────── Painel
export function PainelNr1() {
  const db = useDB()
  const riscos = db.riscosPsico ?? []
  const acoes = db.acoesPsico ?? []
  const relatos = db.relatosPsico ?? []
  const checkins = db.checkinsBemEstar ?? []
  const pesquisas = (db.pesquisasPsico ?? []).slice().sort((a, b) => String(b.data ?? '').localeCompare(String(a.data ?? '')))
  const checklist = (get('nr1checklist', anoAtual())?.checks as Record<string, Check>) ?? {}
  const feitos = Object.values(checklist).filter((c) => c.ok).length
  const ativos = riscos.filter((r) => !isDone('riscosPsico', r))
  const niveis = ativos.map((r) => classeRisco(nivelRisco(r.probabilidade, r.severidade)))
  const abertas = acoes.filter((a) => !isDone('acoesPsico', a))
  const atrasadas = abertas.filter((a) => (daysUntil(a.prazo) ?? 1) < 0)
  const revisoes = riscos.filter((r) => r.revisarEm && (daysUntil(r.revisarEm) ?? 99) <= 30)
  const ult = pesquisas[0]
  const resUlt = ult ? resultado(ult) : null
  const pessoasAtivas = (db.pessoas ?? []).filter((p) => !/deslig/i.test(String(p.status ?? '')))
  const treinos = treinosAssedio(db)
  const semTreino = pessoasAtivas.filter((p) => !treinos.some((t) => t.colaborador === p.id && t.realizado && (daysUntil(t.realizado) ?? -999) > -365))
  const indic = (db.indicadoresPsico ?? []).slice().sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)))
  const mes = new Date().getMonth() + 1
  const campanha = CAMPANHAS.find((c) => c.mes > mes) ?? CAMPANHAS[0]
  const proximosCheckins = checkins.filter((c) => c.proximo && (daysUntil(c.proximo) ?? 99) <= 7 && (daysUntil(c.proximo) ?? -99) >= -30)

  return (
    <>
      <PageHead title="Saúde mental e NR-1" desc="Gestão dos riscos psicossociais da área, como exige a NR-1 (PGR): inventário, plano de ação, pesquisa anônima, indicadores, rituais de bem-estar e evidências.">
        <Link className="btn" to="/nr1-guia">
          <Icon name="book" size={15} /> Guia e legislação
        </Link>
      </PageHead>

      <div className="card nr1-juridico">
        <div className="row">
          <Icon name="alert" />
          <b className="grow">Situação em {SITUACAO_JURIDICA.data}: obrigação em vigor desde 26/05/2026; multas específicas suspensas pelo STF (ADPF 1.316)</b>
          <Link className="small" to="/nr1-guia">
            entender →
          </Link>
        </div>
        <span className="small muted">Mesmo sem multa, o auditor pode pedir o inventário, o plano de ação e as evidências. É o que este menu organiza.</span>
      </div>

      <div className="grid g4">
        <Link to="/nr1-checklist" className="card kpi nr1-kpi">
          <span className="l">Checklist {anoAtual()}</span>
          <span className="v">{Math.round((feitos / TOTAL_CHECK_NR1) * 100)}%</span>
          <Bar value={feitos} max={TOTAL_CHECK_NR1} t={feitos === TOTAL_CHECK_NR1 ? 'ok' : undefined} />
          <span className="d muted">
            {feitos} de {TOTAL_CHECK_NR1} evidências
          </span>
        </Link>
        <Link to="/nr1-inventario" className="card kpi nr1-kpi">
          <span className="l">Riscos ativos</span>
          <span className="v">{ativos.length}</span>
          <span className="d">
            {['Alto', 'Moderado', 'Baixo'].map((c) => (niveis.filter((x) => x === c).length ? <Chip key={c} t={corClasse[c]}>{`${niveis.filter((x) => x === c).length} ${c.toLowerCase()}`}</Chip> : null))}
            {!ativos.length && <span className="muted">nenhum no inventário</span>}
          </span>
        </Link>
        <Link to="/nr1-plano" className="card kpi nr1-kpi">
          <span className="l">Ações abertas</span>
          <span className="v" style={atrasadas.length ? { color: 'var(--bad)' } : undefined}>
            {abertas.length}
          </span>
          <span className="d muted">{atrasadas.length ? `${atrasadas.length} atrasada(s)` : `${acoes.filter((a) => isDone('acoesPsico', a)).length} concluída(s)`}</span>
        </Link>
        <Link to="/nr1-pesquisa" className="card kpi nr1-kpi">
          <span className="l">Última pesquisa</span>
          <span className="v">{ult ? (resUlt && resUlt.n >= MIN_RESPOSTAS ? `${resUlt.dims.filter((d) => d.score != null && d.score > 66).length} 🔴` : '—') : '—'}</span>
          <span className="d muted">{ult ? `${String(ult.nome)} · ${resUlt?.n ?? 0} resposta(s)` : 'nenhum ciclo ainda'}</span>
        </Link>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <Icon name="checklist" />
            <h2 className="grow">Pendências</h2>
          </div>
          <div className="list">
            {atrasadas.map((a) => (
              <div key={a.id} className="click" onClick={() => openEditor('acoesPsico', a.id)}>
                <Chip t="bad">atrasada</Chip>
                <span className="grow">{String(a.acao)}</span>
                <span className="small muted">{fmtDate(a.prazo)}</span>
              </div>
            ))}
            {revisoes.map((r) => (
              <div key={r.id} className="click" onClick={() => openEditor('riscosPsico', r.id)}>
                <Chip t="warn">revisar</Chip>
                <span className="grow">{String(r.perigo)}</span>
                <span className="small muted">{fmtDate(r.revisarEm)}</span>
              </div>
            ))}
            {relatos
              .filter((r) => !isDone('relatosPsico', r))
              .map((r) => (
                <div key={r.id} className="click" onClick={() => openEditor('relatosPsico', r.id)}>
                  <Chip t="info">relato</Chip>
                  <span className="grow">{String(r.resumo)}</span>
                  <span className="small muted">{r.prazo ? fmtDate(r.prazo) : fmtDate(r.data)}</span>
                </div>
              ))}
            {proximosCheckins.map((c) => (
              <div key={c.id} className="click" onClick={() => openEditor('checkinsBemEstar', c.id)}>
                <Chip t="muted">check-in</Chip>
                <span className="grow">{label('pessoas', get('pessoas', String(c.colaborador)))}</span>
                <span className="small muted">{fmtDate(c.proximo)}</span>
              </div>
            ))}
            {!atrasadas.length && !revisoes.length && !relatos.some((r) => !isDone('relatosPsico', r)) && !proximosCheckins.length && <div className="muted small">Nada pendente agora.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <Icon name="alert" />
            <h2 className="grow">Matriz de risco (probabilidade × severidade)</h2>
          </div>
          <Matriz riscos={ativos} />
        </div>

        <div className="card">
          <div className="card-head">
            <Icon name="book" />
            <h2 className="grow">Treinamento anual de assédio (Lei 14.457)</h2>
            <Link className="small" to="/treinamentos">
              treinamentos →
            </Link>
          </div>
          {pessoasAtivas.length === 0 ? (
            <span className="muted small">Cadastre o time para acompanhar.</span>
          ) : semTreino.length === 0 ? (
            <Chip t="ok">Todos com treinamento nos últimos 12 meses</Chip>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              <span className="small">
                <b>{semTreino.length}</b> de {pessoasAtivas.length} pessoa(s) sem registro de treinamento de assédio/violência nos últimos 12 meses:
              </span>
              <span className="small muted">{semTreino.map((p) => String(p.nome)).join(', ')}</span>
              <span className="small muted">Registre em Treinamentos com “assédio” no nome ou no tipo.</span>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <Icon name="trending" />
            <h2 className="grow">Indicadores</h2>
            <Link className="small" to="/nr1-indicadores">
              ver todos →
            </Link>
          </div>
          {indic.length ? <ResumoIndicadores atual={indic[0]} anterior={indic[1]} /> : <span className="muted small">Lance o primeiro mês em Indicadores de saúde e clima.</span>}
        </div>
      </div>

      <div className="card row small">
        <Icon name="calendar" />
        <span className="grow">
          Próxima campanha: <b>{campanha.nome}</b> — {campanha.tema}
        </span>
        <span className="muted">Apoio emocional 24h: CVV 188 · Emergência: SAMU 192</span>
      </div>
    </>
  )
}

function Matriz({ riscos }: { riscos: Item[] }) {
  const cel = (p: number, s: number) => riscos.filter((r) => parseInt(String(r.probabilidade)) === p && parseInt(String(r.severidade)) === s)
  const cor = (n: number) => (n >= 15 ? 'var(--bad)' : n >= 8 ? 'var(--warn)' : n >= 4 ? 'var(--info)' : 'var(--ok)')
  return (
    <div className="nr1-matriz">
      <span className="nr1-eixo-y small muted">Probabilidade →</span>
      <div className="nr1-grade">
        {[5, 4, 3, 2, 1].map((p) =>
          [1, 2, 3, 4, 5].map((s) => {
            const xs = cel(p, s)
            return (
              <div key={`${p}${s}`} className="nr1-cel" style={{ ['--c' as string]: cor(p * s) }} title={xs.map((r) => String(r.perigo)).join('\n') || `P${p} × S${s} = ${p * s}`} onClick={() => xs[0] && openEditor('riscosPsico', xs[0].id)}>
                {xs.length || ''}
              </div>
            )
          }),
        )}
      </div>
      <span className="small muted nr1-eixo-x">Severidade →</span>
    </div>
  )
}

function ResumoIndicadores({ atual, anterior }: { atual: Item; anterior?: Item }) {
  const linhas: [string, string, boolean][] = [
    ['absenteismo', 'Absenteísmo', true],
    ['horasExtras', 'Horas extras/pessoa', false],
    ['afastamentosF', 'Afastamentos saúde mental', false],
    ['turnover', 'Turnover voluntário', true],
    ['umAum', '1:1 realizados', true],
    ['feriasVencidas', 'Férias vencidas', false],
  ]
  return (
    <div className="list">
      <div className="small muted">{fmtMonth(atual.competencia)}{anterior ? ` × ${fmtMonth(anterior.competencia)}` : ''}</div>
      {linhas.map(([k, l, ehPct]) => {
        const v = atual[k],
          a = anterior?.[k]
        if (v == null || v === '') return null
        const dif = a != null && a !== '' ? Number(v) - Number(a) : null
        const melhor = k === 'umAum' ? (dif ?? 0) > 0 : (dif ?? 0) < 0
        return (
          <div key={k}>
            <span className="grow">{l}</span>
            <b>{ehPct ? pct(v) : String(v)}</b>
            {dif != null && dif !== 0 && <span className={`small ${melhor ? 'pos' : 'neg'}`}>{`${dif > 0 ? '▲' : '▼'} ${Math.abs(Math.round(dif * 10) / 10)}`}</span>}
          </div>
        )
      })}
    </div>
  )
}

// ───────────────────────── Checklist de conformidade
export function ChecklistNr1() {
  const db = useDB()
  const [ciclo, setCiclo] = useLocalState('nr1:ciclo', anoAtual())
  const [aberto, setAberto] = useState('')
  const reg = get('nr1checklist', ciclo)
  const checks = (reg?.checks as Record<string, Check>) ?? {}
  const feitos = Object.values(checks).filter((c) => c.ok).length
  const pessoas = db.pessoas ?? []
  const ciclos = [...new Set([anoAtual(), ...(db.nr1checklist ?? []).map((x) => x.id)])].sort().reverse()

  function set(k: string, patch: Check) {
    const cur = checks[k] ?? {}
    const next = { ...cur, ...patch }
    if (patch.ok && !cur.data) next.data = todayISO()
    upsert('nr1checklist', { id: ciclo, ciclo, checks: { ...checks, [k]: next } })
  }

  return (
    <>
      <PageHead title="Checklist de conformidade NR-1" desc="As evidências que um auditor fiscal pediria sobre riscos psicossociais e assédio. Marque, indique o responsável e anexe a evidência (ata, lista de presença, PGR assinado…).">
        <select value={ciclo} onChange={(e) => setCiclo(e.target.value)} style={{ width: 120 }}>
          {ciclos.map((c) => (
            <option key={c}>{c}</option>
          ))}
          <option value={String(Number(anoAtual()) + 1)}>{Number(anoAtual()) + 1}</option>
        </select>
      </PageHead>
      <div className="card row">
        <b>
          Ciclo {ciclo} · {feitos} de {TOTAL_CHECK_NR1} itens
        </b>
        <span style={{ width: 260 }}>
          <Bar value={feitos} max={TOTAL_CHECK_NR1} t={feitos === TOTAL_CHECK_NR1 ? 'ok' : undefined} />
        </span>
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        {CHECKLIST_NR1.map((g, gi) => {
          const done = g.itens.filter((_, i) => checks[chaveCheck(gi, i)]?.ok).length
          return (
            <div key={g.grupo} className="card flush">
              <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <h3 className="grow">{g.grupo}</h3>
                <Chip t={done === g.itens.length ? 'ok' : 'muted'}>
                  {done}/{g.itens.length}
                </Chip>
              </div>
              {g.itens.map((txt, i) => {
                const k = chaveCheck(gi, i)
                const c = checks[k] ?? {}
                return (
                  <div key={k} className="nr1-item">
                    <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!c.ok} onChange={(e) => set(k, { ok: e.target.checked })} style={{ marginTop: 3 }} />
                      <span style={{ textDecoration: c.ok ? 'line-through' : undefined, color: c.ok ? 'var(--muted)' : undefined }}>{txt}</span>
                    </label>
                    <div className="row small" style={{ paddingLeft: 24, gap: 6 }}>
                      <select value={c.resp ?? ''} onChange={(e) => set(k, { resp: e.target.value })} style={{ width: 160 }}>
                        <option value="">Responsável…</option>
                        {pessoas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {String(p.nome)}
                          </option>
                        ))}
                      </select>
                      {c.data && <span className="muted">feito em {fmtDate(c.data)}</span>}
                      <span className="grow" />
                      <button className="btn ghost sm" onClick={() => setAberto(aberto === k ? '' : k)} title="Evidências e observação">
                        <Icon name="link" size={13} /> evidência
                      </button>
                    </div>
                    {aberto === k && (
                      <div className="stack" style={{ paddingLeft: 24, gap: 6 }}>
                        <input placeholder="Observação (onde está a evidência, nº do documento…)" value={c.obs ?? ''} onChange={(e) => set(k, { obs: e.target.value })} />
                        <Attachments col="nr1checklist" itemId={`${ciclo}-${k}`} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ───────────────────────── Inventário (lista + matriz)
export function InventarioNr1() {
  return (
    <ModulePage
      col="riscosPsico"
      above={(rows) => (
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="card-head">
              <Icon name="alert" />
              <h2 className="grow">Matriz</h2>
            </div>
            <Matriz riscos={rows.filter((r) => !isDone('riscosPsico', r))} />
          </div>
          <div className="card small stack" style={{ gap: 6 }}>
            <b>Como avaliar</b>
            <span>
              <b>Nível = probabilidade × severidade</b> (1 a 25): 15+ alto, 8–14 moderado, 4–7 baixo, 1–3 trivial.
            </span>
            <span className="muted">Probabilidade: quantas pessoas e com que frequência estão expostas (use a pesquisa e os indicadores). Severidade: o dano possível — assédio e eventos traumáticos tendem a ser graves.</span>
            <span className="muted">Para cada risco moderado ou alto, crie uma ação no Plano de ação. Revise ao menos a cada 2 anos.</span>
            <span className="muted">Probabilidade: {PROBABILIDADE.join(' · ')}</span>
            <span className="muted">Severidade: {SEVERIDADE.join(' · ')}</span>
          </div>
        </div>
      )}
    />
  )
}

// ───────────────────────── Indicadores (lista + resumo)
export function IndicadoresNr1() {
  return (
    <ModulePage
      col="indicadoresPsico"
      above={(rows) => {
        const xs = rows.slice().sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)))
        return xs.length ? (
          <div className="card">
            <ResumoIndicadores atual={xs[0]} anterior={xs[1]} />
          </div>
        ) : null
      }}
    />
  )
}

// ───────────────────────── Pesquisa anônima
type Agregado = { n: number; q: Record<string, { soma: number; cont: number }>; sim: Record<string, number> }

function resultado(c: Item) {
  const ag = (c.agregado as Agregado) ?? { n: 0, q: {}, sim: {} }
  const dims = [...new Set(PERGUNTAS.filter((p) => p.escala !== 'simnao').map((p) => p.dim))].map((dim) => {
    const ps = PERGUNTAS.filter((p) => p.dim === dim)
    let soma = 0,
      cont = 0
    for (const p of ps) {
      const a = ag.q[p.n]
      if (!a || !a.cont) continue
      const media = a.soma / a.cont
      soma += p.inv ? 4 - media : media
      cont++
    }
    return { dim, score: cont ? Math.round((soma / cont) * 25) : null }
  })
  const assedio = PERGUNTAS.filter((p) => p.escala === 'simnao').map((p) => ({ p, sim: ag.sim[p.n] ?? 0 }))
  return { n: ag.n, dims, assedio }
}

function valorResposta(v: unknown, escala: 'freq' | 'conc' | 'simnao', base1: boolean): number | null {
  if (v == null || v === '') return null
  const t = normaliza(v)
  if (escala === 'simnao') return /^(s|sim|yes|y|1|true)$/.test(t) ? 1 : /^(n|nao|no|0|false)$/.test(t) ? 0 : null
  const num = Number(t.replace(',', '.'))
  if (!isNaN(num)) return Math.max(0, Math.min(4, base1 ? num - 1 : num))
  const esc = escala === 'freq' ? ESCALA_FREQ : ESCALA_CONC
  const i = esc.findIndex((x) => normaliza(x) === t)
  if (i >= 0) return i
  const j = esc.findIndex((x) => t.startsWith(normaliza(x).slice(0, 6)))
  return j >= 0 ? j : null
}

/** Lê planilha/CSV de respostas (ex.: exportação do Microsoft Forms) e devolve só o agregado. */
function agregar(linhas: unknown[][]): { ag: Agregado; mapeadas: number } {
  const [cab, ...dados] = linhas
  const so = (x: unknown) => normaliza(x).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const cabN = (cab ?? []).map(normaliza)
  const cabS = (cab ?? []).map(so)
  const col: Record<number, number> = {}
  const usadas = new Set<number>()
  for (const p of PERGUNTAS) {
    // 1º: texto completo da pergunta no cabeçalho (perguntas 23 e 24 começam igual)
    const alvo = so(p.texto)
    let i = cabS.findIndex((h, k) => !usadas.has(k) && (h === alvo || h.includes(alvo) || (h.length > 30 && alvo.includes(h))))
    if (i < 0) {
      const ids = [`p${p.n}`, `q${p.n}`, `${p.n}`]
      i = cabN.findIndex((h) => ids.some((id) => h === id || h.startsWith(id + '.') || h.startsWith(id + ')') || h.startsWith(id + ' ') || h.startsWith(id + '-')))
    }
    if (i >= 0) {
      col[p.n] = i
      usadas.add(i)
    }
  }
  const respondentes = dados.filter((r) => r.some((x) => x != null && String(x).trim() !== ''))
  // escala 1–5? (nenhum 0 e algum 5 nas colunas numéricas)
  const nums = PERGUNTAS.filter((p) => p.escala !== 'simnao' && col[p.n] != null).flatMap((p) => respondentes.map((r) => Number(r[col[p.n]])).filter((x) => !isNaN(x)))
  const base1 = nums.length > 0 && !nums.includes(0) && nums.includes(5)
  const ag: Agregado = { n: respondentes.length, q: {}, sim: {} }
  for (const p of PERGUNTAS) {
    if (col[p.n] == null) continue
    for (const r of respondentes) {
      const v = valorResposta(r[col[p.n]], p.escala, base1)
      if (v == null) continue
      if (p.escala === 'simnao') ag.sim[p.n] = (ag.sim[p.n] ?? 0) + v
      else {
        const a = (ag.q[p.n] ??= { soma: 0, cont: 0 })
        a.soma += v
        a.cont++
      }
    }
  }
  return { ag, mapeadas: Object.keys(col).length }
}

export function PesquisaNr1() {
  const db = useDB()
  const ciclos = (db.pesquisasPsico ?? []).slice().sort((a, b) => String(b.data ?? '').localeCompare(String(a.data ?? '')))
  const [selId, setSel] = useLocalState('nr1:pesq', '')
  const sel = ciclos.find((c) => c.id === selId) ?? ciclos[0]
  const ant = sel ? ciclos[ciclos.indexOf(sel) + 1] : undefined
  const [verPerguntas, setVerPerguntas] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const res = useMemo(() => (sel ? resultado(sel) : null), [sel])
  const resAnt = useMemo(() => (ant ? resultado(ant) : null), [ant])

  function novoCiclo() {
    const d = new Date()
    const c = upsert('pesquisasPsico', { nome: `Pesquisa ${d.getFullYear()}/${d.getMonth() < 6 ? 1 : 2}`, data: todayISO(), grupo: 'Controladoria', agregado: { n: 0, q: {}, sim: {} } })
    if (c) setSel(c.id)
  }
  async function importar(f: File) {
    if (!sel) return
    let linhas: unknown[][]
    if (/\.xlsx$/i.test(f.name)) {
      const { default: readXlsxFile } = await import('read-excel-file/browser')
      const planilhas = await readXlsxFile(f)
      linhas = (planilhas[0]?.data ?? []) as unknown[][]
    } else linhas = parseCSV(await f.text())
    const { ag, mapeadas } = agregar(linhas)
    if (!mapeadas) return avisar('Não encontrei as perguntas nas colunas. Use o modelo (P1…P24) ou o texto das perguntas no cabeçalho.')
    if ((sel.agregado as Agregado)?.n && !(await confirmar(`Substituir as ${(sel.agregado as Agregado).n} respostas já importadas neste ciclo por ${ag.n} novas?`, { ok: 'Substituir' }))) return
    upsert('pesquisasPsico', { id: sel.id, agregado: ag, importadoEm: todayISO() })
    avisar(`${ag.n} resposta(s) importada(s); ${mapeadas} de ${PERGUNTAS.length} perguntas reconhecidas. Só o resultado agregado foi guardado — as respostas individuais não ficam no sistema.`)
  }
  function textoForms() {
    const esc = (p: (typeof PERGUNTAS)[number]) => (p.escala === 'freq' ? ESCALA_FREQ.join(' / ') : p.escala === 'conc' ? ESCALA_CONC.join(' / ') : 'Sim / Não')
    return [
      'Pesquisa anônima de riscos psicossociais (NR-1)',
      'Suas respostas são anônimas e serão analisadas apenas em conjunto (grupos com 5 ou mais pessoas). Não há respostas certas ou erradas.',
      '',
      ...PERGUNTAS.map((p) => `P${p.n}. ${p.texto}\n   (${esc(p)})`),
      '',
      'Em caso de assédio, use o canal de denúncia da empresa. Apoio emocional 24h: CVV 188.',
    ].join('\n')
  }
  function levarAoInventario(dim: string, score: number) {
    const fator = DIM_FATOR[dim]
    upsert('riscosPsico', {
      perigo: `${dim} — ${String(sel?.nome)} (índice ${score})`,
      fator,
      grupo: String(sel?.grupo ?? ''),
      expostos: res?.n,
      origem: 'Pesquisa anônima',
      probabilidade: PROBABILIDADE[score > 66 ? 3 : 2],
      severidade: SEVERIDADE[dim.startsWith('Assédio') ? 3 : 2],
      status: 'Identificado',
      avaliadoEm: todayISO(),
      revisarEm: `${new Date().getFullYear() + 2}${todayISO().slice(4)}`,
    })
    avisar(`“${dim}” foi para o Inventário de riscos. Ajuste probabilidade/severidade e crie a ação no Plano.`)
  }

  const ag = sel?.agregado as Agregado | undefined
  return (
    <>
      <PageHead title="Pesquisa anônima de riscos psicossociais" desc="24 perguntas curtas (adaptadas do COPSOQ II-Br e do HSE). Aplique pelo Microsoft Forms (anônimo), exporte para Excel e importe aqui: o sistema guarda só o resultado agregado, por dimensão.">
        <button className="btn" onClick={() => setVerPerguntas(!verPerguntas)}>
          <Icon name="list" size={15} /> {verPerguntas ? 'Ocultar' : 'Ver'} questionário
        </button>
        <button className="btn primary" onClick={novoCiclo}>
          <Icon name="plus" size={15} /> Novo ciclo
        </button>
      </PageHead>

      {verPerguntas && (
        <div className="card stack" style={{ gap: 8 }}>
          <div className="row">
            <b className="grow">Questionário (escala 0–4)</b>
            <button
              className="btn sm"
              onClick={() => {
                void navigator.clipboard?.writeText(textoForms())
                avisar('Texto copiado. Cole no Microsoft Forms (uma pergunta de “Escala Likert” ou “Opção” para cada item) e marque o formulário como anônimo.')
              }}
            >
              Copiar para o Forms
            </button>
            <button className="btn sm" onClick={() => downloadFile('modelo-respostas-nr1.csv', toCSV([PERGUNTAS.map((p) => `P${p.n}`), PERGUNTAS.map((p) => (p.escala === 'simnao' ? 'Não' : '2'))]), 'text/csv')}>
              <Icon name="download" size={14} /> Modelo de planilha
            </button>
          </div>
          <ol className="small nr1-perguntas">
            {PERGUNTAS.map((p) => (
              <li key={p.n}>
                {p.texto} <span className="muted">· {p.dim}</span>
                {p.inv && <span className="muted"> · positiva (invertida no cálculo)</span>}
              </li>
            ))}
          </ol>
          <span className="small muted">Respostas aceitas: o texto da escala (“Nunca”… “Sempre”, “Discordo totalmente”… “Concordo totalmente”, “Sim/Não”) ou números 0–4 (ou 1–5). Cabeçalhos: P1…P24 ou o próprio texto da pergunta.</span>
        </div>
      )}

      {ciclos.length === 0 ? (
        <div className="card empty">Crie o primeiro ciclo em “Novo ciclo”. Sugestão: uma pesquisa por semestre, fora da semana de fechamento.</div>
      ) : (
        <>
          <div className="card row">
            <select value={sel?.id} onChange={(e) => setSel(e.target.value)} style={{ width: 220 }}>
              {ciclos.map((c) => (
                <option key={c.id} value={c.id}>
                  {String(c.nome)}
                </option>
              ))}
            </select>
            <button className="btn ghost sm" onClick={() => sel && openEditor('pesquisasPsico', sel.id)} title="Renomear / data / grupo">
              <Icon name="edit" size={14} />
            </button>
            <span className="small muted grow">
              {sel?.grupo ? `${String(sel.grupo)} · ` : ''}
              {fmtDate(sel?.data)} · {ag?.n ?? 0} resposta(s){sel?.importadoEm ? ` · importado em ${fmtDate(sel.importadoEm)}` : ''}
            </span>
            <button className="btn primary" onClick={() => input.current?.click()}>
              <Icon name="upload" size={15} /> Importar respostas (Excel/CSV)
            </button>
            <input ref={input} type="file" accept=".xlsx,.csv" hidden onChange={(e) => (e.target.files?.[0] && void importar(e.target.files[0]), (e.target.value = ''))} />
          </div>

          {res && res.n > 0 && res.n < MIN_RESPOSTAS && <div className="card empty">Só {res.n} resposta(s). Para preservar o anonimato, o resultado aparece a partir de {MIN_RESPOSTAS} respostas.</div>}

          {res && res.n >= MIN_RESPOSTAS && (
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <div className="card">
                <div className="card-head">
                  <h2 className="grow">Índice de risco por dimensão</h2>
                  <span className="small muted">0 = sem risco · 100 = risco máximo</span>
                </div>
                <div className="list">
                  {res.dims.map((d) => {
                    const a = resAnt?.n && resAnt.n >= MIN_RESPOSTAS ? resAnt.dims.find((x) => x.dim === d.dim)?.score : null
                    const t = d.score == null ? 'muted' : d.score > 66 ? 'bad' : d.score > 33 ? 'warn' : 'ok'
                    return (
                      <div key={d.dim}>
                        <span className="grow">{d.dim}</span>
                        {a != null && d.score != null && a !== d.score && <span className={`small ${d.score < a ? 'pos' : 'neg'}`}>{d.score < a ? '▼' : '▲'} {Math.abs(d.score - a)}</span>}
                        <span style={{ width: 120 }}>
                          <Bar value={d.score ?? 0} t={t} />
                        </span>
                        <b style={{ width: 34, textAlign: 'right' }}>{d.score ?? '—'}</b>
                        {d.score != null && d.score > 33 ? (
                          <button className="btn ghost sm" title="Levar ao inventário de riscos" onClick={() => levarAoInventario(d.dim, d.score!)}>
                            → inventário
                          </button>
                        ) : (
                          <span style={{ width: 92 }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="stack">
                <div className="card stack" style={{ gap: 8 }}>
                  <h2>Assédio e violência (últimos 12 meses)</h2>
                  {res.assedio.map(({ p, sim }) => (
                    <div key={p.n} className="row small" style={{ flexWrap: 'nowrap' }}>
                      <Chip t={sim ? 'bad' : 'ok'}>{sim ? `${sim} sim` : 'nenhum'}</Chip>
                      <span>{p.texto}</span>
                    </div>
                  ))}
                  {res.assedio.some((x) => x.sim) && (
                    <span className="small neg">
                      Qualquer “sim” pede ação imediata, independentemente do índice: reforçar o canal de denúncia, conversar com RH/Compliance e levar ao inventário.{' '}
                      <a onClick={() => levarAoInventario('Assédio e violência', 100)}>Levar ao inventário</a>
                    </span>
                  )}
                </div>
                <div className="card small stack" style={{ gap: 4 }}>
                  <b>Como ler</b>
                  <span>
                    <Chip t="ok">0–33</Chip> favorável · <Chip t="warn">34–66</Chip> atenção · <Chip t="bad">67–100</Chip> risco
                  </span>
                  <span className="muted">Dimensões em atenção ou risco devem entrar no inventário com uma ação no plano. Compartilhe o resultado com a equipe (é evidência de participação).</span>
                  <span className="muted">Questionário adaptado para uso interno; para validade científica, use o COPSOQ II-Br publicado.</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ───────────────────────── Guia
export function GuiaNr1() {
  return (
    <>
      <PageHead title="Guia: NR-1, riscos psicossociais e saúde mental" desc={`Resumo prático para o gestor, pesquisado em ${SITUACAO_JURIDICA.data}. Confirme sempre com o SESMT/jurídico da empresa.`} />
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card stack" style={{ gap: 8 }}>
          <h2>Situação jurídica</h2>
          <ul className="nr1-ul">
            {SITUACAO_JURIDICA.itens.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <span className="small muted">{SITUACAO_JURIDICA.pendentes}</span>
          <b className="small">Fontes</b>
          <ul className="nr1-ul small">
            {SITUACAO_JURIDICA.fontes.map((f) => (
              <li key={f.u}>
                <a href={f.u} target="_blank" rel="noreferrer">
                  {f.t}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="card stack" style={{ gap: 8 }}>
          <h2>O que a empresa precisa ter</h2>
          <ul className="nr1-ul">
            <li>
              <b>Inventário de riscos</b> com os fatores psicossociais (perigo, grupo exposto, fontes, avaliação, medidas existentes) — datado e assinado.
            </li>
            <li>
              <b>Plano de ação</b> com medidas, responsáveis, cronograma e forma de medir o resultado.
            </li>
            <li>
              <b>Participação dos trabalhadores</b> na identificação e nas medidas (pesquisa, conversas, CIPA).
            </li>
            <li>
              <b>Revisão</b> a cada 2 anos ou quando algo mudar.
            </li>
            <li>
              <b>Lei 14.457/2022</b>: regras de conduta sobre assédio, canal de denúncia com apuração, treinamento ao menos anual e tema na CIPA.
            </li>
            <li>
              <b>Lei 14.831/2024</b>: certificado voluntário “Empresa Promotora da Saúde Mental” (regulamentação a confirmar).
            </li>
          </ul>
          <span className="small muted">Papel do gestor: executar as medidas do plano na área, manter rituais (1:1, check-ins), observar sinais e encaminhar, sem diagnosticar nem registrar dados clínicos.</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="grow">Os 13 fatores de risco psicossocial (Guia do MTE)</h2>
        </div>
        <div className="grid g3">
          {FATORES_PSICO.map((f, i) => (
            <div key={f.nome} className="stack small" style={{ gap: 3 }}>
              <b>
                {i + 1}. {f.nome}
              </b>
              <span>{f.descricao}</span>
              <span className="muted">Na Controladoria: {f.exemplo}</span>
            </div>
          ))}
        </div>
        <span className="small muted">O item 12 aparece com redações diferentes nas fontes consultadas; confirme no Guia oficial do MTE.</span>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card stack" style={{ gap: 8 }}>
          <h2>Sinais de alerta (esgotamento / burnout)</h2>
          <ul className="nr1-ul">
            {INDICADORES_ALERTA.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <span className="small muted">Burnout é fenômeno ocupacional na CID-11 (QD85). Quem diagnostica é o médico — o gestor observa e encaminha.</span>
        </div>
        <div className="card stack" style={{ gap: 8 }}>
          <h2>Como agir (primeiros socorros psicológicos)</h2>
          <ol className="nr1-ul">
            <li>
              <b>Observar</b>: mudanças de comportamento, carga, horários.
            </li>
            <li>
              <b>Conversar em particular</b>, com escuta e sem julgamento ou diagnóstico (“notei que…, como você está?”).
            </li>
            <li>
              <b>Ajustar o que é do trabalho</b>: carga, prazos, prioridades, folga compensatória.
            </li>
            <li>
              <b>Encaminhar</b>: EAP/apoio psicológico, saúde ocupacional, RH; assédio → canal de denúncia.
            </li>
            <li>
              <b>Acompanhar</b>: marcar o próximo check-in. Registrar só fatos e ações.
            </li>
            <li>
              <b>Risco imediato</b>: não deixe a pessoa sozinha; CVV 188 (24h) ou SAMU 192.
            </li>
          </ol>
        </div>
      </div>

      <div className="card stack" style={{ gap: 6 }}>
        <h2>Campanhas do ano</h2>
        <div className="row" style={{ gap: 8 }}>
          {CAMPANHAS.map((c) => (
            <Chip key={c.nome} t="info">{`${c.nome} — ${c.tema}`}</Chip>
          ))}
        </div>
      </div>
    </>
  )
}
