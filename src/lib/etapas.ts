// Etapas (subtarefas) guardadas no campo "etapas" da tarefa.
export type Etapa = { id: string; texto: string; tipo?: string; data?: string; hora?: string; resp?: string; feita?: boolean; feitaEm?: string; feitaPor?: string }

export const etapasDe = (v: unknown): Etapa[] => (Array.isArray(v) ? (v as Etapa[]) : [])

/** "2/5" para a lista e o Kanban (null quando a tarefa não tem etapas). */
export function progressoEtapas(v: unknown) {
  const es = etapasDe(v)
  return es.length ? `${es.filter((e) => e.feita).length}/${es.length}` : null
}
