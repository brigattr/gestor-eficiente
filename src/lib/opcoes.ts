// Opções editáveis dos campos de lista (Field.lista). Ficam na coleção "opcoes", uma linha por lista,
// com id fixo para que dois computadores editando a mesma lista atualizem o mesmo registro.
import type { Field } from '../data/schema'
import { get, upsert } from '../data/store'

const idDe = (lista: string) => 'op_' + lista.replace(/[^a-z0-9]/gi, '_')

/** Opções atuais da lista (as do usuário, se ele já editou; senão as padrão). */
export function opcoesDe(lista: string | undefined, padrao: string[] = []): string[] {
  if (!lista) return padrao
  const v = get('opcoes', idDe(lista))?.valores
  return Array.isArray(v) ? (v as string[]) : padrao
}

export const opcoesCampo = (f: Field) => opcoesDe(f.lista, f.options ?? [])

export function salvarOpcoes(lista: string, valores: string[]) {
  const limpos = [...new Set(valores.map((x) => x.trim()).filter(Boolean))]
  return upsert('opcoes', { id: idDe(lista), lista, valores: limpos })
}
