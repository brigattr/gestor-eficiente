import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { confirmar } from '../components/Dialogs'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { CORES_ETIQUETA, MOD } from '../data/schema'
import { get, getPref, remove, setPref, upsert, useDB, type Item } from '../data/store'
import { addFiles, deleteFile, fmtSize, openFile, updateFile, useFileIndex, type FileMeta } from '../lib/files'
import { label } from '../lib/format'

// Repositório de arquivos por pastas (estilo OneDrive). Os arquivos usam a mesma estrutura dos anexos:
// col = 'pastas' e itemId = id da pasta ('raiz' para a pasta principal).

const RAIZ = 'raiz'
const SISTEMA = '__sistema__' // visão: anexos dos demais módulos
const CORES = Object.keys(CORES_ETIQUETA)
const cor = (p?: Item) => CORES_ETIQUETA[String(p?.cor ?? 'Azul')] ?? CORES_ETIQUETA.Azul
const porNome = (a: Item, b: Item) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true })
const ext = (n: string) => (n.includes('.') ? n.split('.').pop()!.toUpperCase().slice(0, 4) : '—')

function iconeArquivo(f: FileMeta) {
  const e = ext(f.name)
  const corExt: Record<string, string> = { PDF: '#c0392b', XLSX: '#1d7044', XLS: '#1d7044', XLSM: '#1d7044', CSV: '#1d7044', DOCX: '#2b579a', DOC: '#2b579a', PPTX: '#c43e1c', PPT: '#c43e1c', MSG: '#0a64ad', EML: '#0a64ad', ZIP: '#6b5b2e' }
  return (
    <span className="arq-ext" style={{ background: corExt[e] ?? 'var(--info)' }}>
      {e === 'MSG' || e === 'EML' ? '✉' : e}
    </span>
  )
}

