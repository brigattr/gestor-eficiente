import { useMemo, useRef, useState } from 'react'
import { avisar, confirmar } from '../components/Dialogs'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { Bar, Chip, Kpi, PageHead, useLocalState } from '../components/ui'
import { PERGUNTAS_CLIMA, PERGUNTAS_CULTURA } from '../data/clima'
import { getPref, setPref, uid, upsert, useDB, type Item } from '../data/store'
import { downloadFile, fmtDate, parseCSV, todayISO, toCSV } from '../lib/format'
import { ESC_CONC, ESC_FREQ, MIN_N, agregarP, resultadoP, type AgregadoP } from '../lib/pesquisa'

// ───────────────────────── Pesquisa de clima (eNPS) e Diagnóstico de cultura
export function PesquisaClima({ tipo }: { tipo: 'clima' | 'cultura' }) {
  const db = useDB()
  const perguntas = tipo === 'clima' ? PERGUNTAS_CLIMA : PERGUNTAS_CULTURA
  const ciclos = (db.pesquisasClima ?? []).filter((c) => (c.tipo ?? 'clima') === tipo).sort((a, b) => String(b.data ?? '').localeCompare(String(a.data ?? '')))
  const [selId, setSel] = useLocalState(`pesq:${tipo}`, '')
  const sel = ciclos.find((c) => c.id === selId) ?? ciclos[0]
  const ant = sel ? ciclos[ciclos.indexOf(sel) + 1] : undefined
  const [ver, setVer] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const res = useMemo(() => resultadoP(sel?.agregado as AgregadoP, perguntas), [sel, perguntas])
  const resAnt = useMemo(() => (ant ? resultadoP(ant.agregado as AgregadoP, perguntas) : null), [ant, perguntas])
  const titulo = tipo === 'clima' ? 'Pesquisa de clima e eNPS' : 'Diagnóstico de cultura'

  function novo() {
    const d = new Date()
    const c = upsert('pesquisasClima', { nome: `${tipo === 'clima' ? 'Clima' : 'Cultura'} ${d.getFullYear()}/${d.getMonth() < 6 ? 1 : 2}`, data: todayISO(), tipo, grupo: '', agregado: { n: 0, q: {}, sim: {}, nps: {} } })
    if (c) setSel(c.id)
  }
  async function importar(f: File) {
    if (!sel) return
    let linhas: unknown[][]
    if (/\.xlsx$/i.test(f.name)) {
      const { default: readXlsxFile } = await import('read-excel-file/browser')
      linhas = ((await readXlsxFile(f))[0]?.data ?? []) as unknown[][]
    } else linhas = parseCSV(await f.text())
    const { ag, mapeadas } = agregarP(linhas, perguntas)
    if (!mapeadas) return avisar('Não encontrei as perguntas nas colunas. Use o modelo (P1, P2…) ou o texto das perguntas no cabeçalho.')
    const atual = sel.agregado as AgregadoP | undefined
    if (atual?.n && !(await confirmar(`Substituir as ${atual.n} respostas já importadas por ${ag.n} novas?`, { ok: 'Substituir' }))) return
    upsert('pesquisasClima', { id: sel.id, agregado: ag, importadoEm: todayISO() })
    avisar(`${ag.n} resposta(s) importada(s); ${mapeadas} de ${perguntas.length} perguntas reconhecidas. Só o resultado agregado foi guardado.`)
  }
  const textoForms = () =>
    [
      `${titulo} (anônima)`,
      'Responda com sinceridade: os resultados são analisados só em conjunto (5 ou mais respostas).',
      '',
      ...perguntas.map((p) => `P${p.n}. ${p.texto}\n   (${p.escala === 'nps' ? 'Escala de 0 a 10' : p.escala === 'freq' ? ESC_FREQ.join(' / ') : ESC_CONC.join(' / ')})`),
    ].join('\n')

  return (
    <>
      <PageHead
        title={titulo}
        desc={
          tipo === 'clima'
            ? 'Clima por dimensão (% de favorabilidade) e eNPS. Aplique pelo Microsoft Forms anônimo, exporte para Excel e importe: só o agregado fica guardado.'
            : 'Como a equipe percebe a cultura (envolvimento, consistência, adaptabilidade e missão). Mesmo fluxo: Forms anônimo → Excel → importar.'
        }
      >
        <button className="btn" onClick={() => setVer(!ver)}>
          <Icon name="list" size={15} /> {ver ? 'Ocultar' : 'Ver'} questionário
        </button>
        <button className="btn primary" onClick={novo}>
          <Icon name="plus" size={15} /> Novo ciclo
        </button>
      </PageHead>
      {ver && (
        <div className="card stack" style={{ gap: 8 }}>
          <div className="row">
            <b className="grow">Questionário</b>
            <button className="btn sm" onClick={() => (void navigator.clipboard?.writeText(textoForms()), avisar('Texto copiado. Cole no Microsoft Forms e marque o formulário como anônimo.'))}>
              Copiar para o Forms
            </button>
            <button className="btn sm" onClick={() => downloadFile(`modelo-${tipo}.csv`, toCSV([perguntas.map((p) => `P${p.n}`), perguntas.map((p) => (p.escala === 'nps' ? '8' : '3'))]), 'text/csv')}>
              <Icon name="download" size={14} /> Modelo de planilha
            </button>
          </div>
          <ol className="small nr1-perguntas">
            {perguntas.map((p) => (
              <li key={p.n}>
                {p.texto} <span className="muted">· {p.dim}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {ciclos.length === 0 ? (
        <div className="card empty">Crie o primeiro ciclo em “Novo ciclo”.</div>
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
            <button className="btn ghost sm" onClick={() => sel && openEditor('pesquisasClima', sel.id)} title="Renomear / data / grupo">
              <Icon name="edit" size={14} />
            </button>
            <span className="small muted grow">
              {fmtDate(sel?.data)} · {res.n} resposta(s)
            </span>
            <button className="btn primary" onClick={() => input.current?.click()}>
              <Icon name="upload" size={15} /> Importar respostas (Excel/CSV)
            </button>
            <input ref={input} type="file" accept=".xlsx,.csv" hidden onChange={(e) => (e.target.files?.[0] && void importar(e.target.files[0]), (e.target.value = ''))} />
          </div>
          {res.n > 0 && res.n < MIN_N && <div className="card empty">Só {res.n} resposta(s). Para preservar o anonimato, o resultado aparece a partir de {MIN_N}.</div>}
          {res.n >= MIN_N && (
            <div className="grid g2" style={{ alignItems: 'start' }}>
              <div className="card">
                <div className="card-head">
                  <h2 className="grow">Favorabilidade por dimensão</h2>
                  <span className="small muted">0–100 (maior = melhor)</span>
                </div>
                <div className="list">
                  {res.dims.map((d) => {
                    const a = resAnt && resAnt.n >= MIN_N ? resAnt.dims.find((x) => x.dim === d.dim)?.score : null
                    const t = d.score == null ? 'muted' : d.score >= 67 ? 'ok' : d.score >= 50 ? 'warn' : 'bad'
                    return (
                      <div key={d.dim}>
                        <span className="grow">{d.dim}</span>
                        {a != null && d.score != null && a !== d.score && <span className={`small ${d.score > a ? 'pos' : 'neg'}`}>{d.score > a ? '▲' : '▼'} {Math.abs(d.score - a)}</span>}
                        <span style={{ width: 140 }}>
                          <Bar value={d.score ?? 0} t={t} />
                        </span>
                        <b style={{ width: 34, textAlign: 'right' }}>{d.score ?? '—'}</b>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="stack">
                {res.nps.map((x) => (
                  <div key={x.p.n} className="card stack" style={{ gap: 6 }}>
                    <h2>eNPS</h2>
                    <div className="row">
                      <span className="enps" style={{ color: x.valor == null ? undefined : x.valor >= 30 ? 'var(--ok)' : x.valor >= 0 ? 'var(--warn)' : 'var(--bad)' }}>
                        {x.valor ?? '—'}
                      </span>
                      <span className="small muted">
                        {x.prom} promotores (9–10) · {x.neutros} neutros (7–8) · {x.det} detratores (0–6)
                      </span>
                    </div>
                    <span className="small muted">eNPS = % promotores − % detratores (de −100 a +100). Acima de 30 é bom; acima de 50, excelente.</span>
                  </div>
                ))}
                <div className="card small stack" style={{ gap: 4 }}>
                  <b>Como ler</b>
                  <span>
                    <Chip t="ok">67–100</Chip> forte · <Chip t="warn">50–66</Chip> atenção · <Chip t="bad">0–49</Chip> crítico
                  </span>
                  <span className="muted">Compartilhe o resultado com a equipe e transforme as 2–3 dimensões mais baixas em ações (Tarefas, Projetos ou Plano de ação NR-1).</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ───────────────────────── Termômetro de humor (pulso semanal anônimo)
export function semanaISO(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dia = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dia)
  const ano = t.getUTCFullYear()
  const sem = Math.ceil(((t.getTime() - Date.UTC(ano, 0, 1)) / 86400000 + 1) / 7)
  return `${ano}-W${String(sem).padStart(2, '0')}`
}
const CARAS = [
  { n: 1, e: '😣', l: 'Muito mal' },
  { n: 2, e: '🙁', l: 'Mal' },
  { n: 3, e: '😐', l: 'Normal' },
  { n: 4, e: '🙂', l: 'Bem' },
  { n: 5, e: '😄', l: 'Muito bem' },
]
const MIN_HUMOR = 3

export function Termometro() {
  const db = useDB()
  const semana = semanaISO()
  const [votou, setVotou] = useState(() => getPref<string>('humor:votou', '') === semana)
  const votos = db.humor ?? []
  const semanas = [...new Set(votos.map((v) => String(v.semana)))].sort().slice(-12)
  const daSemana = (s: string) => votos.filter((v) => v.semana === s).map((v) => Number(v.nota))
  const atual = daSemana(semana)

  function votar(n: number) {
    // id aleatório e sem autoria: o servidor grava só semana e nota
    const ok = upsert('humor', { id: uid() + uid(), semana, nota: n })
    if (!ok) return
    setPref('humor:votou', semana)
    setVotou(true)
  }

  return (
    <>
      <PageHead title="Termômetro de humor" desc="Uma pergunta por semana, anônima: o sistema não grava quem votou, só a semana e a nota. Os resultados aparecem quando há pelo menos 3 votos na semana." />
      <div className="card stack humor-voto">
        <h2>Como você está se sentindo nesta semana no trabalho?</h2>
        {votou ? (
          <span className="muted">Obrigado! Seu voto desta semana foi registrado (um voto por semana neste aparelho).</span>
        ) : (
          <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
            {CARAS.map((c) => (
              <button key={c.n} className="humor-cara" onClick={() => votar(c.n)} title={c.l}>
                <span>{c.e}</span>
                <small>{c.l}</small>
              </button>
            ))}
          </div>
        )}
        <span className="small muted">Compartilhe o link desta tela com a equipe (cada pessoa precisa de um usuário, mesmo que só de leitura).</span>
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <h2 className="grow">Últimas semanas</h2>
          </div>
          {semanas.length === 0 && <span className="muted small">Ainda sem votos.</span>}
          <div className="list">
            {semanas
              .slice()
              .reverse()
              .map((s) => {
                const vs = daSemana(s)
                const media = vs.reduce((a, b) => a + b, 0) / (vs.length || 1)
                return (
                  <div key={s}>
                    <span style={{ width: 92 }} className="small">
                      {s.replace('-W', ' · sem ')}
                    </span>
                    {vs.length >= MIN_HUMOR ? (
                      <>
                        <span style={{ fontSize: 20 }}>{CARAS[Math.round(media) - 1]?.e}</span>
                        <span className="grow">
                          <Bar value={media} max={5} t={media >= 3.8 ? 'ok' : media >= 3 ? 'warn' : 'bad'} />
                        </span>
                        <b>{media.toFixed(1)}</b>
                      </>
                    ) : (
                      <span className="grow muted small">poucos votos para mostrar</span>
                    )}
                    <span className="small muted">{vs.length} voto(s)</span>
                  </div>
                )
              })}
          </div>
        </div>
        <div className="card stack">
          <h2>Esta semana</h2>
          {atual.length >= MIN_HUMOR ? (
            <div className="list">
              {CARAS.slice()
                .reverse()
                .map((c) => {
                  const k = atual.filter((x) => x === c.n).length
                  return (
                    <div key={c.n}>
                      <span style={{ fontSize: 18 }}>{c.e}</span>
                      <span className="grow">
                        <Bar value={k} max={atual.length} />
                      </span>
                      <span className="small">{Math.round((k / atual.length) * 100)}%</span>
                    </div>
                  )
                })}
            </div>
          ) : (
            <span className="muted small">
              {atual.length} voto(s) até agora. A distribuição aparece a partir de {MIN_HUMOR}.
            </span>
          )}
          <span className="small muted">Queda de duas semanas seguidas é um bom gatilho para conversar com a equipe (e, se for o caso, registrar no inventário da NR-1).</span>
        </div>
      </div>
    </>
  )
}

// ───────────────────────── Políticas com ciência
export function Politicas() {
  const db = useDB()
  const [sel, setSel] = useState('')
  const pessoas = (db.pessoas ?? []).filter((p) => !/deslig/i.test(String(p.status ?? '')))
  const ciencias = db.ciencias ?? []
  const deuCiencia = (pol: Item, pessoa: string) => ciencias.find((c) => c.politica === pol.id && c.colaborador === pessoa && String(c.versao ?? '') === String(pol.versao ?? ''))
  function registrar(pol: Item, pessoa: string) {
    const ja = deuCiencia(pol, pessoa)
    if (ja) return
    upsert('ciencias', { politica: pol.id, colaborador: pessoa, versao: String(pol.versao ?? ''), data: todayISO() })
  }
  return (
    <ModulePage
      col="politicas"
      above={(rows) => {
        const exigem = rows.filter((p) => p.exigeCiencia !== false && /vigente/i.test(String(p.status ?? '')))
        const pol = exigem.find((p) => p.id === sel) ?? exigem[0]
        const total = exigem.length * pessoas.length
        const feitas = exigem.reduce((a, p) => a + pessoas.filter((x) => deuCiencia(p, x.id)).length, 0)
        return exigem.length && pessoas.length ? (
          <div className="card stack">
            <div className="row">
              <h2 className="grow">Ciência da equipe</h2>
              <span className="small muted">
                {feitas} de {total} ciências ({total ? Math.round((feitas / total) * 100) : 0}%)
              </span>
              <select value={pol?.id} onChange={(e) => setSel(e.target.value)} style={{ width: 280 }}>
                {exigem.map((p) => (
                  <option key={p.id} value={p.id}>
                    {String(p.titulo)} (v{String(p.versao ?? '')})
                  </option>
                ))}
              </select>
            </div>
            {pol && (
              <div className="ciencia-grade">
                {pessoas.map((x) => {
                  const c = deuCiencia(pol, x.id)
                  return (
                    <label key={x.id} className={`ciencia ${c ? 'ok' : ''}`}>
                      <input type="checkbox" checked={!!c} disabled={!!c} onChange={() => registrar(pol, x.id)} />
                      <span className="grow">{String(x.nome)}</span>
                      <span className="small muted">{c ? fmtDate(c.data) : 'pendente'}</span>
                    </label>
                  )
                })}
              </div>
            )}
            <span className="small muted">Ao mudar a versão da política, a ciência volta a ficar pendente para todos (vale a versão vigente).</span>
          </div>
        ) : null
      }}
    />
  )
}

// ───────────────────────── Diversidade (agregado)
export function Diversidade() {
  const db = useDB()
  const pessoas = (db.pessoas ?? []).filter((p) => !/deslig/i.test(String(p.status ?? '')))
  const n = pessoas.length
  const conta = (f: (p: Item) => string) => {
    const m = new Map<string, number>()
    for (const p of pessoas) m.set(f(p), (m.get(f(p)) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const idade = (p: Item) => {
    if (!p.nascimento) return 'Não informado'
    const a = Math.floor((Date.now() - new Date(String(p.nascimento)).getTime()) / (365.25 * 86400000))
    return a < 25 ? 'Até 24' : a < 35 ? '25–34' : a < 45 ? '35–44' : a < 55 ? '45–54' : '55+'
  }
  const casa = (p: Item) => {
    if (!p.admissao) return 'Não informado'
    const a = (Date.now() - new Date(String(p.admissao)).getTime()) / (365.25 * 86400000)
    return a < 1 ? 'Menos de 1 ano' : a < 3 ? '1–3 anos' : a < 5 ? '3–5 anos' : a < 10 ? '5–10 anos' : '10+ anos'
  }
  const blocos: [string, [string, number][]][] = [
    ['Gênero (autodeclarado)', conta((p) => String(p.genero || 'Não informado'))],
    ['Faixa etária', conta(idade)],
    ['Tempo de casa', conta(casa)],
    ['Pessoas com deficiência', conta((p) => (p.pcd ? 'Sim' : 'Não / não informado'))],
    ['Área', conta((p) => String(p.area || 'Não informada'))],
  ]
  // liderança: quem é gestor de alguém
  const lideres = new Set(pessoas.map((p) => String(p.gestor ?? '')).filter(Boolean))
  const mulheresLid = pessoas.filter((p) => lideres.has(p.id) && p.genero === 'Feminino').length
  return (
    <>
      <PageHead title="Diversidade" desc="Indicadores agregados a partir do cadastro do Time. Dados de gênero e deficiência são opcionais e autodeclarados (LGPD: dados sensíveis, uso só agregado)." />
      {n < 5 ? (
        <div className="card empty">Com menos de 5 pessoas os indicadores identificariam indivíduos. Cadastre o time completo para ver o painel.</div>
      ) : (
        <>
          <div className="grid g4">
            <Kpi l="Pessoas ativas" v={n} />
            <Kpi l="Mulheres" v={`${Math.round((pessoas.filter((p) => p.genero === 'Feminino').length / n) * 100)}%`} />
            <Kpi l="Mulheres na liderança" v={lideres.size ? `${Math.round((mulheresLid / lideres.size) * 100)}%` : '—'} d={`${lideres.size} líder(es) no organograma`} />
            <Kpi l="PcD" v={pessoas.filter((p) => p.pcd).length} d="Lei de cotas: empresas com 100+ empregados" />
          </div>
          <div className="grid g3" style={{ alignItems: 'start' }}>
            {blocos.map(([t, xs]) => (
              <div key={t} className="card">
                <div className="card-head">
                  <h2 className="grow">{t}</h2>
                </div>
                <div className="list">
                  {xs.map(([k, v]) => (
                    <div key={k}>
                      <span className="grow">{k}</span>
                      <span style={{ width: 110 }}>
                        <Bar value={v} max={n} />
                      </span>
                      <span className="small" style={{ width: 70, textAlign: 'right' }}>
                        {v} · {Math.round((v / n) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

