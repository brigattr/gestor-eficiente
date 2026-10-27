import { useState } from 'react'
import { list, upsert, uid } from '../data/store'
import { fmtDate, todayISO } from '../lib/format'
import { getUser } from '../lib/session'
import { etapasDe, type Etapa } from '../lib/etapas'

export { etapasDe, type Etapa }
import { Icon } from './Icon'

// Etapas (subtarefas) dentro de uma tarefa: o quê, quando, tipo e quem faz.
// Ficam no próprio registro da tarefa, no campo "etapas".

export const TIPOS_ETAPA: [string, string][] = [
  ['Etapa', '☑'],
  ['Ligação', '📞'],
  ['E-mail', '✉️'],
  ['Reunião', '👥'],
  ['WhatsApp', '💬'],
  ['Documento', '📄'],
]
const icone = (t?: string) => TIPOS_ETAPA.find(([n]) => n === t)?.[1] ?? '☑'

const ordenar = (a: Etapa, b: Etapa) => `${a.data ?? '9999'}${a.hora ?? ''}`.localeCompare(`${b.data ?? '9999'}${b.hora ?? ''}`)

export function EtapasTarefa({ etapas, respPadrao, onChange }: { etapas: Etapa[]; respPadrao?: string; onChange: (es: Etapa[]) => void }) {
  const pessoas = list('pessoas').filter((p) => p.status !== 'Desligado')
  const nomeDe = (id?: string) => (id ? String(pessoas.find((p) => p.id === id)?.nome ?? list('pessoas').find((p) => p.id === id)?.nome ?? '') : '')
  const [texto, setTexto] = useState('')
  const [tipo, setTipo] = useState('Etapa')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [resp, setResp] = useState(respPadrao ?? '')
  const [verFeitas, setVerFeitas] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)

  const pend = etapas.filter((e) => !e.feita).sort(ordenar)
  const feitas = etapas.filter((e) => e.feita)
  const hoje = todayISO()

  function adicionar() {
    const t = texto.trim()
    if (!t) return
    onChange([...etapas, { id: uid(), texto: t, tipo, data: data || undefined, hora: (data && hora) || undefined, resp: resp || undefined }])
    setTexto('')
    setData('')
    setHora('')
  }
  function marcar(e: Etapa, feita: boolean) {
    onChange(etapas.map((x) => (x.id === e.id ? { ...x, feita, feitaEm: feita ? hoje : undefined, feitaPor: feita ? getUser()?.nome : undefined } : x)))
  }
  function excluir(e: Etapa) {
    onChange(etapas.filter((x) => x.id !== e.id))
  }
  function renomear(e: Etapa, t: string) {
    setEditando(null)
    if (t.trim() && t.trim() !== e.texto) onChange(etapas.map((x) => (x.id === e.id ? { ...x, texto: t.trim() } : x)))
  }

  const linha = (e: Etapa) => {
    const atrasada = !e.feita && e.data && e.data < hoje
    const meta = [e.tipo && e.tipo !== 'Etapa' ? e.tipo : null, e.data ? `${fmtDate(e.data)}${e.hora ? ', ' + e.hora : ''}` : null, nomeDe(e.resp) || null].filter(Boolean).join(' · ')
    return (
      <div key={e.id} className={`et-item ${e.feita ? 'feita' : ''}`}>
        <button type="button" className={`et-check ${e.feita ? 'on' : ''}`} onClick={() => marcar(e, !e.feita)} title={e.feita ? 'Reabrir etapa' : 'Concluir etapa'}>
          {e.feita ? '✓' : ''}
        </button>
        <div className="et-corpo">
          {editando === e.id ? (
            <input autoFocus defaultValue={e.texto} onBlur={(x) => renomear(e, x.target.value)} onKeyDown={(x) => x.key === 'Enter' && renomear(e, (x.target as HTMLInputElement).value)} />
          ) : (
            <span className="et-texto" onDoubleClick={() => setEditando(e.id)} title="Duplo clique para editar">
              <span aria-hidden>{icone(e.tipo)} </span>
              {e.texto}
            </span>
          )}
          {(meta || e.feita) && (
            <span className={`small ${atrasada ? 'neg' : 'muted'}`}>
              {meta}
              {atrasada ? ' · atrasada' : ''}
              {e.feita && e.feitaEm ? ` · feita em ${fmtDate(e.feitaEm)}${e.feitaPor ? ' por ' + e.feitaPor : ''}` : ''}
            </span>
          )}
        </div>
        <button type="button" className="btn ghost sm" onClick={() => excluir(e)} title="Excluir etapa">
          <Icon name="trash" size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="wide et">
      <div className="et-head">
        <b>Etapas da tarefa</b>
        {etapas.length > 0 && (
          <span className="small muted">
            {feitas.length} de {etapas.length} concluída(s)
          </span>
        )}
        {etapas.length > 0 && (
          <span className="et-barra" aria-hidden>
            <span style={{ width: `${(feitas.length / etapas.length) * 100}%` }} />
          </span>
        )}
      </div>

      <div className="et-nova">
        <input
          className="et-oque"
          placeholder="Nova etapa — ex.: Cotar com 3 escritórios"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              adicionar()
            }
          }}
        />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} title="Tipo">
          {TIPOS_ETAPA.map(([n, i]) => (
            <option key={n} value={n}>
              {i} {n}
            </option>
          ))}
        </select>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} title="Quando" />
        {data && <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} title="Hora (opcional)" />}
        <select value={resp} onChange={(e) => setResp(e.target.value)} title="Responsável">
          <option value="">Responsável —</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {String(p.nome)}
            </option>
          ))}
        </select>
        <button type="button" className="btn primary sm" onClick={adicionar} disabled={!texto.trim()}>
          <Icon name="plus" size={14} /> Adicionar
        </button>
      </div>

      {pend.length > 0 && (
        <div className="et-lista">
          <span className="small muted et-sub">○ Pendentes ({pend.length})</span>
          {pend.map(linha)}
        </div>
      )}
      {feitas.length > 0 && (
        <div className="et-lista">
          <button type="button" className="linkbtn small et-sub" onClick={() => setVerFeitas(!verFeitas)}>
            {verFeitas ? '▾' : '▸'} Concluídas ({feitas.length})
          </button>
          {verFeitas && feitas.map(linha)}
        </div>
      )}
      {!etapas.length && <span className="small muted">Divida a tarefa em etapas sem precisar criar várias tarefas. Enter adiciona.</span>}
    </div>
  )
}

/** Grava as etapas na hora quando a tarefa já existe (para não perder ao fechar sem salvar). */
export function salvarEtapas(tarefaId: string | undefined, es: Etapa[]) {
  if (tarefaId) upsert('tarefas', { id: tarefaId, etapas: es })
}
