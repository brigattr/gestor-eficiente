import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { PageHead } from '../components/ui'

// Manual do usuário dentro do sistema. O conteúdo é o mesmo do PDF (docs/manual-usuario/conteudo):
// uma seção por tela, na ordem do menu, mais primeiros passos, padrões, integrações, glossário e perguntas.

type Recurso = { nome: string; descricao: string }
type Tela = { path: string; titulo: string; grupo: string; objetivo: string; quando_usar?: string; passo_a_passo?: string[]; recursos?: Recurso[]; impactos?: string[]; cuidados?: string[]; dica?: string }
type Bloco = { titulo: string; texto?: string; passos?: string[] }
type Geral = { primeiros_passos: Bloco[]; padroes: Bloco[]; integracoes: { de: string; para: string; como: string }[]; glossario: { termo: string; significado: string }[]; faq: { pergunta: string; resposta: string }[] }
type Conteudo = { telas: Tela[]; geral: Geral }

const ARQS = import.meta.glob('../../docs/manual-usuario/conteudo/*.json', { import: 'default' })
let cache: Promise<Conteudo> | null = null
function carregar(): Promise<Conteudo> {
  cache ??= (async () => {
    const nomes = Object.keys(ARQS).sort()
    const partes = await Promise.all(nomes.map((n) => ARQS[n]() as Promise<unknown>))
    const telas: Tela[] = []
    let geral: Geral | null = null
    partes.forEach((p) => (Array.isArray(p) ? telas.push(...(p as Tela[])) : (geral = p as Geral)))
    return { telas, geral: geral! }
  })()
  return cache
}

const IMG = (p: string) => `manual/${p || 'visao-geral'}.webp`
// fotos de detalhe (formulários, visões) mostradas na seção da tela
const EXTRAS: Record<string, [string, string][]> = {
  tarefas: [['det-tarefa', 'A tarefa aberta: campos, etapas e anexos'], ['det-compartilhar', 'Plano Empresa: “Compartilhar com” no fim do formulário'], ['det-kanban', 'Visão Kanban: arraste o cartão para mudar o status'], ['det-importar', 'Importar planilha: modelo, conferência e desfazer']],
  projetos: [['det-projeto', 'Dentro do projeto: as tarefas do projeto e o progresso'], ['det-projetos-tarefas', 'Visão “Com tarefas”'], ['det-gantt', 'Visão Gantt']],
  plataforma: [['det-nova-conta', 'Nova conta: plano, administrador e ferramentas liberadas']],
  configuracoes: [['det-conta', 'Conta: plano e “Gestor vê tudo da equipe”']],
  '': [['det-busca', 'Busca global: digite e vá direto ao registro']],
}
const idTela = (p: string) => 'tela-' + (p || 'visao-geral')
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
const textoTela = (t: Tela) => norm([t.titulo, t.grupo, t.objetivo, t.quando_usar, ...(t.passo_a_passo ?? []), ...(t.recursos ?? []).map((r) => r.nome + ' ' + r.descricao), ...(t.impactos ?? []), ...(t.cuidados ?? []), t.dica].join(' '))
const textoBloco = (b: Bloco) => norm([b.titulo, b.texto, ...(b.passos ?? [])].join(' '))

