import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { upsert, useDB } from '../data/store'
import { fmtDate } from '../lib/format'
import { notificar } from '../lib/notificacoes'
import { marcarVistos, novasParaMim } from '../lib/workflow'
import { openEditor } from './ItemForm'
import { Modal } from './ui'

/** Janela que aparece quando alguém passa algo para você (tarefa, aprovação, plano de ação…). */
export function AvisoAtribuicoes() {
  const db = useDB()
  const nav = useNavigate()
  const [tick, setTick] = useState(0)
  const novas = useMemo(() => novasParaMim(db), [db, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const [fechado, setFechado] = useState<string>('')
  const avisadas = useRef(new Set<string>())
  const assinatura = novas.map((n) => n.chave).join('|')

  // aviso do navegador/celular (se o sino estiver ativo), uma vez por atribuição
  useEffect(() => {
    for (const n of novas) {
      if (avisadas.current.has(n.chave)) continue
      avisadas.current.add(n.chave)
      void notificar('Nova atribuição para você', `${n.titulo} — ${n.modulo}${n.quem ? ` (por ${n.quem})` : ''}`)
    }
  }, [assinatura]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!novas.length || fechado === assinatura) return null
  const ciente = (chaves: string[]) => (marcarVistos(chaves), setTick((x) => x + 1))
  return (
    <Modal
      title={novas.length === 1 ? 'Nova atribuição para você' : `${novas.length} novas atribuições para você`}
      onClose={() => setFechado(assinatura)}
      foot={
        <>
          <button className="btn" onClick={() => (setFechado(assinatura), nav('/pendencias'))}>
            Ver minhas pendências
          </button>
          <span className="grow" />
          <button className="btn primary" onClick={() => ciente(novas.map((n) => n.chave))}>
            Ciente de todas
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 8 }}>
        {novas.slice(0, 12).map((n) => {
          const pendente = n.col === 'tarefas' && !n.etapa && String(n.item.delegacao ?? '') === 'Delegada – pendente'
          return (
            <div key={n.chave} className="pd-item">
              <div className="pd-corpo">
                <b>{n.titulo}</b>
                <span className="small muted">
                  {n.etapa ? `Etapa de “${n.etapa}”` : n.modulo} · {n.papel}
                  {n.prazo ? ` · prazo ${fmtDate(n.prazo)}` : ''}
                  {n.quem ? ` · por ${n.quem}` : ''}
                </span>
              </div>
              <span className="row" style={{ gap: 4 }}>
                {pendente && (
                  <>
                    <button className="btn sm primary" onClick={() => (upsert('tarefas', { id: n.item.id, delegacao: 'Delegada – aceita' }), ciente([n.chave]))}>
                      Aceitar
                    </button>
                    <button className="btn sm" onClick={() => (upsert('tarefas', { id: n.item.id, delegacao: 'Delegada – recusada' }), ciente([n.chave]))}>
                      Recusar
                    </button>
                  </>
                )}
                <button className="btn sm" onClick={() => (ciente([n.chave]), openEditor(n.col, n.item.id))}>
                  Abrir
                </button>
                {!pendente && (
                  <button className="btn sm ghost" onClick={() => ciente([n.chave])}>
                    Ciente
                  </button>
                )}
              </span>
            </div>
          )
        })}
        {novas.length > 12 && <span className="small muted">… e mais {novas.length - 12} em Minhas pendências.</span>}
      </div>
    </Modal>
  )
}
