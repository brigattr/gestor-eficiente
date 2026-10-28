// Projetos × tarefas: as subatividades de um projeto são tarefas com o campo "projeto".
// Quando uma tarefa do projeto muda, o progresso do projeto é recalculado (se estiver no automático).
import { aoSalvar, get, getDB, list, upsert } from '../data/store'
import { isDone } from './alerts'

/** "3/8" para a lista e o Kanban de projetos (null quando não há tarefas). */
export function progressoTarefas(projetoId: string) {
  const ts = (getDB().tarefas ?? []).filter((t) => t.projeto === projetoId)
  return ts.length ? `${ts.filter((t) => isDone('tarefas', t)).length}/${ts.length}` : null
}

export function recalcularProjeto(projetoId: unknown) {
  if (typeof projetoId !== 'string' || !projetoId) return
  const p = get('projetos', projetoId)
  if (!p || p.progressoAuto === false) return
  const ts = list('tarefas').filter((t) => t.projeto === projetoId)
  if (!ts.length) return
  const pct = Math.round((ts.filter((t) => isDone('tarefas', t)).length / ts.length) * 100)
  if (Number(p.progresso) !== pct) upsert('projetos', { id: projetoId, progresso: pct })
}

aoSalvar((col, antes, depois) => {
  if (col !== 'tarefas') return
  recalcularProjeto(depois.projeto)
  if (antes?.projeto && antes.projeto !== depois.projeto) recalcularProjeto(antes.projeto) // tarefa mudou de projeto
})
