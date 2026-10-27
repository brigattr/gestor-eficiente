import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { confirmar } from '../components/Dialogs'
import { Icon } from '../components/Icon'
import { PageHead, Seg, useLocalState } from '../components/ui'
import { get, list, remove, uid, upsert, useDB, type Item } from '../data/store'
import { fmtDate, label } from '../lib/format'

// Fluxogramas de processo: formas ligadas por setas; cada quadro guarda a descrição da etapa.
// Tudo fica no próprio registro (coleção "fluxogramas"): nos[] e ligacoes[].

type Tipo = 'inicio' | 'etapa' | 'decisao' | 'documento' | 'sistema' | 'fim'
export type No = {
  id: string
  tipo: Tipo
  x: number
  y: number
  w: number
  h: number
  texto: string
  resp?: string
  entrada?: string
  saida?: string
  sistema?: string
  prazo?: string
  detalhes?: string
}
export type Lig = { id: string; de: string; para: string; rotulo?: string }

const TIPOS: { t: Tipo; nome: string; w: number; h: number; cor: string; borda: string }[] = [
  { t: 'inicio', nome: 'Início', w: 140, h: 52, cor: '#dcfce7', borda: '#16a34a' },
  { t: 'etapa', nome: 'Etapa', w: 180, h: 74, cor: '#dbeafe', borda: '#2563eb' },
  { t: 'decisao', nome: 'Decisão', w: 170, h: 110, cor: '#fef9c3', borda: '#ca8a04' },
  { t: 'documento', nome: 'Documento', w: 170, h: 74, cor: '#f3e8ff', borda: '#9333ea' },
  { t: 'sistema', nome: 'Sistema / dados', w: 160, h: 78, cor: '#e0f2fe', borda: '#0891b2' },
  { t: 'fim', nome: 'Fim', w: 140, h: 52, cor: '#fee2e2', borda: '#dc2626' },
]
const T = (t: Tipo) => TIPOS.find((x) => x.t === t) ?? TIPOS[1]
const LARG = 2400
const ALT = 1600
const GRADE = 10
const encaixe = (v: number) => Math.round(v / GRADE) * GRADE

const CAMPOS: { k: keyof No; l: string; area?: boolean; ph?: string }[] = [
  { k: 'resp', l: 'Quem faz', ph: 'Pessoa, cargo ou área' },
  { k: 'entrada', l: 'Entrada (o que chega)', ph: 'Ex.: nota fiscal, solicitação' },
  { k: 'saida', l: 'Saída (o que entrega)', ph: 'Ex.: pagamento aprovado' },
  { k: 'sistema', l: 'Sistema / ferramenta', ph: 'Ex.: SAP, Excel, e-mail' },
  { k: 'prazo', l: 'Prazo / SLA', ph: 'Ex.: até D+2' },
  { k: 'detalhes', l: 'Como fazer (descrição detalhada)', area: true, ph: 'Passo a passo, regras, alçadas, cuidados…' },
]

/** Ponto na borda da forma, na direção de (dx, dy) a partir do centro. */
function borda(n: No, dx: number, dy: number) {
  const hw = n.w / 2,
    hh = n.h / 2
  if (!dx && !dy) return { x: n.x + hw, y: n.y + hh }
  const t = n.tipo === 'decisao' ? 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh) : 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh)
  return { x: n.x + hw + dx * t, y: n.y + hh + dy * t }
}