export function Manual() {
  const [c, setC] = useState<Conteudo | null>(null)
  const [erro, setErro] = useState(false)
  const [q, setQ] = useState('')
  const [params] = useSearchParams()
  const alvo = params.get('tela')
  const topo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    carregar()
      .then(setC)
      .catch(() => setErro(true))
  }, [])
  // aberto pelo botão ? de uma tela: vai direto à explicação dela
  useEffect(() => {
    if (!c || alvo == null) return
    const el = document.getElementById(c.telas.some((t) => t.path === alvo) ? idTela(alvo) : 'manual-inicio')
    setTimeout(() => el?.scrollIntoView({ block: 'start' }), 60)
  }, [c, alvo])

  const grupos = useMemo(() => {
    const gs: { nome: string; telas: Tela[] }[] = []
    for (const t of c?.telas ?? []) {
      let g = gs.find((x) => x.nome === t.grupo)
      if (!g) gs.push((g = { nome: t.grupo, telas: [] }))
      g.telas.push(t)
    }
    return gs
  }, [c])

  const termo = norm(q.trim())
  const achados = useMemo(() => {
    if (!c || termo.length < 2) return null
    const palavras = termo.split(/\s+/)
    const bate = (s: string) => palavras.every((p) => s.includes(p))
    return {
      telas: c.telas.filter((t) => bate(textoTela(t))),
      blocos: [...c.geral.primeiros_passos, ...c.geral.padroes].filter((b) => bate(textoBloco(b))),
      faq: c.geral.faq.filter((f) => bate(norm(f.pergunta + ' ' + f.resposta))),
      glossario: c.geral.glossario.filter((g) => bate(norm(g.termo + ' ' + g.significado))),
    }
  }, [c, termo])

  function imprimir() {
    // folha A4 em pé só para o manual (a regra geral de impressão é a dos certificados)
    const st = document.createElement('style')
    st.textContent = '@page { size: A4 portrait; margin: 12mm; }'
    document.head.appendChild(st)
    document.body.classList.add('imprimindo-manual')
    const fim = () => {
      st.remove()
      document.body.classList.remove('imprimindo-manual')
      window.removeEventListener('afterprint', fim)
    }
    window.addEventListener('afterprint', fim)
    window.print()
  }

  if (erro) return <div className="card">Não foi possível abrir o manual. Verifique a conexão e tente de novo.</div>
  if (!c) return <div className="card muted">Abrindo o manual…</div>

  return (
    <div className="manual" ref={topo}>
      <div id="manual-inicio" />
      <PageHead title="Manual do usuário" desc="Para que serve cada tela, passo a passo, cuidados e como uma tela afeta as outras. Use a busca, o sumário ou o botão ? ao lado do título de qualquer tela.">
        <button className="btn" onClick={imprimir}>
          <Icon name="print" size={16} /> Imprimir / salvar PDF
        </button>
      </PageHead>

      <div className="card manual-busca nao-imprime">
        <Icon name="search" size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no manual (ex.: delegar, backup, férias, compartilhar)…" aria-label="Buscar no manual" />
        {q && (
          <button className="btn sm ghost" onClick={() => setQ('')}>
            Limpar
          </button>
        )}
      </div>

      {achados ? (
        <div className="card stack">
          <h2>Resultados para “{q.trim()}”</h2>
          {!achados.telas.length && !achados.blocos.length && !achados.faq.length && !achados.glossario.length && <span className="muted">Nada encontrado. Tente outra palavra.</span>}
          {achados.telas.length > 0 && (
            <div className="manual-res">
              <b className="small muted">Telas</b>
              {achados.telas.map((t) => (
                <a key={t.path} href={`#/manual?tela=${encodeURIComponent(t.path)}`} onClick={() => setQ('')}>
                  {t.titulo} <span className="small muted">· {t.grupo}</span>
                </a>
              ))}
            </div>
          )}
          {achados.blocos.map((b) => (
            <BlocoTexto key={b.titulo} b={b} />
          ))}
          {achados.faq.map((f) => (
            <div key={f.pergunta}>
              <b>{f.pergunta}</b>
              <p className="manual-p">{f.resposta}</p>
            </div>
          ))}
          {achados.glossario.map((g) => (
            <div key={g.termo}>
              <b>{g.termo}</b> — {g.significado}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="card manual-sumario">
            <h2>Sumário</h2>
            <div className="manual-sum-geral">
              <a href="#manual-primeiros" onClick={(e) => (e.preventDefault(), document.getElementById('manual-primeiros')?.scrollIntoView())}>Primeiros passos</a>
              <a href="#manual-padroes" onClick={(e) => (e.preventDefault(), document.getElementById('manual-padroes')?.scrollIntoView())}>O que vale para todas as telas</a>
              <a href="#manual-integracoes" onClick={(e) => (e.preventDefault(), document.getElementById('manual-integracoes')?.scrollIntoView())}>Como os módulos se conversam</a>
              <a href="#manual-glossario" onClick={(e) => (e.preventDefault(), document.getElementById('manual-glossario')?.scrollIntoView())}>Glossário</a>
              <a href="#manual-faq" onClick={(e) => (e.preventDefault(), document.getElementById('manual-faq')?.scrollIntoView())}>Perguntas frequentes</a>
            </div>
            <div className="manual-sum-grupos">
              {grupos.map((g) => (
                <div key={g.nome}>
                  <b>{g.nome}</b>
                  {g.telas.map((t) => (
                    <a key={t.path} href={'#' + idTela(t.path)} onClick={(e) => (e.preventDefault(), document.getElementById(idTela(t.path))?.scrollIntoView())}>
                      {t.titulo}
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <Capitulo id="manual-primeiros" titulo="Primeiros passos">
            {c.geral.primeiros_passos.map((b) => (
              <BlocoTexto key={b.titulo} b={b} />
            ))}
          </Capitulo>
          <Capitulo id="manual-padroes" titulo="O que vale para todas as telas">
            {c.geral.padroes.map((b) => (
              <BlocoTexto key={b.titulo} b={b} />
            ))}
          </Capitulo>

          {grupos.map((g) => (
            <div key={g.nome} className="stack">
              <div className="manual-grupo">{g.nome}</div>
              {g.telas.map((t) => (
                <SecaoTela key={t.path} t={t} />
              ))}
            </div>
          ))}

          <Capitulo id="manual-integracoes" titulo="Como os módulos se conversam">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>De</th>
                    <th>Para</th>
                    <th>Como</th>
                  </tr>
                </thead>
                <tbody>
                  {c.geral.integracoes.map((i, n) => (
                    <tr key={n}>
                      <td>
                        <b>{i.de}</b>
                      </td>
                      <td>{i.para}</td>
                      <td>{i.como}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Capitulo>
          <Capitulo id="manual-glossario" titulo="Glossário">
            {c.geral.glossario.map((g) => (
              <div key={g.termo}>
                <b>{g.termo}</b> — {g.significado}
              </div>
            ))}
          </Capitulo>
          <Capitulo id="manual-faq" titulo="Perguntas frequentes">
            {c.geral.faq.map((f) => (
              <div key={f.pergunta}>
                <b>{f.pergunta}</b>
                <p className="manual-p">{f.resposta}</p>
              </div>
            ))}
          </Capitulo>
        </>
      )}
    </div>
  )
}

function Capitulo({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card stack manual-cap">
      <h2>{titulo}</h2>
      {children}
    </section>
  )
}

function BlocoTexto({ b }: { b: Bloco }) {
  return (
    <div className="manual-bloco">
      <h3>{b.titulo}</h3>
      {b.texto?.split('\n\n').map((p, i) => (
        <p key={i} className="manual-p">
          {p}
        </p>
      ))}
      {!!b.passos?.length && (
        <ol>
          {b.passos.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ol>
      )}
    </div>
  )
}

function SecaoTela({ t }: { t: Tela }) {
  const [semImg, setSemImg] = useState(false)
  return (
    <section id={idTela(t.path)} className="card stack manual-tela">
      <div className="row">
        <h2 className="grow">{t.titulo}</h2>
        <a className="btn sm nao-imprime" href={'#/' + t.path}>
          Abrir a tela →
        </a>
      </div>
      <p className="manual-p">
        <b>Objetivo.</b> {t.objetivo}
      </p>
      {!semImg && <img className="manual-img" src={IMG(t.path)} alt={`Tela ${t.titulo} (dados fictícios)`} loading="lazy" onError={() => setSemImg(true)} />}
      {(EXTRAS[t.path] ?? []).map(([n, leg]) => (
        <figure key={n} className="manual-fig">
          <img className="manual-img" src={`manual/${n}.webp`} alt={leg} loading="lazy" />
          <figcaption className="small muted">{leg}</figcaption>
        </figure>
      ))}
      {t.quando_usar && (
        <>
          <h3>Quando usar</h3>
          <p className="manual-p">{t.quando_usar}</p>
        </>
      )}
      {!!t.passo_a_passo?.length && (
        <>
          <h3>Passo a passo</h3>
          <ol>
            {t.passo_a_passo.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
        </>
      )}
      {!!t.recursos?.length && (
        <>
          <h3>Recursos da tela</h3>
          <div className="manual-recursos">
            {t.recursos.map((r) => (
              <div key={r.nome}>
                <b>{r.nome}</b> — {r.descricao}
              </div>
            ))}
          </div>
        </>
      )}
      {!!t.impactos?.length && <Caixa tipo="impacto" titulo="Impactos em outros módulos" itens={t.impactos} />}
      {!!t.cuidados?.length && <Caixa tipo="cuidado" titulo="Cuidados e consequências" itens={t.cuidados} />}
      {t.dica && <Caixa tipo="dica" titulo="Dica" itens={[t.dica]} />}
    </section>
  )
}

function Caixa({ tipo, titulo, itens }: { tipo: string; titulo: string; itens: string[] }) {
  return (
    <div className={`manual-caixa ${tipo}`}>
      <b>{titulo}</b>
      {itens.length === 1 ? (
        <p className="manual-p">{itens[0]}</p>
      ) : (
        <ul>
          {itens.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
