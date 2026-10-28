import { useMemo, useRef, useState } from 'react'
import { MOD } from '../data/schema'
import { bulk, list, removeMany, uid } from '../data/store'
import { baixarModelo, converter, lerPlanilha, norm, resolverFaltantes, type Bruto, type Resultado } from '../lib/importacao'
import { cellText } from './Views'
import { confirmar } from './Dialogs'
import { Icon } from './Icon'
import { Modal } from './ui'

// Importação em massa de uma tela: baixar modelo → escolher planilha → conferir → importar (com desfazer).

type Feito = { lote: string; total: number; criados: { col: string; n: number }[] }

export function ImportarPlanilha({ col, onClose }: { col: string; onClose: () => void }) {
  const m = MOD[col]
  const arq = useRef<HTMLInputElement>(null)
  const [bruto, setBruto] = useState<Bruto | null>(null)
  const [nome, setNome] = useState('')
  const [criar, setCriar] = useState(true)
  const [lote] = useState(() => 'imp_' + uid())
  const [erro, setErro] = useState('')
  const [busy, setBusy] = useState(false)
  const [feito, setFeito] = useState<Feito | null>(null)
  const res: Resultado | null = useMemo(() => (bruto ? converter(col, bruto, criar, lote) : null), [bruto, criar, col, lote])

  async function escolher(f: File | undefined) {
    if (!f) return
    setErro('')
    try {
      const b = await lerPlanilha(f)
      if (!b.cab.length) throw new Error('a planilha está vazia')
      setBruto(b)
      setNome(f.name)
    } catch (e) {
      setErro(`Não foi possível ler o arquivo: ${(e as Error).message}`)
    }
  }

  async function importar() {
    if (!res || !res.itens.length) return
    setBusy(true)
    try {
      const criados = resolverFaltantes(res, lote)
      for (const c of criados) await bulk(c.col, c.itens)
      for (let i = 0; i < res.itens.length; i += 400) await bulk(col, res.itens.slice(i, i + 400))
      setFeito({ lote, total: res.itens.length, criados: criados.map((c) => ({ col: c.col, n: c.itens.length })) })
    } finally {
      setBusy(false)
    }
  }

  async function desfazer() {
    if (!feito) return
    if (!(await confirmar(`Desfazer esta importação? Os ${feito.total} registro(s) importados${feito.criados.length ? ' e os cadastros criados junto' : ''} serão excluídos.`, { ok: 'Desfazer', danger: true }))) return
    setBusy(true)
    try {
      await removeMany(col, list(col).filter((i) => i._importacao === feito.lote).map((i) => i.id))
      for (const c of feito.criados) await removeMany(c.col, list(c.col).filter((i) => i._importacao === feito.lote).map((i) => i.id))
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const nomeNovo = (v: string) => res?.faltantes.find((f) => `__novo__${f.ref}|${norm(f.nome)}` === v)?.nome ?? v.split('|')[1]
  const erros = res?.problemas.filter((p) => p.nivel === 'erro') ?? []
  const avisos = res?.problemas.filter((p) => p.nivel === 'aviso') ?? []
  const previa = res?.itens.slice(0, 8) ?? []

  return (
    <Modal
      title={`Importar planilha — ${m.title}`}
      onClose={onClose}
      foot={
        feito ? (
          <>
            <button className="btn danger" disabled={busy} onClick={() => void desfazer()}>
              Desfazer importação
            </button>
            <span className="grow" />
            <button className="btn primary" onClick={onClose}>
              Concluir
            </button>
          </>
        ) : (
          <>
            <span className="grow small muted">{nome}</span>
            <button className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn primary" disabled={!res?.itens.length || busy} onClick={() => void importar()}>
              {busy ? 'Importando…' : `Importar ${res?.itens.length ?? 0} registro(s)`}
            </button>
          </>
        )
      }
    >
      <div className="imp">
        {feito ? (
          <div className="imp-ok">
            <b>✓ {feito.total} registro(s) importado(s) em {m.title}.</b>
            {feito.criados.map((c) => (
              <span key={c.col} className="small">
                + {c.n} cadastro(s) criado(s) em {MOD[c.col]?.title ?? c.col}
              </span>
            ))}
            <span className="small muted">Conferiu e algo saiu errado? “Desfazer importação” apaga exatamente o que entrou agora.</span>
          </div>
        ) : (
          <>
            <ol className="imp-passos">
              <li>
                <b>Baixe o modelo</b> desta tela, já com as colunas, a explicação de cada uma e listas de escolha.
                <div>
                  <button className="btn sm" onClick={() => baixarModelo(col)}>
                    <Icon name="download" size={14} /> Baixar modelo (Excel)
                  </button>
                </div>
              </li>
              <li>
                <b>Preencha</b> a aba “Dados” — uma linha por registro (pode colar o histórico de outra planilha).
              </li>
              <li>
                <b>Envie o arquivo</b> (.xlsx ou .csv) e confira antes de gravar.
                <div>
                  <button className="btn sm primary" onClick={() => arq.current?.click()}>
                    <Icon name="upload" size={14} /> {bruto ? 'Trocar arquivo' : 'Escolher arquivo'}
                  </button>
                  <input ref={arq} type="file" hidden accept=".xlsx,.csv,text/csv" onChange={(e) => (void escolher(e.target.files?.[0]), (e.target.value = ''))} />
                </div>
              </li>
            </ol>
            {erro && <div className="neg small">{erro}</div>}
            {res && (
              <div className="imp-conf">
                <div className="row">
                  <span className="chip ok">{res.itens.length} prontos</span>
                  {res.linhasComErro > 0 && <span className="chip bad">{res.linhasComErro} linha(s) com erro (não entram)</span>}
                  {avisos.length > 0 && <span className="chip warn">{avisos.length} aviso(s)</span>}
                  {res.faltantes.length > 0 && <span className="chip info">{res.faltantes.length} cadastro(s) novo(s)</span>}
                </div>
                <label className="row small" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={criar} onChange={(e) => setCriar(e.target.checked)} /> Criar automaticamente pessoas, projetos, etiquetas etc. que ainda não existem
                  {res.faltantes.length > 0 && criar && <span className="muted">({res.faltantes.slice(0, 4).map((f) => f.nome).join(', ')}{res.faltantes.length > 4 ? '…' : ''})</span>}
                </label>
                <span className="small muted">
                  Colunas reconhecidas: {res.mapa.map((x) => x.f.label).join(', ') || '—'}
                  {res.ignoradas.length > 0 && <span className="neg"> · ignoradas: {res.ignoradas.join(', ')}</span>}
                </span>
                {(erros.length > 0 || avisos.length > 0) && (
                  <div className="imp-prob">
                    {[...erros, ...avisos].slice(0, 60).map((p, i) => (
                      <div key={i} className={p.nivel === 'erro' ? 'neg' : ''}>
                        {p.linha > 1 ? `Linha ${p.linha}: ` : ''}
                        {p.msg}
                      </div>
                    ))}
                    {erros.length + avisos.length > 60 && <div className="muted">… e mais {erros.length + avisos.length - 60}</div>}
                  </div>
                )}
                {previa.length > 0 && (
                  <div className="table-wrap imp-previa">
                    <table>
                      <thead>
                        <tr>
                          {res.mapa.slice(0, 7).map((x) => (
                            <th key={x.f.key}>{x.f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previa.map((it) => (
                          <tr key={it.id}>
                            {res.mapa.slice(0, 7).map((x) => (
                              <td key={x.f.key}>{String(it[x.f.key] ?? '').startsWith('__novo__') ? `${nomeNovo(String(it[x.f.key]))} (novo)` : cellText(col, x.f.key, it)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {res.itens.length > previa.length && <div className="small muted" style={{ padding: 6 }}>Prévia das primeiras {previa.length} de {res.itens.length} linhas.</div>}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