function Forma({ n, sel }: { n: No; sel: boolean }) {
  const c = T(n.tipo)
  const sw = sel ? 3 : 1.6
  const st = { fill: c.cor, stroke: sel ? '#f59e0b' : c.borda, strokeWidth: sw }
  const { x, y, w, h } = n
  switch (n.tipo) {
    case 'inicio':
    case 'fim':
      return <rect x={x} y={y} width={w} height={h} rx={h / 2} {...st} />
    case 'decisao':
      return <polygon points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`} {...st} />
    case 'documento':
      return <path d={`M${x},${y} H${x + w} V${y + h - 10} Q${x + (w * 3) / 4},${y + h - 22} ${x + w / 2},${y + h - 10} T${x},${y + h - 10} Z`} {...st} />
    case 'sistema':
      return (
        <g {...st}>
          <path d={`M${x},${y + 10} V${y + h - 10} A${w / 2},10 0 0 0 ${x + w},${y + h - 10} V${y + 10}`} />
          <ellipse cx={x + w / 2} cy={y + 10} rx={w / 2} ry={10} />
        </g>
      )
    default:
      return <rect x={x} y={y} width={w} height={h} rx={8} {...st} />
  }
}

export function Fluxogramas() {
  const db = useDB()
  const [params, setParams] = useSearchParams()
  const fluxos = (db.fluxogramas ?? []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome)))
  const [busca, setBusca] = useState('')
  const atual = get('fluxogramas', params.get('f') ?? '')
  const abrir = (id: string) => setParams(id ? { f: id } : {})

  function novo() {
    const a = uid(),
      b = uid(),
      c = uid()
    const f = upsert('fluxogramas', {
      nome: 'Novo processo',
      status: 'Rascunho',
      nos: [
        { id: a, tipo: 'inicio', x: 120, y: 60, w: 140, h: 52, texto: 'Início' },
        { id: b, tipo: 'etapa', x: 100, y: 180, w: 180, h: 74, texto: 'Primeira etapa' },
        { id: c, tipo: 'fim', x: 120, y: 330, w: 140, h: 52, texto: 'Fim' },
      ],
      ligacoes: [
        { id: uid(), de: a, para: b },
        { id: uid(), de: b, para: c },
      ],
    })
    if (f) abrir(f.id)
  }

  if (atual) return <Editor key={atual.id} f={atual} onVoltar={() => abrir('')} />

  const q = busca.trim().toLowerCase()
  const vis = fluxos.filter((f) => !q || [f.nome, f.area, f.descricao].some((x) => String(x ?? '').toLowerCase().includes(q)))
  return (
    <>
      <PageHead title="Fluxogramas de processo" desc="Desenhe o processo com etapas, decisões e documentos. Clique em cada quadro para descrever quem faz, entradas, saídas, sistema e prazo — e veja tudo também como procedimento em texto.">
        <button className="btn primary" onClick={novo}>
          <Icon name="plus" size={16} /> Novo fluxograma
        </button>
      </PageHead>
      <div className="card flush">
        <div className="row" style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <input style={{ maxWidth: 280 }} placeholder="Buscar processo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <span className="grow" />
          <span className="small muted">{vis.length} fluxograma(s)</span>
        </div>
        {vis.length === 0 ? (
          <div className="empty">Nenhum fluxograma ainda. Use “Novo fluxograma” para começar.</div>
        ) : (
          <div className="fx-lista">
            {vis.map((f) => (
              <button key={f.id} className="fx-cartao" onClick={() => abrir(f.id)}>
                <Miniatura f={f} />
                <b>{String(f.nome)}</b>
                <span className="small muted">
                  {[f.area, f.responsavel ? label('pessoas', get('pessoas', String(f.responsavel))) : null, f.status].filter(Boolean).join(' · ')}
                </span>
                <span className="small muted">
                  {((f.nos as No[]) ?? []).length} quadro(s){f._updated ? ` · editado ${fmtDate(String(f._updated).slice(0, 10))}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function Miniatura({ f }: { f: Item }) {
  const nos = (f.nos as No[]) ?? []
  const ligs = (f.ligacoes as Lig[]) ?? []
  if (!nos.length) return <div className="fx-mini" />
  const x0 = Math.min(...nos.map((n) => n.x)) - 20,
    y0 = Math.min(...nos.map((n) => n.y)) - 20
  const x1 = Math.max(...nos.map((n) => n.x + n.w)) + 20,
    y1 = Math.max(...nos.map((n) => n.y + n.h)) + 20
  const porId = new Map(nos.map((n) => [n.id, n]))
  return (
    <svg className="fx-mini" viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} preserveAspectRatio="xMidYMid meet">
      {ligs.map((l) => {
        const a = porId.get(l.de),
          b = porId.get(l.para)
        if (!a || !b) return null
        return <line key={l.id} x1={a.x + a.w / 2} y1={a.y + a.h / 2} x2={b.x + b.w / 2} y2={b.y + b.h / 2} stroke="#94a3b8" strokeWidth={3} />
      })}
      {nos.map((n) => (
        <Forma key={n.id} n={n} sel={false} />
      ))}
    </svg>
  )
}

type Sel = { tipo: 'no' | 'lig'; id: string } | null

function Editor({ f, onVoltar }: { f: Item; onVoltar: () => void }) {
  const [nos, setNosRaw] = useState<No[]>(() => (Array.isArray(f.nos) ? (f.nos as No[]) : []))
  const [ligs, setLigsRaw] = useState<Lig[]>(() => (Array.isArray(f.ligacoes) ? (f.ligacoes as Lig[]) : []))
  const [sel, setSel] = useState<Sel>(null)
  const [zoom, setZoom] = useLocalState('fx:zoom', 1)
  const [visao, setVisao] = useLocalState<'desenho' | 'texto'>('fx:visao', 'desenho')
  const [ligando, setLigando] = useState<string | null>(null) // modo "ligar": origem escolhida
  const [modoLigar, setModoLigar] = useState(false)
  const [temp, setTemp] = useState<{ de: string; x: number; y: number } | null>(null)
  const [estado, setEstado] = useState('')
  const svg = useRef<SVGSVGElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const arraste = useRef<{ id: string; dx: number; dy: number; moveu: boolean } | null>(null)
  const historico = useRef<{ nos: No[]; ligs: Lig[] }[]>([])
  const timer = useRef<number | undefined>(undefined)
  const pendente = useRef<{ nos: No[]; ligs: Lig[] } | null>(null)

  // grava com atraso (e ao sair)
  function gravar() {
    window.clearTimeout(timer.current)
    if (!pendente.current) return
    upsert('fluxogramas', { id: f.id, nos: pendente.current.nos, ligacoes: pendente.current.ligs })
    pendente.current = null
    setEstado('Salvo')
  }
  function mudou(n: No[], l: Lig[]) {
    pendente.current = { nos: n, ligs: l }
    setEstado('Salvando…')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(gravar, 700)
  }
  useEffect(() => () => gravar(), []) // eslint-disable-line react-hooks/exhaustive-deps

  function guardarHistorico() {
    historico.current.push({ nos, ligs })
    if (historico.current.length > 60) historico.current.shift()
  }
  function aplicar(n: No[], l: Lig[], hist = true) {
    if (hist) guardarHistorico()
    setNosRaw(n)
    setLigsRaw(l)
    mudou(n, l)
  }
  function desfazer() {
    const ant = historico.current.pop()
    if (!ant) return
    setNosRaw(ant.nos)
    setLigsRaw(ant.ligs)
    mudou(ant.nos, ant.ligs)
    setSel(null)
  }

  const porId = useMemo(() => new Map(nos.map((n) => [n.id, n])), [nos])
  const noSel = sel?.tipo === 'no' ? porId.get(sel.id) : undefined
  const ligSel = sel?.tipo === 'lig' ? ligs.find((l) => l.id === sel.id) : undefined

  function pontoSvg(e: { clientX: number; clientY: number }) {
    const s = svg.current!
    const p = s.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    const r = p.matrixTransform(s.getScreenCTM()!.inverse())
    return { x: r.x, y: r.y }
  }

  function adicionar(tipo: Tipo) {
    const c = T(tipo)
    let x: number, y: number
    const origem = noSel
    if (origem) {
      // novo quadro logo abaixo do selecionado, já ligado a ele
      x = encaixe(origem.x + origem.w / 2 - c.w / 2)
      y = encaixe(origem.y + origem.h + 60)
      while (nos.some((n) => Math.abs(n.x - x) < 60 && Math.abs(n.y - y) < 40)) x += 220
    } else {
      const a = area.current
      x = encaixe(((a?.scrollLeft ?? 0) + (a?.clientWidth ?? 600) / 2) / zoom - c.w / 2)
      y = encaixe(((a?.scrollTop ?? 0) + 80) / zoom)
    }
    const n: No = { id: uid(), tipo, x, y, w: c.w, h: c.h, texto: tipo === 'decisao' ? 'Está ok?' : c.nome }
    const l = origem ? [...ligs, { id: uid(), de: origem.id, para: n.id, rotulo: origem.tipo === 'decisao' ? 'Sim' : undefined }] : ligs
    aplicar([...nos, n], l)
    setSel({ tipo: 'no', id: n.id })
  }

  function ligar(de: string, para: string) {
    if (de === para || ligs.some((l) => l.de === de && l.para === para)) return
    const origem = porId.get(de)
    const jaSaem = ligs.filter((l) => l.de === de).length
    const rotulo = origem?.tipo === 'decisao' ? (jaSaem === 0 ? 'Sim' : 'Não') : undefined
    const nova = { id: uid(), de, para, rotulo }
    aplicar(nos, [...ligs, nova])
    setSel({ tipo: 'lig', id: nova.id })
  }

  function excluirSel() {
    if (!sel) return
    if (sel.tipo === 'no') aplicar(nos.filter((n) => n.id !== sel.id), ligs.filter((l) => l.de !== sel.id && l.para !== sel.id))
    else aplicar(nos, ligs.filter((l) => l.id !== sel.id))
    setSel(null)
  }

  function editarNo(campos: Partial<No>) {
    if (!noSel) return
    const n = nos.map((x) => (x.id === noSel.id ? { ...x, ...campos } : x))
    setNosRaw(n)
    mudou(n, ligs)
  }
  function trocarTipo(tipo: Tipo) {
    if (!noSel) return
    const c = T(tipo)
    aplicar(
      nos.map((x) => (x.id === noSel.id ? { ...x, tipo, w: c.w, h: c.h } : x)),
      ligs,
    )
  }

  // teclado: Delete apaga o selecionado; Ctrl+Z desfaz
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      if (alvo.closest('input, textarea, select, [contenteditable]')) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        excluirSel()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        desfazer()
      }
      if (e.key === 'Escape') (setSel(null), setLigando(null), setModoLigar(false))
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  // ── ponteiro (mouse, dedo ou caneta)
  function noDown(e: React.PointerEvent, n: No) {
    e.stopPropagation()
    if (modoLigar) {
      if (!ligando) setLigando(n.id)
      else {
        ligar(ligando, n.id)
        setLigando(null)
      }
      return
    }
    setSel({ tipo: 'no', id: n.id })
    const p = pontoSvg(e)
    arraste.current = { id: n.id, dx: p.x - n.x, dy: p.y - n.y, moveu: false }
    guardarHistorico()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  function alcaDown(e: React.PointerEvent, n: No) {
    e.stopPropagation()
    const p = pontoSvg(e)
    setTemp({ de: n.id, x: p.x, y: p.y })
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  function move(e: React.PointerEvent) {
    if (temp) {
      const p = pontoSvg(e)
      setTemp({ ...temp, x: p.x, y: p.y })
      return
    }
    const a = arraste.current
    if (!a) return
    const p = pontoSvg(e)
    const x = Math.max(0, Math.min(LARG - 40, encaixe(p.x - a.dx))),
      y = Math.max(0, Math.min(ALT - 40, encaixe(p.y - a.dy)))
    const n = porId.get(a.id)
    if (!n || (n.x === x && n.y === y)) return
    a.moveu = true
    setNosRaw((ns) => ns.map((q) => (q.id === a.id ? { ...q, x, y } : q)))
  }
  function up(e: React.PointerEvent) {
    if (temp) {
      const p = pontoSvg(e)
      const alvo = nos.find((n) => p.x >= n.x && p.x <= n.x + n.w && p.y >= n.y && p.y <= n.y + n.h && n.id !== temp.de)
      if (alvo) ligar(temp.de, alvo.id)
      setTemp(null)
      return
    }
    const a = arraste.current
    arraste.current = null
    if (!a) return
    if (a.moveu) setNosRaw((ns) => (mudou(ns, ligs), ns))
    else historico.current.pop() // só um clique: nada mudou
  }

  // ── visão em texto (procedimento), seguindo as setas a partir do início
  const passos = useMemo(() => {
    const ordem: No[] = []
    const vistos = new Set<string>()
    const inicios = nos.filter((n) => n.tipo === 'inicio')
    const fila = [...(inicios.length ? inicios : nos.slice(0, 1))]
    while (fila.length) {
      const n = fila.shift()!
      if (vistos.has(n.id)) continue
      vistos.add(n.id)
      ordem.push(n)
      for (const l of ligs.filter((x) => x.de === n.id)) {
        const p = porId.get(l.para)
        if (p && !vistos.has(p.id)) fila.push(p)
      }
    }
    for (const n of nos) if (!vistos.has(n.id)) ordem.push(n) // quadros soltos no fim
    return ordem
  }, [nos, ligs, porId])
  const numero = new Map(passos.map((n, i) => [n.id, i + 1]))

  async function excluirFluxo() {
    if (!(await confirmar(`Excluir o fluxograma "${f.nome}"? Não dá para desfazer.`, { ok: 'Excluir', danger: true }))) return
    pendente.current = null
    remove('fluxogramas', f.id)
    onVoltar()
  }

  const centro = (n: No) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 })

  return (
    <div className="fx">
      <div className="fx-topo">
        <button className="btn sm" onClick={() => (gravar(), onVoltar())}>
          ← Fluxogramas
        </button>
        <input className="fx-nome" value={String(f.nome ?? '')} onChange={(e) => upsert('fluxogramas', { id: f.id, nome: e.target.value })} aria-label="Nome do processo" />
        <span className="small muted">{estado}</span>
        <span className="grow" />
        <Seg
          value={visao}
          onChange={setVisao}
          options={[
            { v: 'desenho', l: 'Desenho' },
            { v: 'texto', l: 'Procedimento (texto)' },
          ]}
        />
      </div>

      {visao === 'desenho' ? (
        <div className="fx-corpo">
          <div className="fx-quadro">
            <div className="fx-barra">
              {TIPOS.map((c) => (
                <button key={c.t} className="fx-add" onClick={() => adicionar(c.t)} title={noSel ? `Adicionar ${c.nome} ligado ao quadro selecionado` : `Adicionar ${c.nome}`}>
                  <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden>
                    <Forma n={{ id: '', tipo: c.t, x: 2, y: 2, w: 22, h: 14, texto: '' }} sel={false} />
                  </svg>
                  {c.nome}
                </button>
              ))}
              <span className="nb-sep" />
              <button className={`btn sm ${modoLigar ? 'primary' : ''}`} onClick={() => (setModoLigar(!modoLigar), setLigando(null))} title="Toque no quadro de origem e depois no de destino (ou arraste a bolinha azul de um quadro até outro)">
                ↗ Ligar
              </button>
              <button className="btn sm" onClick={desfazer} disabled={!historico.current.length} title="Desfazer (Ctrl+Z)">
                ↶
              </button>
              <button className="btn sm danger" onClick={excluirSel} disabled={!sel} title="Excluir o selecionado (Delete)">
                <Icon name="trash" size={14} />
              </button>
              <span className="grow" />
              <button className="btn sm" onClick={() => setZoom(Math.max(0.4, +(zoom - 0.1).toFixed(1)))} title="Diminuir">
                −
              </button>
              <span className="small muted">{Math.round(zoom * 100)}%</span>
              <button className="btn sm" onClick={() => setZoom(Math.min(1.6, +(zoom + 0.1).toFixed(1)))} title="Aumentar">
                +
              </button>
            </div>
            {modoLigar && <div className="fx-dica">{ligando ? 'Agora toque no quadro de destino.' : 'Toque no quadro de origem da seta.'}</div>}
            <div className="fx-area" ref={area}>
              <svg
                ref={svg}
                className={`fx-svg ${modoLigar ? 'ligando' : ''}`}
                width={LARG * zoom}
                height={ALT * zoom}
                viewBox={`0 0 ${LARG} ${ALT}`}
                onPointerDown={() => (setSel(null), setLigando(null))}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
              >
                <defs>
                  <marker id="fx-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="#475569" />
                  </marker>
                  <marker id="fx-seta-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="#f59e0b" />
                  </marker>
                </defs>
                {ligs.map((l) => {
                  const a = porId.get(l.de),
                    b = porId.get(l.para)
                  if (!a || !b) return null
                  const ca = centro(a),
                    cb = centro(b)
                  const p1 = borda(a, cb.x - ca.x, cb.y - ca.y)
                  const p2 = borda(b, ca.x - cb.x, ca.y - cb.y)
                  const on = sel?.tipo === 'lig' && sel.id === l.id
                  const mx = (p1.x + p2.x) / 2,
                    my = (p1.y + p2.y) / 2
                  return (
                    <g key={l.id} onPointerDown={(e) => (e.stopPropagation(), setSel({ tipo: 'lig', id: l.id }))} style={{ cursor: 'pointer' }}>
                      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={16} />
                      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={on ? '#f59e0b' : '#475569'} strokeWidth={on ? 3 : 2} markerEnd={`url(#${on ? 'fx-seta-sel' : 'fx-seta'})`} />
                      {l.rotulo && (
                        <g>
                          <rect x={mx - l.rotulo.length * 4 - 8} y={my - 11} width={l.rotulo.length * 8 + 16} height={22} rx={11} fill="#fff" stroke={on ? '#f59e0b' : '#cbd5e1'} />
                          <text x={mx} y={my + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill="#334155">
                            {l.rotulo}
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}
                {temp &&
                  (() => {
                    const a = porId.get(temp.de)
                    if (!a) return null
                    const c = centro(a)
                    return <line x1={c.x} y1={c.y} x2={temp.x} y2={temp.y} stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" markerEnd="url(#fx-seta)" />
                  })()}
                {nos.map((n) => {
                  const on = (sel?.tipo === 'no' && sel.id === n.id) || ligando === n.id
                  const desc = !!(n.resp || n.entrada || n.saida || n.sistema || n.prazo || n.detalhes)
                  const pad = n.tipo === 'decisao' ? n.w * 0.2 : 8
                  return (
                    <g key={n.id} className="fx-no" onPointerDown={(e) => noDown(e, n)} onDoubleClick={() => document.getElementById('fx-texto')?.focus()}>
                      <Forma n={n} sel={on} />
                      <foreignObject x={n.x + pad} y={n.y + (n.tipo === 'documento' ? 2 : 4)} width={n.w - pad * 2} height={n.h - (n.tipo === 'documento' ? 16 : 8)}>
                        <div className="fx-rotulo">
                          {numero.get(n.id) && n.tipo !== 'inicio' && n.tipo !== 'fim' ? <span className="fx-num">{numero.get(n.id)}</span> : null}
                          <span>{n.texto || '…'}</span>
                        </div>
                      </foreignObject>
                      {desc && (
                        <circle cx={n.x + n.w - 6} cy={n.y + 6} r={5} fill="#16a34a">
                          <title>Etapa descrita</title>
                        </circle>
                      )}
                      {on && !modoLigar && (
                        <circle className="fx-alca" cx={n.x + n.w / 2} cy={n.y + n.h + 12} r={8} onPointerDown={(e) => alcaDown(e, n)}>
                          <title>Arraste até outro quadro para ligar</title>
                        </circle>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>

          <aside className="fx-painel card">
            {noSel ? (
              <div className="stack" style={{ gap: 10 }}>
                <div className="row">
                  <b className="grow">Quadro {numero.get(noSel.id) ?? ''}</b>
                  <select value={noSel.tipo} onChange={(e) => trocarTipo(e.target.value as Tipo)} style={{ width: 'auto' }}>
                    {TIPOS.map((c) => (
                      <option key={c.t} value={c.t}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="field">
                  <span>Texto do quadro</span>
                  <textarea id="fx-texto" rows={2} value={noSel.texto} onChange={(e) => editarNo({ texto: e.target.value })} placeholder="Ex.: Conferir a nota fiscal" />
                </label>
                {CAMPOS.map((c) => (
                  <label key={c.k} className="field">
                    <span>{c.l}</span>
                    {c.area ? (
                      <textarea rows={5} value={String(noSel[c.k] ?? '')} placeholder={c.ph} onChange={(e) => editarNo({ [c.k]: e.target.value })} />
                    ) : (
                      <input value={String(noSel[c.k] ?? '')} placeholder={c.ph} onChange={(e) => editarNo({ [c.k]: e.target.value })} />
                    )}
                  </label>
                ))}
                <span className="small muted">Dica: com este quadro selecionado, os botões de forma acima criam o próximo passo já ligado a ele.</span>
              </div>
            ) : ligSel ? (
              <div className="stack" style={{ gap: 10 }}>
                <b>Seta</b>
                <span className="small muted">
                  De “{porId.get(ligSel.de)?.texto}” para “{porId.get(ligSel.para)?.texto}”
                </span>
                <label className="field">
                  <span>Texto na seta</span>
                  <input
                    value={ligSel.rotulo ?? ''}
                    placeholder="Ex.: Sim, Não, Aprovado…"
                    onChange={(e) => {
                      const l = ligs.map((x) => (x.id === ligSel.id ? { ...x, rotulo: e.target.value || undefined } : x))
                      setLigsRaw(l)
                      mudou(nos, l)
                    }}
                  />
                </label>
                <div className="row" style={{ gap: 6 }}>
                  {['Sim', 'Não', 'Aprovado', 'Reprovado'].map((r) => (
                    <button key={r} className="btn sm" onClick={() => aplicar(nos, ligs.map((x) => (x.id === ligSel.id ? { ...x, rotulo: r } : x)))}>
                      {r}
                    </button>
                  ))}
                </div>
                <button className="btn sm" onClick={() => aplicar(nos, ligs.map((x) => (x.id === ligSel.id ? { ...x, de: x.para, para: x.de } : x)))}>
                  ⇄ Inverter sentido
                </button>
              </div>
            ) : (
              <DadosFluxo f={f} onExcluir={() => void excluirFluxo()} />
            )}
          </aside>
        </div>
      ) : (
        <div className="card fx-texto-proc">
          <h2>{String(f.nome)}</h2>
          {f.descricao ? <p className="pre">{String(f.descricao)}</p> : null}
          <p className="small muted">
            {[f.area && `Área: ${f.area}`, f.responsavel && `Dono: ${label('pessoas', get('pessoas', String(f.responsavel)))}`, f.status && `Status: ${f.status}`].filter(Boolean).join(' · ')}
          </p>
          <ol className="fx-passos" style={{ listStyle: 'none', paddingLeft: 0 }}>
            {passos.map((n) => {
              const saidas = ligs.filter((l) => l.de === n.id)
              return (
                <li key={n.id}>
                  <b>
                    <span className="fx-num">{numero.get(n.id)}</span> {n.texto || '(sem texto)'} <span className="small muted">— {T(n.tipo).nome}</span>
                  </b>
                  <div className="small fx-meta">
                    {n.resp && <span>Quem faz: {n.resp}</span>}
                    {n.entrada && <span>Entrada: {n.entrada}</span>}
                    {n.saida && <span>Saída: {n.saida}</span>}
                    {n.sistema && <span>Sistema: {n.sistema}</span>}
                    {n.prazo && <span>Prazo: {n.prazo}</span>}
                  </div>
                  {n.detalhes && <div className="pre small">{n.detalhes}</div>}
                  {saidas.length > 0 && n.tipo !== 'fim' && (
                    <div className="small muted">
                      {saidas
                        .map((l) => {
                          const p = porId.get(l.para)
                          return `${l.rotulo ? l.rotulo + ' → ' : '→ '}passo ${numero.get(l.para) ?? '?'} (${p?.texto ?? ''})`
                        })
                        .join(' · ')}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          <div className="row">
            <button className="btn sm" onClick={() => window.print()}>
              Imprimir / salvar em PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DadosFluxo({ f, onExcluir }: { f: Item; onExcluir: () => void }) {
  const pessoas = list('pessoas').filter((p) => p.status !== 'Desligado')
  const set = (k: string, v: unknown) => upsert('fluxogramas', { id: f.id, [k]: v })
  return (
    <div className="stack" style={{ gap: 10 }}>
      <b>Dados do processo</b>
      <span className="small muted">Clique em um quadro para descrever a etapa, ou numa seta para escrever “Sim/Não”.</span>
      <label className="field">
        <span>Área</span>
        <input value={String(f.area ?? '')} onChange={(e) => set('area', e.target.value)} />
      </label>
      <label className="field">
        <span>Dono do processo</span>
        <select value={String(f.responsavel ?? '')} onChange={(e) => set('responsavel', e.target.value || null)}>
          <option value="">—</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {String(p.nome)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Status</span>
        <select value={String(f.status ?? 'Rascunho')} onChange={(e) => set('status', e.target.value)}>
          {['Rascunho', 'Em uso', 'Em revisão', 'Obsoleto'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Próxima revisão</span>
        <input type="date" value={String(f.revisao ?? '')} onChange={(e) => set('revisao', e.target.value || null)} />
      </label>
      <label className="field">
        <span>Objetivo / escopo</span>
        <textarea rows={4} value={String(f.descricao ?? '')} onChange={(e) => set('descricao', e.target.value)} />
      </label>
      <button className="btn sm danger" onClick={onExcluir}>
        <Icon name="trash" size={14} /> Excluir fluxograma
      </button>
    </div>
  )
}
