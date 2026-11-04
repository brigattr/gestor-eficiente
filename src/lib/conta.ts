// Conta (cliente) do usuário logado: plano, módulos liberados pelo dono da plataforma e opções da empresa.
// No modo local (sem servidor) não há conta: tudo liberado, como antes.
import { useSyncExternalStore } from 'react'
import { PESSOAL } from '../shared/visibilidade'

export type Conta = { id: string; nome: string; plano: 'individual' | 'empresa'; modulos: string[] | null; opcoes: { gestorVeEquipe?: boolean } }

let atual: Conta | null = null
const subs = new Set<() => void>()
export const getConta = () => atual
export function setConta(c: Conta | null) {
  if (JSON.stringify(c) === JSON.stringify(atual)) return
  atual = c
  subs.forEach((s) => s())
}
export const useConta = () =>
  useSyncExternalStore(
    (l) => (subs.add(l), () => void subs.delete(l)),
    () => atual,
  )

/** Ferramenta (caminho do menu) liberada para a conta pelo dono da plataforma? */
export const liberado = (path: string) => !atual?.modulos || atual.modulos.includes(path)

/** Registros desta tela são pessoais (visíveis só para quem criou, quem foi designado ou com quem foi compartilhado)? */
export const telaPessoal = (col: string) => atual?.plano === 'empresa' && PESSOAL.has(col)