export function Arquivos() {
  const db = useDB()
  const idx = useFileIndex()
  const [params, setParams] = useSearchParams()
  const pastas = (db.pastas ?? []).slice().sort(porNome)
  const atual = params.get('pasta') ?? getPref<string>('arq:pasta', RAIZ)
  const pastaAtual = atual === RAIZ || atual === SISTEMA ? undefined : get('pastas', atual)
  const aqui = atual === SISTEMA ? SISTEMA : pastaAtual ? pastaAtual.id : RAIZ
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<'nome' | 'data' | 'tamanho'>(() => getPref('arq:ordem', 'nome'))
  const [abertas, setAbertas] = useState<Record<string, boolean>>(() => getPref('arq:abertas', {}))
  const [sobre, setSobre] = useState('') // pasta sob o arraste
  const [enviando, setEnviando] = useState(false)
  const [renomear, setRenomear] = useState('')
  const arrastando = useRef<string>('')
  const input = useRef<HTMLInputElement>(null)

  const ir = (id: string) => {
    setPref('arq:pasta', id)
    setParams(id === RAIZ ? {} : { pasta: id }, { replace: false })
    setBusca('')
  }
  const filhas = (pai: string) => pastas.filter((p) => (p.pai ? String(p.pai) : RAIZ) === pai)
  const arquivosDe = (pasta: string) => idx.filter((f) => f.col === 'pastas' && f.itemId === pasta)
  const descendentes = (id: string): string[] => filhas(id).flatMap((p) => [p.id, ...descendentes(p.id)])
  const totalEm = (id: string) => [id, ...descendentes(id)].reduce((n, p) => n + arquivosDe(p).length, 0)

  const caminho: Item[] = []
  for (let p = pastaAtual; p; p = p.pai ? get('pastas', String(p.pai)) : undefined) {
    caminho.unshift(p)
    if (caminho.length > 20) break
  }
  const nomePasta = (id: string) => (id === RAIZ ? 'Meus arquivos' : String(get('pastas', id)?.nome ?? '?'))

  const ordenar = (xs: FileMeta[]) =>
    xs.slice().sort((a, b) => (ordem === 'data' ? b.added.localeCompare(a.added) : ordem === 'tamanho' ? b.size - a.size : a.name.localeCompare(b.name, 'pt-BR', { numeric: true })))

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return null
    return idx.filter((f) => f.name.toLowerCase().includes(q) || (f.meta?.assunto ?? '').toLowerCase().includes(q) || (f.meta?.de ?? '').toLowerCase().includes(q)).slice(0, 200)
  }, [busca, idx])

  const arquivos = resultados ?? (aqui === SISTEMA ? idx.filter((f) => f.col !== 'pastas') : arquivosDe(aqui))
  const subpastas = resultados || aqui === SISTEMA ? [] : filhas(aqui)

  // ── ações
  function novaPasta() {
    const p = upsert('pastas', { nome: 'Nova pasta', pai: aqui === RAIZ || aqui === SISTEMA ? null : aqui, cor: CORES[pastas.length % CORES.length] })
    if (p) setRenomear(p.id)
  }
  async function enviar(files: FileList | File[] | null, pasta = aqui) {
    if (!files || !files.length) return
    const destino = pasta === SISTEMA ? RAIZ : pasta
    setEnviando(true)
    await addFiles('pastas', destino, files)
    setEnviando(false)
  }
  async function excluirPasta(p: Item) {
    const ids = [p.id, ...descendentes(p.id)]
    const n = ids.reduce((s, id) => s + arquivosDe(id).length, 0)
    const msg = n || ids.length > 1 ? `Excluir a pasta "${p.nome}" com ${ids.length - 1} subpasta(s) e ${n} arquivo(s)? Não dá para desfazer.` : `Excluir a pasta vazia "${p.nome}"?`
    if (!(await confirmar(msg, { ok: 'Excluir', danger: true }))) return
    for (const id of ids) {
      for (const f of arquivosDe(id)) await deleteFile(f.id)
      remove('pastas', id)
    }
    if (ids.includes(aqui)) ir(p.pai ? String(p.pai) : RAIZ)
  }
  async function excluirArquivo(f: FileMeta) {
    if (await confirmar(`Excluir "${f.name}"? Não dá para desfazer.`, { ok: 'Excluir', danger: true })) await deleteFile(f.id)
  }
  function moverPasta(id: string, novoPai: string) {
    if (id === novoPai || descendentes(id).includes(novoPai)) return // não pode entrar em si mesma
    upsert('pastas', { id, pai: novoPai === RAIZ ? null : novoPai })
  }
  function soltar(e: React.DragEvent, pasta: string) {
    e.preventDefault()
    e.stopPropagation()
    setSobre('')
    const a = arrastando.current
    arrastando.current = ''
    if (a.startsWith('f:')) void updateFile(a.slice(2), { col: 'pastas', itemId: pasta })
    else if (a.startsWith('p:')) moverPasta(a.slice(2), pasta)
    else if (e.dataTransfer.files.length) void enviar(e.dataTransfer.files, pasta)
  }
  const alvo = (pasta: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (sobre !== pasta) setSobre(pasta)
    },
    onDragLeave: () => setSobre((s) => (s === pasta ? '' : s)),
    onDrop: (e: React.DragEvent) => soltar(e, pasta),
  })

  function Arvore({ pai, nivel }: { pai: string; nivel: number }) {
    return (
      <>
        {filhas(pai).map((p) => {
          const tem = filhas(p.id).length > 0
          const aberta = abertas[p.id] ?? false
          return (
            <div key={p.id}>
              <div
                className={`arq-no ${aqui === p.id ? 'on' : ''} ${sobre === p.id ? 'sobre' : ''}`}
                style={{ paddingLeft: 8 + nivel * 14 }}
                onClick={() => ir(p.id)}
                draggable
                onDragStart={() => (arrastando.current = 'p:' + p.id)}
                {...alvo(p.id)}
              >
                <span
                  className="arq-seta"
                  onClick={(e) => {
                    e.stopPropagation()
                    const n = { ...abertas, [p.id]: !aberta }
                    setAbertas(n)
                    setPref('arq:abertas', n)
                  }}
                >
                  {tem ? (aberta ? '▾' : '▸') : ''}
                </span>
                <Icon name="folder" size={15} className="arq-ico" />
                <span className="arq-nome" style={{ ['--pasta' as string]: cor(p) }}>
                  {String(p.nome)}
                </span>
              </div>
              {tem && aberta && <Arvore pai={p.id} nivel={nivel + 1} />}
            </div>
          )
        })}
      </>
    )
  }

  const usado = idx.filter((f) => f.col === 'pastas').reduce((s, f) => s + f.size, 0)

  return (
    <div className="arq">
      <aside className="arq-arvore">
        <div className={`arq-no raiz ${aqui === RAIZ ? 'on' : ''} ${sobre === RAIZ ? 'sobre' : ''}`} onClick={() => ir(RAIZ)} {...alvo(RAIZ)}>
          <Icon name="folder" size={16} /> <b>Meus arquivos</b>
        </div>
        <Arvore pai={RAIZ} nivel={1} />
        <div className={`arq-no raiz sistema ${aqui === SISTEMA ? 'on' : ''}`} onClick={() => ir(SISTEMA)} title="Anexos de tarefas, reuniões, projetos etc.">
          <Icon name="link" size={15} /> Anexos dos módulos <span className="arq-n">{idx.filter((f) => f.col !== 'pastas').length}</span>
        </div>
        <div className="small muted arq-uso">
          {idx.filter((f) => f.col === 'pastas').length} arquivo(s) · {fmtSize(usado)}
        </div>
      </aside>

      <section className="arq-main" {...(aqui !== SISTEMA && !resultados ? alvo(aqui) : {})}>
        <div className="arq-topo">
          <div className="arq-trilha">
            {aqui === SISTEMA ? (
              <b>Anexos dos módulos</b>
            ) : (
              <>
                <a onClick={() => ir(RAIZ)} {...alvo(RAIZ)}>
                  Meus arquivos
                </a>
                {caminho.map((p) => (
                  <span key={p.id}>
                    <span className="muted"> › </span>
                    {p.id === aqui && renomear === p.id ? (
                      <RenomearInline valor={String(p.nome)} onFim={(v) => (setRenomear(''), v && upsert('pastas', { id: p.id, nome: v }))} />
                    ) : (
                      <a onClick={() => ir(p.id)} onDoubleClick={() => p.id === aqui && setRenomear(p.id)} {...alvo(p.id)}>
                        {String(p.nome)}
                      </a>
                    )}
                  </span>
                ))}
              </>
            )}
          </div>
          <span className="grow" />
          <input className="arq-busca" placeholder="Buscar em todos os arquivos…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <select
            value={ordem}
            onChange={(e) => {
              setOrdem(e.target.value as typeof ordem)
              setPref('arq:ordem', e.target.value)
            }}
            title="Ordenar"
          >
            <option value="nome">Nome</option>
            <option value="data">Mais recentes</option>
            <option value="tamanho">Maiores</option>
          </select>
          {aqui !== SISTEMA && (
            <>
              <button className="btn" onClick={novaPasta}>
                <Icon name="plus" size={15} /> Pasta
              </button>
              <button className="btn primary" onClick={() => input.current?.click()} disabled={enviando}>
                <Icon name="upload" size={15} /> {enviando ? 'Enviando…' : 'Enviar arquivos'}
              </button>
              <input ref={input} type="file" multiple hidden onChange={(e) => (void enviar(e.target.files), (e.target.value = ''))} />
            </>
          )}
          {pastaAtual && (
            <>
              <button className="btn ghost sm" title="Renomear pasta" onClick={() => setRenomear(pastaAtual.id)}>
                <Icon name="edit" size={14} />
              </button>
              <select className="nb-cor" style={{ background: cor(pastaAtual) }} value={String(pastaAtual.cor ?? 'Azul')} onChange={(e) => upsert('pastas', { id: pastaAtual.id, cor: e.target.value })} title="Cor da pasta">
                {CORES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <button className="btn ghost sm danger" title="Excluir pasta" onClick={() => void excluirPasta(pastaAtual)}>
                <Icon name="trash" size={14} />
              </button>
            </>
          )}
        </div>

        {resultados && <div className="small muted">{resultados.length ? `${resultados.length} arquivo(s) encontrado(s) em todas as pastas` : 'Nada encontrado.'}</div>}

        {subpastas.length > 0 && (
          <div className="arq-pastas">
            {subpastas.map((p) => (
              <div
                key={p.id}
                className={`arq-pasta ${sobre === p.id ? 'sobre' : ''}`}
                style={{ ['--pasta' as string]: cor(p) }}
                onClick={() => renomear !== p.id && ir(p.id)}
                onDoubleClick={() => setRenomear(p.id)}
                draggable
                onDragStart={() => (arrastando.current = 'p:' + p.id)}
                {...alvo(p.id)}
              >
                <svg width="38" height="30" viewBox="0 0 38 30" aria-hidden>
                  <path d="M2 5a3 3 0 0 1 3-3h9l3 3h16a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" fill="var(--pasta)" opacity=".9" />
                </svg>
                {renomear === p.id ? (
                  <RenomearInline valor={String(p.nome)} onFim={(v) => (setRenomear(''), v && upsert('pastas', { id: p.id, nome: v }))} />
                ) : (
                  <b className="arq-pasta-nome">{String(p.nome)}</b>
                )}
                <span className="small muted">
                  {totalEm(p.id)} arquivo(s){filhas(p.id).length ? ` · ${filhas(p.id).length} pasta(s)` : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {arquivos.length > 0 ? (
          <div className="card flush">
            <div className="table-wrap">
              <table className="arq-tabela">
                <tbody>
                  {ordenar(arquivos).map((f) => {
                    const origem = f.col === 'pastas' ? (resultados ? nomePasta(f.itemId) : '') : `${MOD[f.col]?.singular ?? f.col}: ${label(f.col, get(f.col, f.itemId)) || '(registro removido)'}`
                    return (
                      <tr key={f.id} draggable={f.col === 'pastas'} onDragStart={() => (arrastando.current = 'f:' + f.id)}>
                        <td style={{ width: 44 }}>{iconeArquivo(f)}</td>
                        <td className="arq-cel-nome">
                          {renomear === f.id ? (
                            <RenomearInline valor={f.name} onFim={(v) => (setRenomear(''), v && v !== f.name && void updateFile(f.id, { name: v }))} />
                          ) : (
                            <a className="arq-link" onClick={() => void openFile(f.id)} title="Abrir">
                              {f.meta?.assunto || f.name}
                            </a>
                          )}
                          {(origem || f.meta?.assunto) && (
                            <div className="small muted arq-sub">
                              {f.meta?.assunto ? f.name : ''}
                              {f.meta?.assunto && origem ? ' · ' : ''}
                              {origem && (f.col === 'pastas' ? <a onClick={() => ir(f.itemId)}>📁 {origem}</a> : <a onClick={() => openEditor(f.col, f.itemId)}>{origem}</a>)}
                            </div>
                          )}
                        </td>
                        <td className="small muted hide-sm" style={{ width: 90, whiteSpace: 'nowrap' }}>
                          {fmtSize(f.size)}
                        </td>
                        <td className="small muted hide-sm" style={{ width: 150, whiteSpace: 'nowrap' }}>
                          {new Date(f.added).toLocaleDateString('pt-BR')}
                          {f.by ? ` · ${f.by.split(' ')[0]}` : ''}
                        </td>
                        <td style={{ width: 150, whiteSpace: 'nowrap', textAlign: 'right' }}>
                          {f.col === 'pastas' && (
                            <select className="arq-mover" value="" onChange={(e) => e.target.value && void updateFile(f.id, { itemId: e.target.value })} title="Mover para…">
                              <option value="">Mover…</option>
                              <option value={RAIZ}>Meus arquivos</option>
                              {pastas.map((p) => (
                                <option key={p.id} value={p.id} disabled={p.id === f.itemId}>
                                  {caminhoTexto(p)}
                                </option>
                              ))}
                            </select>
                          )}
                          <button className="btn ghost sm" title="Baixar / abrir" onClick={() => void openFile(f.id)}>
                            <Icon name="download" size={14} />
                          </button>
                          {f.col === 'pastas' && (
                            <button className="btn ghost sm" title="Renomear" onClick={() => setRenomear(f.id)}>
                              <Icon name="edit" size={14} />
                            </button>
                          )}
                          <button className="btn ghost sm danger" title="Excluir" onClick={() => void excluirArquivo(f)}>
                            <Icon name="trash" size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          !resultados &&
          aqui !== SISTEMA && (
            <div className={`dropzone big arq-drop ${sobre === aqui ? 'over' : ''}`} onClick={() => input.current?.click()}>
              <Icon name="upload" size={18} />
              {subpastas.length ? 'Arraste arquivos aqui para guardar nesta pasta' : 'Pasta vazia. Arraste arquivos aqui (até 50 MB cada) ou clique para escolher.'}
            </div>
          )
        )}
        {aqui === SISTEMA && !resultados && arquivos.length === 0 && <div className="card empty">Nenhum anexo nos módulos ainda.</div>}
        {aqui !== SISTEMA && !resultados && <div className="small muted">Dica: arraste arquivos do computador para qualquer pasta (inclusive na árvore à esquerda). Arraste um arquivo ou pasta sobre outra pasta para mover. Duplo clique renomeia.</div>}
      </section>
    </div>
  )

  function caminhoTexto(p: Item): string {
    const nomes: string[] = []
    for (let x: Item | undefined = p; x && nomes.length < 10; x = x.pai ? get('pastas', String(x.pai)) : undefined) nomes.unshift(String(x.nome))
    return nomes.join(' › ')
  }
}

function RenomearInline({ valor, onFim }: { valor: string; onFim: (v: string) => void }) {
  const [v, setV] = useState(valor)
  const fim = () => onFim(v.trim())
  return (
    <input
      autoFocus
      className="nb-input"
      value={v}
      onFocus={(e) => {
        // seleciona o nome sem a extensão, como no Windows
        const i = valor.lastIndexOf('.')
        e.target.setSelectionRange(0, i > 0 ? i : valor.length)
      }}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value)}
      onBlur={fim}
      onKeyDown={(e) => {
        if (e.key === 'Enter') fim()
        if (e.key === 'Escape') onFim('')
      }}
    />
  )
}
