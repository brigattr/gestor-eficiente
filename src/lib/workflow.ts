// Workflow de delegação: tudo em que uma pessoa é Responsável, Aprovador, Backup, Titular,
// Instrutor ou Líder (em qualquer tela) vira pendência dela; quem delegou acompanha o aceite.
// Depende do vínculo Usuário → Pessoa do Time (tela Usuários).
import { MODULES, MOD } from '../data/schema'
import { aoSalvar, getDB, list, upsert, type DB, type Item } from '../data/store'
import { isDone } from './alerts'
import { etapasDe } from './etapas'
import { label } from './format'
import { visivel } from './menu'
import { getUser } from './session'

/** Papéis que significam "isto é com você". */
export const PAPEIS = new Set(['responsavel', 'aprovador', 'backup', 'titular', 'instrutor', 'lider'])

export type Atribuicao = { chave: string; col: string; path: string; modulo: string; item: Item; titulo: string; papel: string; prazo?: string; status?: string; feito: boolean; quem?: string; etapa?: string }

/** Pessoa do Time vinculada ao usuário logado (ou null). */
export function minhaPessoa(db: DB = getDB()): string | null {
  const u = getUser()
  const p = u ? (db.usuarios ?? []).find((x) => x.id === u.id)?.pessoa : null
  return typeof p === 'string' && p ? p : null
}

const prazoDe = (col: string, it: Item) => {
  for (const d of MOD[col]?.dates ?? []) if (typeof it[d.field] === 'string' && it[d.field]) return String(it[d.field]).slice(0, 10)
  return undefined
}

/** Tudo que está com a pessoa (inclui etapas de tarefas em que ela é a responsável). */
export function atribuicoes(db: DB, pessoa: string): Atribuicao[] {
  const out: Atribuicao[] = []
  for (const m of MODULES) {
    const campos = m.fields.filter((f) => f.type === 'ref' && f.ref === 'pessoas' && PAPEIS.has(f.key))
    if (!campos.length || !visivel(db, m.path)) continue
    for (const it of db[m.col] ?? []) {
      for (const f of campos) {
        if (it[f.key] !== pessoa) continue
        const sf = m.statusField
        out.push({ chave: `${m.col}:${it.id}:${f.key}`, col: m.col, path: m.path, modulo: m.title, item: it, titulo: label(m.col, it), papel: f.label, prazo: prazoDe(m.col, it), status: sf ? String(it[sf] ?? '') : undefined, feito: isDone(m.col, it), quem: String(it._updatedBy ?? it._createdBy ?? '') })
      }
      if (m.col === 'tarefas' && !isDone('tarefas', it))
        for (const e of etapasDe(it.etapas))
          if (e.resp === pessoa && it.responsavel !== pessoa)
            out.push({ chave: `etapa:${it.id}:${e.id}`, col: 'tarefas', path: 'tarefas', modulo: 'Etapa de tarefa', item: it, titulo: e.texto, etapa: label('tarefas', it), papel: 'Responsável pela etapa', prazo: e.data, feito: !!e.feita, quem: String(it._updatedBy ?? '') })
    }
  }
  return out
}

/** O que eu (usuário logado) passei para outras pessoas e ainda está em aberto. */
export function delegadasPorMim(db: DB, pessoa: string | null): Atribuicao[] {
  const eu = getUser()?.nome
  if (!eu) return []
  const out: Atribuicao[] = []
  for (const m of MODULES) {
    const campos = m.fields.filter((f) => f.type === 'ref' && f.ref === 'pessoas' && PAPEIS.has(f.key) && f.key !== 'backup')
    if (!campos.length || !visivel(db, m.path)) continue
    for (const it of db[m.col] ?? []) {
      if (it._createdBy !== eu || isDone(m.col, it)) continue
      for (const f of campos) {
        const quem = it[f.key]
        if (typeof quem !== 'string' || !quem || quem === pessoa) continue
        out.push({ chave: `${m.col}:${it.id}:${f.key}`, col: m.col, path: m.path, modulo: m.title, item: it, titulo: label(m.col, it), papel: `${f.label}: ${label('pessoas', (db.pessoas ?? []).find((p) => p.id === quem))}`, prazo: prazoDe(m.col, it), status: m.statusField ? String(it[m.statusField] ?? '') : undefined, feito: false })
      }
    }
  }
  return out
}

// ── o que eu já vi (para o aviso de "novas atribuições" aparecer uma vez só, por aparelho)
const chaveVistos = () => `wf:vistos:${getUser()?.id ?? ''}`
export function vistos(): Set<string> | null {
  try {
    const v = localStorage.getItem(chaveVistos())
    return v ? new Set(JSON.parse(v) as string[]) : null
  } catch {
    return new Set()
  }
}
export function marcarVistos(chaves: string[]) {
  try {
    const atual = vistos() ?? new Set<string>()
    for (const c of chaves) atual.add(c)
    localStorage.setItem(chaveVistos(), JSON.stringify([...atual].slice(-3000)))
  } catch {
    /* sem armazenamento: o aviso pode reaparecer */
  }
}

/** Atribuições novas para mim, feitas por outra pessoa e ainda não vistas neste aparelho. */
export function novasParaMim(db: DB): Atribuicao[] {
  const pessoa = minhaPessoa(db)
  const eu = getUser()?.nome
  if (!pessoa || !eu) return []
  const minhas = atribuicoes(db, pessoa).filter((a) => !a.feito)
  const v = vistos()
  if (v === null) {
    // primeiro uso neste aparelho: o que já existia não vira aviso
    marcarVistos(minhas.map((a) => a.chave))
    return []
  }
  return minhas.filter((a) => !v.has(a.chave) && a.quem !== eu)
}

// Tarefa passada para outra pessoa fica "Delegada – pendente" até ela aceitar ou recusar.
aoSalvar((col, antes, depois) => {
  if (col !== 'tarefas' || !depois.responsavel || antes?.responsavel === depois.responsavel) return
  const minha = minhaPessoa()
  if (!minha) return
  const atual = String(depois.delegacao ?? '')
  if (depois.responsavel !== minha && (!atual || atual === 'Minha' || atual.includes('recusada'))) upsert('tarefas', { id: depois.id, delegacao: 'Delegada – pendente' })
  else if (depois.responsavel === minha && atual.startsWith('Delegada')) upsert('tarefas', { id: depois.id, delegacao: 'Minha' })
})

export const pessoasSemUsuario = () => list('pessoas').filter((p) => !list('usuarios').some((u) => u.pessoa === p.id))
