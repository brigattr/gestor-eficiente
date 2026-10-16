// Ferramentas visíveis no menu lateral. Configuração da instalação (vale para todos os usuários),
// guardada na coleção "sistema" (id "menu"). Só o administrador altera.
import { NAV } from '../nav'
import type { DB } from '../data/store'

/** Itens que nunca podem ser ocultados (senão ninguém volta para religar). */
export const FIXOS = new Set(['', 'configuracoes', 'usuarios'])
export const ETIQUETAS = 'etiquetas' // grupo "Etiquetas" (fica fora do NAV)

export function menuOcultos(db: DB): Set<string> {
  const v = (db.sistema ?? []).find((x) => x.id === 'menu')?.ocultos
  return new Set(Array.isArray(v) ? (v as string[]).filter((p) => !FIXOS.has(p)) : [])
}

/** Caminho visível? (também usado para esconder alertas e eventos de ferramentas desligadas) */
export const visivel = (db: DB, path: string) => !menuOcultos(db).has(path)

export function navVisivel(db: DB) {
  const ocultos = menuOcultos(db)
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => !ocultos.has(i.path)) })).filter((g) => g.items.length > 0 || g.group === 'Visão')
}
