import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Attachments } from '../components/Attachments'
import { Desenho } from '../components/Desenho'
import { confirmar } from '../components/Dialogs'
import { Icon } from '../components/Icon'
import { SeletorEtiquetas } from '../components/ItemForm'
import { TagChips } from '../components/Tags'
import { CORES_ETIQUETA } from '../data/schema'
import { get, getPref, list, remove, setPref, upsert, useDB, type Item } from '../data/store'
import { deleteFilesOf } from '../lib/files'
import { limparHtml, textoDoHtml } from '../lib/sanitize'

// Bloco de anotações no estilo OneNote: blocos › seções › páginas (com subpáginas).

const CORES = Object.keys(CORES_ETIQUETA)
const cor = (it?: Item) => CORES_ETIQUETA[String(it?.cor ?? 'Azul')] ?? CORES_ETIQUETA.Azul
const porOrdem = (a: Item, b: Item) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0) || String(a._created ?? '').localeCompare(String(b._created ?? ''))
const proxOrdem = (xs: Item[]) => xs.reduce((m, x) => Math.max(m, Number(x.ordem ?? 0)), 0) + 1
const LIMITE = 800_000

/** Apaga a página com seus desenhos e anexos. */
function apagarPagina(id: string) {
  for (const d of list('desenhos').filter((x) => x.pagina === id)) remove('desenhos', d.id)
  remove('paginas', id)
  void deleteFilesOf('paginas', id)
} // o servidor aceita até ~900 KB por registro

function fmtQuando(iso: unknown) {
  if (typeof iso !== 'string') return ''
  return new Date(iso).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Nome editável no lugar (duplo clique). */
function NomeEditavel({ valor, onSalvar, editando, setEditando }: { valor: string; onSalvar: (v: string) => void; editando: boolean; setEditando: (v: boolean) => void }) {
  const [v, setV] = useState(valor)
  useEffect(() => setV(valor), [valor, editando])
  if (!editando) return <span className="nb-nome">{valor}</span>
  const fim = () => {
    setEditando(false)
    if (v.trim() && v.trim() !== valor) onSalvar(v.trim())
  }
  return (
    <input
      autoFocus
      className="nb-input"
      value={v}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value)}
      onBlur={fim}
      onKeyDown={(e) => {
        if (e.key === 'Enter') fim()
        if (e.key === 'Escape') setEditando(false)
      }}
    />
  )
}

