import { useState } from 'react'
import { list, upsert, useDB, type DB, type Item } from '../data/store'
import { isDone } from '../lib/alerts'
import { progressoEtapas } from '../lib/etapas'
import { fmtDate, label, todayISO } from '../lib/format'
import { Icon } from './Icon'
import { openEditorPorCima } from './ItemForm'

// Tarefas de um projeto: as subatividades do projeto são tarefas comuns (menu Tarefas) com o campo Projeto.

const tarefasDoProjeto = (db: DB, projetoId: string) => (db.tarefas ?? []).filter((t) => t.projeto === projetoId)

const ordenar = (a: Item, b: Item) => Number(isDone('tarefas', a)) - Number(isDone('tarefas', b)) || String(a.prazo || '9999').localeCompare(String(b.prazo || '9999'))

export function TarefasDoProjeto({ projetoId, respPadrao }: { projetoId?: string; respPadrao?: string }) {
  const db = useDB()
  const pessoas = list('pessoas').filter((p) => p.status !== 'Desligado')
  const [titulo, setTitulo] = useState('')
  const [resp, setResp] = useState(respPadrao ?? '')
  const [prazo, setPrazo] = useState('')
  const [verFeitas, setVerFeitas] = useState(false)

  if (!projetoId)
    return (
      <div className="wide et">
        <b>Tarefas do projeto</b>
        <span className="small muted">Salve o projeto para quebrá-lo em tarefas (elas aparecem também no menu Tarefas, no Calendário e nos avisos).</span>
      </div>
    )

  const ts = tarefasDoProjeto(db, projetoId).sort(ordenar)
  const abertas = ts.filter((t) => !isDone('tarefas', t))
  const feitas = ts.filter((t) => isDone('tarefas', t))
  const hoje = todayISO()

  function adicionar() {
    const t = titulo.trim()
    if (!t) return
    upsert('tarefas', { titulo: t, projeto: projetoId, responsavel: resp || null, prazo: prazo || null, status: 'A fazer', delegacao: 'Minha', recorrencia: 'Não repete' })
    setTitulo('')
    setPrazo('')
  }
  const marcar = (t: Item) => upsert('tarefas', { id: t.id, status: isDone('tarefas', t) ? 'A fazer' : 'Concluída' })

  const linha = (t: Item) => {
    const feita = isDone('tarefas', t)
    const atrasada = !feita && typeof t.prazo === 'string' && t.prazo < hoje
    const etapas = progressoEtapas(t.etapas)
    const meta = [t.responsavel ? label('pessoas', db.pessoas?.find((p) => p.id === t.responsavel)) : null, t.prazo ? fmtDate(t.prazo) : null, feita ? null : String(t.status ?? ''), etapas ? `etapas ${etapas}` : null].filter(Boolean).join(' · ')
    return (
      <div key={t.id} className={`et-item ${feita ? 'feita' : ''}`}>
        <button type="button" className={`et-check ${feita ? 'on' : ''}`} onClick={() => marcar(t)} title={feita ? 'Reabrir tarefa' : 'Concluir tarefa'}>
          {feita ? '✓' : ''}
        </button>
        <div className="et-corpo" style={{ cursor: 'pointer' }} onClick={() => openEditorPorCima('tarefas', t.id)} title="Abrir a tarefa (ao fechar, volta para o projeto)">
          <span className="et-texto">{String(t.titulo || '(sem título)')}</span>
          {meta && <span className={`small ${atrasada ? 'neg' : 'muted'}`}>{meta}{atrasada ? ' · atrasada' : ''}</span>}
        </div>
        <Icon name="chevronR" size={14} />
      </div>
    )
  }

  return (
    <div className="wide et">
      <div className="et-head">
        <b>Tarefas do projeto</b>
        {ts.length > 0 && (
          <span className="small muted">
            {feitas.length} de {ts.length} concluída(s)
          </span>
        )}
        {ts.length > 0 && (
          <span className="et-barra" aria-hidden>
            <span style={{ width: `${(feitas.length / ts.length) * 100}%` }} />
          </span>
        )}
      </div>
      <div className="et-nova">
        <input
          className="et-oque"
          placeholder="Nova tarefa do projeto — ex.: Levantar requisitos com TI"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              adicionar()
            }
          }}
        />
        <select value={resp} onChange={(e) => setResp(e.target.value)} title="Responsável">
          <option value="">Responsável —</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {String(p.nome)}
            </option>
          ))}
        </select>
        <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} title="Prazo" />
        <button type="button" className="btn primary sm" onClick={adicionar} disabled={!titulo.trim()}>
          <Icon name="plus" size={14} /> Adicionar
        </button>
      </div>
      {abertas.length > 0 && (
        <div className="et-lista">
          <span className="small muted et-sub">○ Em aberto ({abertas.length})</span>
          {abertas.map(linha)}
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
      {!ts.length && <span className="small muted">Quebre o projeto em tarefas. Cada uma vira uma tarefa normal (menu Tarefas, Calendário, avisos, etapas) e o progresso do projeto é calculado por elas.</span>}
    </div>
  )
}
