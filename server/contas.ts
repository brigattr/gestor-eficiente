/// <reference types="@cloudflare/workers-types" />
import { PAPEIS_PESSOA, PESSOAL } from '../src/shared/visibilidade'
// Contas (clientes) e visibilidade por usuário.
// Cada cliente é uma conta (Individual ou Empresa); todos os dados ficam carimbados com conta_id.
// Dentro de uma conta Empresa, cada registro "pessoal" tem dono (_dono) e só aparece para quem:
//  é o dono, foi designado (Responsável, Aprovador, Backup, Titular, Instrutor, Líder, Aguardando),
//  está numa etapa, foi convidado, recebeu compartilhamento (compartilhado), é o próprio colaborador (em telas de RH dele)
//  ou é o gestor direto do dono, quando a empresa liga "gestor vê tudo da equipe".

export type Conta = { id: string; nome: string; plano: 'individual' | 'empresa'; modulos: string[] | null; ativo: number; opcoes: { gestorVeEquipe?: boolean } }

export { PESSOAL }
/** Telas de RH/canais sensíveis: além do dono, o Administrador da empresa vê tudo (faz o papel de RH). */
const ADMIN_VE = new Set(['ouvidoria', 'relatosPsico', 'ocorrencias', 'avaliacoes', 'admissoes', 'holerites', 'beneficios', 'exames', 'ponto', 'onboarding', 'checkinsBemEstar'])
/** Campos com várias pessoas que também dão visibilidade (convidados de reunião). */
const VARIAS = ['convidados', 'compartilhado']
/** Em que telas o próprio colaborador vê os registros dele (campo "colaborador"). */
const COLABORADOR_VE = new Set(['ponto', 'pdis', 'onboarding', 'holerites', 'beneficios', 'exames', 'feedbacks', 'incentivos'])
const PAPEIS = PAPEIS_PESSOA
/** Campos de remuneração escondidos do perfil Colaborador. */
const SENSIVEIS: Record<string, RegExp> = { pessoas: /salari|remunera|bonus/i, cargos: /salari|faixa|piso|teto|remunera/i }

export type Ctx = {
  conta: Conta
  userId: string
  pessoa: string | null
  papel: string
  /** usuário (id) → pessoa do Time, e pessoa → gestor imediato (para "gestor vê a equipe") */
  pessoaDe: Map<string, string | null>
  gestorDe: Map<string, string | null>
}

/** Este usuário pode ver este registro? */
export function podeVer(ctx: Ctx, col: string, d: Record<string, unknown>): boolean {
  if (ctx.conta.plano !== 'empresa' || !PESSOAL.has(col)) return true
  const dono = d._dono
  if (typeof dono !== 'string' || !dono) return true // registro antigo, de antes das contas
  if (dono === ctx.userId) return true
  if (ctx.papel === 'Administrador' && ADMIN_VE.has(col)) return true
  const eu = ctx.pessoa
  if (eu) {
    for (const k of PAPEIS) if (d[k] === eu) return true
    if (COLABORADOR_VE.has(col) && d.colaborador === eu) return true
    for (const k of VARIAS) if (Array.isArray(d[k]) && (d[k] as unknown[]).includes(eu)) return true
    if (Array.isArray(d.etapas) && d.etapas.some((e) => (e as { resp?: string })?.resp === eu)) return true
    if (ctx.conta.opcoes?.gestorVeEquipe) {
      const pDono = ctx.pessoaDe.get(dono)
      if (pDono && ctx.gestorDe.get(pDono) === eu) return true
    }
  }
  return false
}

/** Remove o que o perfil não deve ver (remuneração para Colaborador). */
export function filtrarCampos(ctx: Ctx, col: string, d: Record<string, unknown>) {
  const re = SENSIVEIS[col]
  if (!re || ctx.papel !== 'Colaborador') return d
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(d)) if (!re.test(k)) out[k] = v
  return out
}

export const lerConta = (r: { id: string; nome: string; plano: string; modulos: string | null; ativo: number; opcoes: string | null }): Conta => ({
  id: r.id,
  nome: r.nome,
  plano: r.plano === 'individual' ? 'individual' : 'empresa',
  modulos: r.modulos ? (JSON.parse(r.modulos) as string[]) : null,
  ativo: r.ativo,
  opcoes: r.opcoes ? (JSON.parse(r.opcoes) as Conta['opcoes']) : {},
})

/** Chave do conteúdo do anexo no R2: a conta principal mantém as chaves antigas. */
export const chaveArquivo = (conta: string, id: string) => (conta === 'c1' ? id : `${conta}/${id}`)