export function Anotacoes() {
  const db = useDB()
  const [params, setParams] = useSearchParams()
  const blocos = (db.blocos ?? []).slice().sort(porOrdem)
  const secoes = (db.secoes ?? []).slice().sort(porOrdem)
  const paginas = (db.paginas ?? []).slice().sort(porOrdem)

  const [secaoId, setSecaoIdRaw] = useState<string>(() => getPref('nb:secao', ''))
  const [paginaId, setPaginaIdRaw] = useState<string>(() => params.get('p') ?? getPref('nb:pagina', ''))
  const [abertos, setAbertos] = useState<Record<string, boolean>>(() => getPref('nb:abertos', {}))
  const [renomear, setRenomear] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [arrastando, setArrastando] = useState<string>('')

  const setSecaoId = (id: string) => (setSecaoIdRaw(id), setPref('nb:secao', id))
  const setPaginaId = (id: string) => {
    setPaginaIdRaw(id)
    setPref('nb:pagina', id)
    if (params.get('p')) setParams({}, { replace: true })
  }

  // link direto (?p=) — vindo das etiquetas, por exemplo
  useEffect(() => {
    const p = params.get('p')
    if (!p) return
    const pg = get('paginas', p)
    if (pg) {
      setPaginaIdRaw(p)
      const s = get('secoes', String(pg.secao))
      if (s) {
        setSecaoIdRaw(s.id)
        setAbertos((a) => ({ ...a, [String(s.bloco)]: true }))
      }
    }
  }, [params])

  const secao = get('secoes', secaoId) ?? secoes[0]
  const pagsSecao = secao ? paginas.filter((p) => p.secao === secao.id) : []
  const pagina = get('paginas', paginaId)
  const paginaAtual = pagina && pagina.secao === secao?.id ? pagina : pagsSecao[0]

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return null
    return paginas.filter((p) => String(p.titulo ?? '').toLowerCase().includes(q) || String(p.texto ?? '').toLowerCase().includes(q)).slice(0, 60)
  }, [busca, paginas])

  // ── ações
  function novoBloco() {
    const b = upsert('blocos', { nome: 'Novo bloco', cor: CORES[blocos.length % CORES.length], ordem: proxOrdem(blocos) })
    if (!b) return
    setAbertos((a) => ({ ...a, [b.id]: true }))
    const s = novaSecao(b.id)
    if (s) setRenomear(b.id)
  }
  function novaSecao(blocoId: string) {
    const doBloco = secoes.filter((s) => s.bloco === blocoId)
    const s = upsert('secoes', { nome: 'Nova seção', bloco: blocoId, cor: CORES[(secoes.length + 3) % CORES.length], ordem: proxOrdem(doBloco) })
    if (!s) return
    setAbertos((a) => ({ ...a, [blocoId]: true }))
    setSecaoId(s.id)
    setRenomear(s.id)
    novaPagina(s.id)
    return s
  }
  function novaPagina(sid = secao?.id, nivel = 0, depoisDe?: Item) {
    if (!sid) return
    const daSecao = paginas.filter((p) => p.secao === sid)
    // subpágina entra logo abaixo da página mãe
    const ordem = depoisDe ? Number(depoisDe.ordem ?? 0) + 0.001 : proxOrdem(daSecao)
    const p = upsert('paginas', { titulo: '', secao: sid, html: '', texto: '', ordem, nivel })
    if (p) {
      setSecaoId(sid)
      setPaginaId(p.id)
    }
  }
  async function excluirBloco(b: Item) {
    const ss = secoes.filter((s) => s.bloco === b.id)
    const ps = paginas.filter((p) => ss.some((s) => s.id === p.secao))
    if (!(await confirmar(`Excluir o bloco "${b.nome}"${ps.length ? ` com ${ss.length} seção(ões) e ${ps.length} página(s)` : ''}? Não dá para desfazer.`, { ok: 'Excluir', danger: true }))) return
    for (const p of ps) {
      apagarPagina(p.id)
    }
    for (const s of ss) remove('secoes', s.id)
    remove('blocos', b.id)
  }
  async function excluirSecao(s: Item) {
    const ps = paginas.filter((p) => p.secao === s.id)
    if (!(await confirmar(`Excluir a seção "${s.nome}"${ps.length ? ` e suas ${ps.length} página(s)` : ''}? Não dá para desfazer.`, { ok: 'Excluir', danger: true }))) return
    for (const p of ps) {
      apagarPagina(p.id)
    }
    remove('secoes', s.id)
  }
  async function excluirPagina(p: Item) {
    if (!(await confirmar(`Excluir a página "${p.titulo || 'Sem título'}"?`, { ok: 'Excluir', danger: true }))) return
    apagarPagina(p.id)
  }
  function moverPagina(id: string, alvo: { secao?: string; antesDe?: Item }) {
    const p = get('paginas', id)
    if (!p) return
    if (alvo.antesDe) {
      const lista = paginas.filter((x) => x.secao === alvo.antesDe!.secao && x.id !== id)
      const i = lista.findIndex((x) => x.id === alvo.antesDe!.id)
      const antes = i > 0 ? Number(lista[i - 1].ordem ?? 0) : Number(alvo.antesDe.ordem ?? 0) - 1
      upsert('paginas', { id, secao: alvo.antesDe.secao, ordem: (antes + Number(alvo.antesDe.ordem ?? 0)) / 2 })
    } else if (alvo.secao && alvo.secao !== p.secao) {
      upsert('paginas', { id, secao: alvo.secao, ordem: proxOrdem(paginas.filter((x) => x.secao === alvo.secao)), nivel: 0 })
      setSecaoId(alvo.secao)
      setPaginaId(id)
    }
  }

  const caminho = (p: Item) => {
    const s = get('secoes', String(p.secao))
    const b = s ? get('blocos', String(s.bloco)) : undefined
    return [b?.nome, s?.nome].filter(Boolean).join(' › ')
  }

  return (
    <div className="nb">
      {/* ── blocos e seções */}
      <aside className="nb-col nb-blocos">
        <div className="nb-head">
          <b>Blocos</b>
          <span className="grow" />
          <button className="btn ghost sm" onClick={novoBloco} title="Novo bloco de anotações">
            <Icon name="plus" size={15} />
          </button>
        </div>
        {blocos.length === 0 && (
          <div className="nb-vazio">
            Nenhum bloco ainda.
            <button className="btn sm primary" onClick={novoBloco}>
              <Icon name="plus" size={14} /> Criar meu primeiro bloco
            </button>
          </div>
        )}
        {blocos.map((b) => {
          const aberto = abertos[b.id] ?? true
          const ss = secoes.filter((s) => s.bloco === b.id)
          return (
            <div key={b.id} className="nb-bloco">
              <div
                className="nb-bloco-nome"
                onClick={() => {
                  const n = { ...abertos, [b.id]: !aberto }
                  setAbertos(n)
                  setPref('nb:abertos', n)
                }}
                onDoubleClick={() => setRenomear(b.id)}
              >
                <span className="nb-livro" style={{ background: cor(b) }}>
                  <Icon name="book" size={13} />
                </span>
                <NomeEditavel valor={String(b.nome ?? '')} editando={renomear === b.id} setEditando={(v) => setRenomear(v ? b.id : '')} onSalvar={(nome) => upsert('blocos', { id: b.id, nome })} />
                <span className="grow" />
                <span className="nb-acoes">
                  <select className="nb-cor" style={{ background: cor(b) }} value={String(b.cor ?? 'Azul')} onClick={(e) => e.stopPropagation()} onChange={(e) => upsert('blocos', { id: b.id, cor: e.target.value })} title="Cor do bloco">
                    {CORES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <button className="btn ghost sm" title="Renomear" onClick={(e) => (e.stopPropagation(), setRenomear(b.id))}>
                    <Icon name="edit" size={13} />
                  </button>
                  <button className="btn ghost sm danger" title="Excluir bloco" onClick={(e) => (e.stopPropagation(), void excluirBloco(b))}>
                    <Icon name="trash" size={13} />
                  </button>
                </span>
              </div>
              {aberto && (
                <div className="nb-secoes">
                  {ss.map((s) => (
                    <div
                      key={s.id}
                      className={`nb-secao ${secao?.id === s.id ? 'on' : ''} ${arrastando ? 'alvo' : ''}`}
                      style={{ ['--sec' as string]: cor(s) }}
                      onClick={() => {
                        setSecaoId(s.id)
                        setBusca('')
                      }}
                      onDoubleClick={() => setRenomear(s.id)}
                      onDragOver={(e) => arrastando && e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (arrastando) moverPagina(arrastando, { secao: s.id })
                        setArrastando('')
                      }}
                    >
                      <NomeEditavel valor={String(s.nome ?? '')} editando={renomear === s.id} setEditando={(v) => setRenomear(v ? s.id : '')} onSalvar={(nome) => upsert('secoes', { id: s.id, nome })} />
                      <span className="grow" />
                      <span className="nb-n">{paginas.filter((p) => p.secao === s.id).length}</span>
                      <span className="nb-acoes">
                        <select className="nb-cor" style={{ background: cor(s) }} value={String(s.cor ?? 'Azul')} onClick={(e) => e.stopPropagation()} onChange={(e) => upsert('secoes', { id: s.id, cor: e.target.value })} title="Cor da seção">
                          {CORES.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                        <button className="btn ghost sm danger" title="Excluir seção" onClick={(e) => (e.stopPropagation(), void excluirSecao(s))}>
                          <Icon name="trash" size={13} />
                        </button>
                      </span>
                    </div>
                  ))}
                  <button className="nb-add" onClick={() => novaSecao(b.id)}>
                    <Icon name="plus" size={13} /> Seção
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </aside>

      {/* ── páginas */}
      <aside className="nb-col nb-paginas" style={{ ['--sec' as string]: cor(secao) }}>
        <div className="nb-head">
          <input className="nb-busca" placeholder="Buscar em todas as anotações…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {resultados ? (
          <>
            <div className="small muted nb-sub">{resultados.length ? `${resultados.length} página(s) encontrada(s)` : 'Nada encontrado.'}</div>
            {resultados.map((p) => (
              <div
                key={p.id}
                className={`nb-pag ${paginaAtual?.id === p.id ? 'on' : ''}`}
                onClick={() => {
                  setSecaoId(String(p.secao))
                  setPaginaId(p.id)
                }}
              >
                <span className="nb-pag-t">{String(p.titulo || 'Sem título')}</span>
                <span className="small muted">{caminho(p)}</span>
              </div>
            ))}
          </>
        ) : secao ? (
          <>
            <div className="nb-sub">
              <b className="small">{String(secao.nome)}</b>
              <span className="grow" />
              <button className="btn sm" onClick={() => novaPagina()}>
                <Icon name="plus" size={14} /> Página
              </button>
            </div>
            {pagsSecao.map((p) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => setArrastando(p.id)}
                onDragEnd={() => setArrastando('')}
                onDragOver={(e) => arrastando && arrastando !== p.id && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (arrastando && arrastando !== p.id) moverPagina(arrastando, { antesDe: p })
                  setArrastando('')
                }}
                className={`nb-pag ${paginaAtual?.id === p.id ? 'on' : ''}`}
                style={{ paddingLeft: 12 + Math.min(2, Number(p.nivel ?? 0)) * 16 }}
                onClick={() => setPaginaId(p.id)}
              >
                <span className="nb-pag-t">{String(p.titulo || 'Sem título')}</span>
                <span className="small muted nb-prev">{String(p.texto ?? '').slice(0, 70) || ' '}</span>
              </div>
            ))}
            {pagsSecao.length === 0 && <div className="nb-vazio">Seção vazia.</div>}
            <div className="small muted nb-dica">Arraste uma página para reordenar ou solte-a sobre outra seção para mover.</div>
          </>
        ) : (
          <div className="nb-vazio">Crie um bloco e uma seção para começar.</div>
        )}
      </aside>

      {/* ── editor */}
      <section className="nb-col nb-editor">
        {paginaAtual ? (
          <Pagina
            key={paginaAtual.id}
            p={paginaAtual}
            caminho={caminho(paginaAtual)}
            onSubpagina={() => novaPagina(String(paginaAtual.secao), Math.min(2, Number(paginaAtual.nivel ?? 0) + 1), paginaAtual)}
            onExcluir={() => void excluirPagina(paginaAtual)}
          />
        ) : (
          <div className="nb-vazio grande">
            <Icon name="book" size={32} />
            {secao ? (
              <button className="btn primary" onClick={() => novaPagina()}>
                <Icon name="plus" size={15} /> Nova página
              </button>
            ) : (
              <span>Escolha ou crie uma seção.</span>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Página: título + texto formatado, salvando sozinho
type Cmd = { i: string; t: string; run: () => void }

function Pagina({ p, caminho, onSubpagina, onExcluir }: { p: Item; caminho: string; onSubpagina: () => void; onExcluir: () => void }) {
  const db = useDB()
  const desenhos = (db.desenhos ?? []).filter((d) => d.pagina === p.id).sort(porOrdem)
  function novoDesenho() {
    const d = upsert('desenhos', { pagina: p.id, ordem: proxOrdem(desenhos), tracos: [], altura: 420 })
    if (d) setTimeout(() => document.getElementById('ds-' + d.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }
  function moverDesenho(i: number, dir: -1 | 1) {
    const a = desenhos[i],
      b = desenhos[i + dir]
    if (!a || !b) return
    upsert('desenhos', { id: a.id, ordem: b.ordem })
    upsert('desenhos', { id: b.id, ordem: a.ordem })
  }
  const ed = useRef<HTMLDivElement>(null)
  const sujo = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const [titulo, setTituloRaw] = useState(String(p.titulo ?? ''))
  const tituloRef = useRef(titulo)
  const setTitulo = (v: string) => ((tituloRef.current = v), setTituloRaw(v))
  const [estado, setEstado] = useState<'' | 'salvando' | 'salvo' | 'grande'>('')
  const [verAnexos, setVerAnexos] = useState(false)

  // carrega o conteúdo; se chegou versão nova de outro computador e não estou digitando, atualiza
  useEffect(() => {
    if (!ed.current) return
    if (document.activeElement === ed.current) return // não mexe no texto enquanto você digita
    const html = limparHtml(String(p.html ?? ''))
    if (ed.current.innerHTML !== html) ed.current.innerHTML = html
  }, [p.html])
  useEffect(() => {
    if (document.activeElement?.classList.contains('nb-titulo')) return
    setTitulo(String(p.titulo ?? ''))
  }, [p.titulo])
  useEffect(() => {
    // página nova: cursor no título (sem roubar o foco de quem está renomeando bloco/seção)
    if (!p.titulo && !p.html && document.activeElement?.tagName !== 'INPUT') document.querySelector<HTMLInputElement>('.nb-titulo')?.focus()
    return () => {
      // ao trocar de página, grava o que estiver pendente
      salvar()
      const t = tituloRef.current.trim()
      if (t !== String(get('paginas', p.id)?.titulo ?? '') && get('paginas', p.id)) upsert('paginas', { id: p.id, titulo: t })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function salvar() {
    window.clearTimeout(timer.current)
    if (!sujo.current || !ed.current) return
    const html = limparHtml(ed.current.innerHTML)
    if (html.length > LIMITE) {
      setEstado('grande')
      return
    }
    sujo.current = false
    upsert('paginas', { id: p.id, html, texto: textoDoHtml(html).slice(0, 3000) })
    setEstado('salvo')
  }
  function mudou() {
    sujo.current = true
    setEstado('salvando')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(salvar, 800)
  }
  function exec(cmd: string, arg?: string) {
    ed.current?.focus()
    document.execCommand(cmd, false, arg)
    mudou()
  }
  function ulDaSelecao() {
    const n = window.getSelection()?.anchorNode
    const el = n instanceof Element ? n : n?.parentElement
    const ul = el?.closest('ul')
    return ul && ed.current?.contains(ul) ? ul : null
  }
  function lista(check: boolean) {
    ed.current?.focus()
    let ul = ulDaSelecao()
    if (ul && ul.classList.contains('check') === check) {
      document.execCommand('insertUnorderedList') // já é este tipo de lista: desfaz
    } else {
      if (!ul) document.execCommand('insertUnorderedList')
      ul = ulDaSelecao()
      ul?.classList.toggle('check', check)
    }
    mudou()
  }
  function link() {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const url = window.prompt('Endereço do link (https://…)', 'https://')
    if (url && /^(https?:|mailto:)/i.test(url)) exec('createLink', url)
  }
  function dataHora() {
    exec('insertText', new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + ' — ')
  }

  const cmds: (Cmd | '|')[] = [
    { i: 'B', t: 'Negrito (Ctrl+B)', run: () => exec('bold') },
    { i: 'I', t: 'Itálico (Ctrl+I)', run: () => exec('italic') },
    { i: 'U', t: 'Sublinhado (Ctrl+U)', run: () => exec('underline') },
    { i: 'S', t: 'Riscado', run: () => exec('strikeThrough') },
    { i: '🖍', t: 'Marca-texto', run: () => exec('hiliteColor', '#fff3a3') },
    { i: 'A', t: 'Texto vermelho', run: () => exec('foreColor', '#c0392b') },
    '|',
    { i: 'T1', t: 'Título', run: () => exec('formatBlock', 'h2') },
    { i: 'T2', t: 'Subtítulo', run: () => exec('formatBlock', 'h3') },
    { i: '¶', t: 'Texto normal', run: () => exec('formatBlock', 'p') },
    { i: '❝', t: 'Citação / destaque', run: () => exec('formatBlock', 'blockquote') },
    '|',
    { i: '•', t: 'Lista com marcadores', run: () => lista(false) },
    { i: '1.', t: 'Lista numerada', run: () => exec('insertOrderedList') },
    { i: '☑', t: 'Lista de tarefas (clique na caixinha para marcar)', run: () => lista(true) },
    { i: '⇥', t: 'Aumentar recuo', run: () => exec('indent') },
    { i: '⇤', t: 'Diminuir recuo', run: () => exec('outdent') },
    '|',
    { i: '🔗', t: 'Link (selecione o texto antes)', run: link },
    { i: '🕑', t: 'Inserir data e hora', run: dataHora },
    { i: '―', t: 'Linha divisória', run: () => exec('insertHorizontalRule') },
    { i: '⌫', t: 'Limpar formatação', run: () => exec('removeFormat') },
    '|',
    { i: '✍️ Desenho', t: 'Inserir área de desenho à mão (Apple Pencil, caneta ou mouse)', run: novoDesenho },
  ]

  return (
    <div className="nb-pagina">
      <div className="nb-meta">
        <span className="small muted grow">{caminho}</span>
        <span className={`small ${estado === 'grande' ? 'neg' : 'muted'}`}>
          {estado === 'salvando' ? 'Salvando…' : estado === 'salvo' ? 'Salvo' : estado === 'grande' ? 'Página grande demais — divida em mais páginas ou use anexos' : ''}
        </span>
        <button className="btn ghost sm" onClick={onSubpagina} title="Nova subpágina abaixo desta">
          <Icon name="plus" size={14} /> Subpágina
        </button>
        {Number(p.nivel ?? 0) > 0 ? (
          <button className="btn ghost sm" onClick={() => upsert('paginas', { id: p.id, nivel: Number(p.nivel) - 1 })} title="Promover (deixar de ser subpágina)">
            ⇤
          </button>
        ) : null}
        {Number(p.nivel ?? 0) < 2 && (
          <button className="btn ghost sm" onClick={() => upsert('paginas', { id: p.id, nivel: Number(p.nivel ?? 0) + 1 })} title="Transformar em subpágina">
            ⇥
          </button>
        )}
        <button className="btn ghost sm" onClick={() => setVerAnexos(!verAnexos)} title="Anexos e etiquetas">
          <Icon name="tag" size={14} />
        </button>
        <button className="btn ghost sm danger" onClick={onExcluir} title="Excluir página">
          <Icon name="trash" size={14} />
        </button>
      </div>
      <input
        className="nb-titulo"
        placeholder="Título da página"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={() => titulo !== p.titulo && upsert('paginas', { id: p.id, titulo: titulo.trim() })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            ed.current?.focus()
          }
        }}
      />
      <div className="small muted nb-data">
        {fmtQuando(p._created)}
        {p._updated && p._updated !== p._created ? ` · editada ${new Date(String(p._updated)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
        {p._updatedBy ? ` por ${p._updatedBy}` : ''}
      </div>
      {!verAnexos && <TagChips ids={p.etiquetas} />}
      {verAnexos && (
        <div className="card stack nb-extras">
          <b className="small muted">Etiquetas</b>
          <SeletorEtiquetas value={(p.etiquetas as string[]) ?? []} onChange={(v) => upsert('paginas', { id: p.id, etiquetas: v })} />
          <Attachments col="paginas" itemId={p.id} />
        </div>
      )}
      <div className="nb-barra" onMouseDown={(e) => e.preventDefault()}>
        {cmds.map((c, i) =>
          c === '|' ? (
            <span key={i} className="nb-sep" />
          ) : (
            <button key={i} type="button" className="nb-btn" title={c.t} onClick={c.run}>
              {c.i === 'B' ? <b>B</b> : c.i === 'I' ? <i>I</i> : c.i === 'U' ? <u>U</u> : c.i === 'S' ? <s>S</s> : c.i === 'A' ? <span style={{ color: '#c0392b', fontWeight: 800 }}>A</span> : c.i}
            </button>
          ),
        )}
      </div>
      <div
        ref={ed}
        className={`nb-texto ${desenhos.length ? 'curto' : ''}`}
        contentEditable
        suppressContentEditableWarning
        data-vazio="Comece a escrever… (cole tabelas do Excel, listas, links)"
        onInput={mudou}
        onBlur={salvar}
        onPaste={(e) => {
          const html = e.clipboardData.getData('text/html')
          if (!html) return
          e.preventDefault()
          document.execCommand('insertHTML', false, limparHtml(html))
          mudou()
        }}
        onClick={(e) => {
          // caixinha da lista de tarefas
          const li = (e.target as Element).closest('ul.check > li') as HTMLElement | null
          if (!li) return
          const r = li.getBoundingClientRect()
          if (e.clientX - r.left > 24) return
          if (li.getAttribute('data-check') === '1') li.removeAttribute('data-check')
          else li.setAttribute('data-check', '1')
          mudou()
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault()
            salvar()
          }
        }}
      />
      {desenhos.map((d, i) => (
        <div key={d.id} id={'ds-' + d.id}>
          <Desenho d={d} podeSubir={i > 0} podeDescer={i < desenhos.length - 1} onMover={(dir) => moverDesenho(i, dir)} />
        </div>
      ))}
      <button type="button" className="nb-add" onClick={novoDesenho}>
        <Icon name="plus" size={13} /> Área de desenho (Apple Pencil, caneta ou mouse)
      </button>
    </div>
  )
}

