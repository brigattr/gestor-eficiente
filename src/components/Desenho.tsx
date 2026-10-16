import { useEffect, useRef, useState } from 'react'
import { confirmar } from './Dialogs'
import { Icon } from './Icon'
import { upsert, remove, type Item } from '../data/store'

// Área de desenho à mão (Apple Pencil, caneta de Surface, mouse ou dedo).
// Os traços ficam em vetores (coleção "desenhos"), então o desenho sai nítido em qualquer tela.
// Formato do traço: { c: cor, w: espessura, t: 'p' caneta | 'm' marca-texto, p: [x, y, pressão×100, ...] }

export type Traco = { c: string; w: number; t: 'p' | 'm'; p: number[] }
const LARGURA = 1000 // coordenadas lógicas; a tela escala para o tamanho disponível
const CORES = ['#1f2937', '#1d4ed8', '#c0392b', '#15803d', '#7c3aed', '#ea580c']
const CORES_MT = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4']
const ESPESSURAS = [1.6, 3, 5.5]
const MAX_TRACOS_BYTES = 750_000

type Ferramenta = 'caneta' | 'marca' | 'borracha'

function desenharTraco(ctx: CanvasRenderingContext2D, t: Traco, k: number) {
  const p = t.p
  if (p.length < 3) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = t.c
  if (t.t === 'm') {
    // marca-texto: largo, translúcido e sem variação de pressão
    ctx.globalAlpha = 0.38
    ctx.globalCompositeOperation = 'multiply'
    ctx.lineWidth = t.w * k
    ctx.beginPath()
    ctx.moveTo(p[0] * k, p[1] * k)
    for (let i = 3; i < p.length; i += 3) ctx.lineTo(p[i] * k, p[i + 1] * k)
    if (p.length === 3) ctx.lineTo(p[0] * k + 0.1, p[1] * k)
    ctx.stroke()
    ctx.restore()
    return
  }
  // caneta: cada segmento com a espessura da pressão naquele ponto, suavizado por curvas
  const largura = (pr: number) => Math.max(0.6, t.w * (0.35 + 1.1 * (pr / 100))) * k
  if (p.length === 3) {
    ctx.fillStyle = t.c
    ctx.beginPath()
    ctx.arc(p[0] * k, p[1] * k, largura(p[2]) / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }
  let mx = p[0],
    my = p[1]
  for (let i = 3; i < p.length; i += 3) {
    const x = p[i],
      y = p[i + 1]
    const nx = (x + p[i - 3]) / 2,
      ny = (y + p[i - 2]) / 2
    ctx.lineWidth = largura((p[i + 2] + p[i - 1]) / 2)
    ctx.beginPath()
    ctx.moveTo(mx * k, my * k)
    ctx.quadraticCurveTo(p[i - 3] * k, p[i - 2] * k, nx * k, ny * k)
    ctx.stroke()
    mx = nx
    my = ny
  }
  ctx.lineWidth = largura(p[p.length - 1])
  ctx.beginPath()
  ctx.moveTo(mx * k, my * k)
  ctx.lineTo(p[p.length - 3] * k, p[p.length - 2] * k)
  ctx.stroke()
  ctx.restore()
}

/** Distância de um ponto ao traço (para a borracha). */
function tocaTraco(t: Traco, x: number, y: number, raio: number) {
  const r2 = (raio + t.w / 2) ** 2
  for (let i = 0; i < t.p.length; i += 3) {
    const dx = t.p[i] - x,
      dy = t.p[i + 1] - y
    if (dx * dx + dy * dy <= r2) return true
    if (i + 3 < t.p.length) {
      // meio do segmento, para traços rápidos com pontos espaçados
      const mx = (t.p[i] + t.p[i + 3]) / 2 - x,
        my = (t.p[i + 1] + t.p[i + 4]) / 2 - y
      if (mx * mx + my * my <= r2) return true
    }
  }
  return false
}

export function Desenho({ d, podeSubir, podeDescer, onMover }: { d: Item; podeSubir: boolean; podeDescer: boolean; onMover: (dir: -1 | 1) => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const tracos = useRef<Traco[]>(Array.isArray(d.tracos) ? (d.tracos as Traco[]) : [])
  const desfeitos = useRef<Traco[][]>([])
  const atual = useRef<Traco | null>(null)
  const ponteiro = useRef<number | null>(null)
  const viuCaneta = useRef(false)
  const sujo = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const [altura, setAltura] = useState(Number(d.altura) || 420)
  const [ferr, setFerr] = useState<Ferramenta>('caneta')
  const [cor, setCor] = useState(CORES[0])
  const [corMT, setCorMT] = useState(CORES_MT[0])
  const [esp, setEsp] = useState(ESPESSURAS[1])
  const [, refazerRender] = useState(0)
  const [aviso, setAviso] = useState('')

  const escala = () => (wrap.current?.clientWidth ?? LARGURA) / LARGURA

  function redesenhar() {
    const c = cv.current
    if (!c) return
    const k = escala()
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(LARGURA * k),
      h = Math.round(altura * k)
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr
      c.height = h * dpr
      c.style.width = w + 'px'
      c.style.height = h + 'px'
    }
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    for (const t of tracos.current) desenharTraco(ctx, t, k)
    if (atual.current) desenharTraco(ctx, atual.current, k)
  }

  // redimensiona com a tela
  useEffect(() => {
    redesenhar()
    const ro = new ResizeObserver(() => redesenhar())
    if (wrap.current) ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [altura]) // eslint-disable-line react-hooks/exhaustive-deps

  // versão nova vinda de outro aparelho (se não estou desenhando)
  useEffect(() => {
    if (sujo.current || atual.current) return
    tracos.current = Array.isArray(d.tracos) ? (d.tracos as Traco[]) : []
    if (Number(d.altura) && Number(d.altura) !== altura) setAltura(Number(d.altura))
    redesenhar()
  }, [d.tracos, d.altura]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => salvar(), []) // eslint-disable-line react-hooks/exhaustive-deps

  function salvar() {
    window.clearTimeout(timer.current)
    if (!sujo.current) return
    const tam = JSON.stringify(tracos.current).length
    if (tam > MAX_TRACOS_BYTES) {
      setAviso('Desenho grande demais para salvar — crie outro desenho abaixo.')
      return
    }
    sujo.current = false
    setAviso('')
    upsert('desenhos', { id: d.id, tracos: tracos.current, altura })
  }
  function mudou() {
    sujo.current = true
    refazerRender((n) => n + 1)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(salvar, 900)
  }

  function ponto(e: PointerEvent | React.PointerEvent): [number, number, number] {
    const r = cv.current!.getBoundingClientRect()
    const k = r.width / LARGURA
    // mouse não tem pressão real (0.5 fixo); caneta varia de 0 a 1
    const pr = e.pointerType === 'mouse' ? 0.5 : e.pressure || 0.5
    return [Math.round(((e.clientX - r.left) / k) * 10) / 10, Math.round(((e.clientY - r.top) / k) * 10) / 10, Math.round(pr * 100)]
  }

  function apagarEm(x: number, y: number) {
    const antes = tracos.current.length
    const raio = 12
    const restantes = tracos.current.filter((t) => !tocaTraco(t, x, y, raio))
    if (restantes.length !== antes) {
      tracos.current = restantes
      redesenhar()
      mudou()
    }
  }

  function inicio(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'pen') viuCaneta.current = true
    // com caneta em uso, o dedo/palma não risca (rejeição de palma)
    if (e.pointerType === 'touch' && viuCaneta.current) return
    if (e.button > 0 && e.pointerType === 'mouse') return
    if (ponteiro.current !== null) return
    e.preventDefault()
    ponteiro.current = e.pointerId
    try {
      cv.current?.setPointerCapture(e.pointerId)
    } catch {
      /* alguns navegadores recusam a captura; o traço segue mesmo assim */
    }
    // botão da caneta de Surface / borracha da caneta
    const borracha = ferr === 'borracha' || e.button === 5 || (e.buttons & 32) !== 0
    const [x, y, pr] = ponto(e)
    if (borracha) {
      desfeitos.current.push(tracos.current)
      apagarEm(x, y)
      atual.current = null
      return
    }
    desfeitos.current.push(tracos.current)
    if (desfeitos.current.length > 50) desfeitos.current.shift()
    atual.current = ferr === 'marca' ? { c: corMT, w: 18, t: 'm', p: [x, y, pr] } : { c: cor, w: esp, t: 'p', p: [x, y, pr] }
    redesenhar()
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== ponteiro.current) return
    e.preventDefault()
    const eventos = (e.nativeEvent.getCoalescedEvents?.() ?? []).length ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent]
    for (const ev of eventos) {
      const [x, y, pr] = ponto(ev)
      if (!atual.current) {
        apagarEm(x, y)
        continue
      }
      const p = atual.current.p
      const dx = x - p[p.length - 3],
        dy = y - p[p.length - 2]
      if (dx * dx + dy * dy < 0.8) continue // ignora micro-movimentos
      p.push(x, y, pr)
    }
    if (atual.current) redesenhar()
  }
  function fim(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== ponteiro.current) return
    ponteiro.current = null
    if (atual.current) {
      tracos.current = [...tracos.current, atual.current]
      atual.current = null
      redesenhar()
      mudou()
    } else if (desfeitos.current.length && desfeitos.current[desfeitos.current.length - 1] === tracos.current) {
      desfeitos.current.pop() // borracha sem apagar nada
    }
  }

  function desfazer() {
    const ant = desfeitos.current.pop()
    if (!ant) return
    tracos.current = ant
    redesenhar()
    mudou()
  }
  async function limpar() {
    if (!tracos.current.length) return
    if (!(await confirmar('Apagar todo este desenho?', { ok: 'Apagar', danger: true }))) return
    desfeitos.current.push(tracos.current)
    tracos.current = []
    redesenhar()
    mudou()
  }
  async function excluir() {
    if (tracos.current.length && !(await confirmar('Excluir esta área de desenho?', { ok: 'Excluir', danger: true }))) return
    sujo.current = false
    remove('desenhos', d.id)
  }
  function maisAltura() {
    const h = altura + 300
    setAltura(h)
    sujo.current = true
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(salvar, 300)
  }

  return (
    <div className="ds">
      <div className="ds-barra">
        <button type="button" className={`ds-btn ${ferr === 'caneta' ? 'on' : ''}`} onClick={() => setFerr('caneta')} title="Caneta">
          ✒️
        </button>
        <button type="button" className={`ds-btn ${ferr === 'marca' ? 'on' : ''}`} onClick={() => setFerr('marca')} title="Marca-texto">
          🖍
        </button>
        <button type="button" className={`ds-btn ${ferr === 'borracha' ? 'on' : ''}`} onClick={() => setFerr('borracha')} title="Borracha (apaga o traço inteiro)">
          🧽
        </button>
        <span className="nb-sep" />
        {(ferr === 'marca' ? CORES_MT : CORES).map((c) => (
          <button
            key={c}
            type="button"
            className={`ds-cor ${(ferr === 'marca' ? corMT : cor) === c ? 'on' : ''}`}
            style={{ background: c }}
            onClick={() => {
              if (ferr === 'marca') setCorMT(c)
              else {
                setCor(c)
                if (ferr === 'borracha') setFerr('caneta')
              }
            }}
            title="Cor"
          />
        ))}
        {ferr !== 'marca' && (
          <>
            <span className="nb-sep" />
            {ESPESSURAS.map((w) => (
              <button key={w} type="button" className={`ds-btn ${esp === w ? 'on' : ''}`} onClick={() => (setEsp(w), ferr === 'borracha' && setFerr('caneta'))} title="Espessura">
                <span className="ds-esp" style={{ width: w * 2.4 + 2, height: w * 2.4 + 2 }} />
              </button>
            ))}
          </>
        )}
        <span className="nb-sep" />
        <button type="button" className="ds-btn" onClick={desfazer} title="Desfazer" disabled={!desfeitos.current.length}>
          ↶
        </button>
        <button type="button" className="ds-btn" onClick={() => void limpar()} title="Apagar tudo">
          ⌫
        </button>
        <span className="grow" />
        {aviso && <span className="small neg">{aviso}</span>}
        {podeSubir && (
          <button type="button" className="ds-btn" onClick={() => onMover(-1)} title="Mover para cima">
            ↑
          </button>
        )}
        {podeDescer && (
          <button type="button" className="ds-btn" onClick={() => onMover(1)} title="Mover para baixo">
            ↓
          </button>
        )}
        <button type="button" className="ds-btn danger" onClick={() => void excluir()} title="Excluir área de desenho">
          <Icon name="trash" size={14} />
        </button>
      </div>
      <div ref={wrap} className="ds-folha">
        <canvas
          ref={cv}
          className={`ds-canvas ${ferr === 'borracha' ? 'borracha' : ''}`}
          onPointerDown={inicio}
          onPointerMove={move}
          onPointerUp={fim}
          onPointerCancel={fim}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      <button type="button" className="nb-add ds-mais" onClick={maisAltura}>
        <Icon name="plus" size={13} /> Mais espaço para desenhar
      </button>
    </div>
  )
}
