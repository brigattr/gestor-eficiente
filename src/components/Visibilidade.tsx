import { useConta } from '../lib/conta'
import { PESSOAL } from '../shared/visibilidade'

/** Etiqueta "Pessoal" ou "Da empresa" (só no plano Empresa, onde cada um tem a própria visão). */
export function EtiquetaVisao({ col, compacta }: { col: string; compacta?: boolean }) {
  const conta = useConta()
  if (conta?.plano !== 'empresa' || col === 'usuarios') return null
  const pessoal = PESSOAL.has(col)
  return (
    <span className={`visao-tag ${pessoal ? 'pessoal' : 'empresa'}`} title={pessoal ? 'Cada registro só aparece para quem criou, para quem foi designado (responsável, aprovador, etapa, aguardando, convidado) e para quem recebeu em “Compartilhar com”.' : 'Todos os usuários da conta veem os registros desta tela.'}>
      {pessoal ? '🔒 Pessoal' : '🏢 Da empresa'}
      {!compacta && <span className="visao-tag-txt">{pessoal ? ' — só você e quem você designar ou compartilhar' : ' — todos da conta veem'}</span>}
    </span>
  )
}
