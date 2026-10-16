// Tarefas recorrentes: ao concluir uma tarefa com "Repetir", cria a próxima ocorrência.
import { aoSalvar, upsert, type Item } from '../data/store'
import { isDone } from './alerts'
import { iso, parseISO, todayISO } from './format'

function avancar(data: string, rec: string): string {
  const d = parseISO(data) ?? new Date()
  if (rec.startsWith('Diária')) {
    do d.setDate(d.getDate() + 1)
    while (d.getDay() === 0 || d.getDay() === 6)
  } else if (rec === 'Semanal') d.setDate(d.getDate() + 7)
  else if (rec === 'Quinzenal') d.setDate(d.getDate() + 14)
  else {
    const meses = rec === 'Mensal' ? 1 : rec === 'Trimestral' ? 3 : 12
    const dia = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + meses)
    d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  }
  return iso(d)
}

aoSalvar((col, antes, depois) => {
  if (col !== 'tarefas') return
  const rec = String(depois.recorrencia ?? '')
  if (!rec || rec === 'Não repete' || depois.proximaGerada) return
  if (!isDone('tarefas', depois) || (antes && isDone('tarefas', antes))) return
  const base = String(depois.prazo || todayISO())
  const prazo = avancar(base, rec)
  const deslocar = (v: unknown) => (typeof v === 'string' && v ? avancar(v, rec) : null)
  const {
    id: _id,
    _created: _c,
    _createdBy: _cb,
    _updated: _u,
    _updatedBy: _ub,
    status: _s,
    comentarios: _com,
    ...resto
  } = depois as Item
  upsert('tarefas', {
    ...resto,
    status: 'A fazer',
    prazo,
    followup: deslocar(depois.followup),
    checklist: typeof depois.checklist === 'string' ? depois.checklist.replace(/^\s*\[x\]/gim, '[ ]') : depois.checklist,
    proximaGerada: false,
    origemRecorrencia: depois.id,
  })
  upsert('tarefas', { id: depois.id, proximaGerada: true })
})
