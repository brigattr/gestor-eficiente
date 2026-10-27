// Avisos na tela (computador e celular) para tarefas e vencimentos do dia.
// Usa as notificações do navegador/app instalado: funcionam com o sistema aberto
// (mesmo em outra aba ou minimizado). No iPhone/iPad, só com o app na tela de início.

import { MOD } from '../data/schema'
import type { DB, Item } from '../data/store'
import { isDone } from './alerts'
import { etapasDe } from './etapas'
import { label, todayISO } from './format'
import { visivel } from './menu'

const K_ATIVO = 'notif:ativo'
const K_ENVIADAS = 'notif:enviadas'

export const suportado = () => typeof window !== 'undefined' && 'Notification' in window

export function estado(): 'sem-suporte' | 'negado' | 'ativo' | 'desligado' {
  if (!suportado()) return 'sem-suporte'
  if (Notification.permission === 'denied') return 'negado'
  return Notification.permission === 'granted' && ler(K_ATIVO) === '1' ? 'ativo' : 'desligado'
}

function ler(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function gravar(k: string, v: string) {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* navegador sem armazenamento: avisa de novo na próxima vez */
  }
}

let registro: Promise<ServiceWorkerRegistration | null> | null = null
export function registrarSW() {
  registro ??= 'serviceWorker' in navigator ? navigator.serviceWorker.register('./sw.js').catch(() => null) : Promise.resolve(null)
  return registro
}

async function mostrar(titulo: string, corpo: string, tag: string, url: string) {
  const opts: NotificationOptions = { body: corpo, tag, icon: './icon-192.png', badge: './icon-192.png', data: { url } }
  const reg = await registrarSW()
  if (reg) return reg.showNotification(titulo, opts)
  const n = new Notification(titulo, opts)
  n.onclick = () => {
    window.focus()
    location.hash = url.replace(/^\.\//, '')
    n.close()
  }
}

/** Liga os avisos neste aparelho (precisa ser chamado por um clique do usuário). */
export async function ativar() {
  if (!suportado()) return 'sem-suporte' as const
  const p = await Notification.requestPermission()
  if (p !== 'granted') return estado()
  gravar(K_ATIVO, '1')
  await registrarSW()
  await mostrar('Avisos ativados', 'Você será avisado aqui das tarefas e vencimentos do dia.', 'teste', './#/tarefas')
  return estado()
}

export function desativar() {
  gravar(K_ATIVO, '0')
}

type Aviso = { chave: string; titulo: string; corpo: string; url: string }

/** O que vence hoje: prazos e follow-ups de tarefas e vencimentos de contratos. */
export function avisosDeHoje(db: DB): Aviso[] {
  const hoje = todayISO()
  const out: Aviso[] = []
  const P = (id: unknown) => (id ? label('pessoas', (db.pessoas ?? []).find((p) => p.id === id) as Item) : '')
  if (visivel(db, MOD.tarefas.path)) {
    for (const t of db.tarefas ?? []) {
      if (isDone('tarefas', t)) continue
      const resp = P(t.responsavel)
      if (String(t.prazo ?? '').slice(0, 10) === hoje) out.push({ chave: `tarefas:${t.id}:prazo:${hoje}`, titulo: 'Tarefa vence hoje', corpo: `${t.titulo}${resp ? ` — ${resp}` : ''}`, url: './#/tarefas' })
      for (const e of etapasDe(t.etapas))
        if (!e.feita && e.data === hoje) out.push({ chave: `etapa:${t.id}:${e.id}:${hoje}`, titulo: 'Etapa para hoje', corpo: `${e.hora ? e.hora + ' — ' : ''}${e.texto} (${t.titulo})`, url: './#/tarefas' })
      if (String(t.followup ?? '').slice(0, 10) === hoje) out.push({ chave: `tarefas:${t.id}:followup:${hoje}`, titulo: 'Follow-up hoje', corpo: `${t.titulo}${t.aguardando ? ` (aguardando ${t.aguardando})` : ''}`, url: './#/tarefas' })
    }
  }
  if (visivel(db, 'contratos')) {
    for (const c of db.contratos ?? []) {
      if (isDone('contratos', c) || String(c.vencimento ?? '').slice(0, 10) !== hoje) continue
      out.push({ chave: `contratos:${c.id}:${hoje}`, titulo: 'Vence hoje', corpo: `${c.tipo ? c.tipo + ': ' : ''}${c.item}`, url: './#/contratos' })
    }
  }
  return out
}

/** Mostra os avisos de hoje que ainda não foram mostrados neste aparelho. */
export async function verificar(db: DB) {
  if (estado() !== 'ativo') return
  const hoje = todayISO()
  let enviadas: string[] = []
  try {
    enviadas = (JSON.parse(ler(K_ENVIADAS) ?? '[]') as string[]).filter((k) => k.endsWith(hoje))
  } catch {
    enviadas = []
  }
  const novos = avisosDeHoje(db).filter((a) => !enviadas.includes(a.chave))
  if (!novos.length) return
  // muitos de uma vez viram um resumo, para não encher a tela
  if (novos.length > 3) {
    await mostrar(`${novos.length} itens vencem hoje`, novos.slice(0, 4).map((a) => '• ' + a.corpo).join('\n') + (novos.length > 4 ? '\n…' : ''), 'resumo-' + hoje, './#/tarefas')
  } else {
    for (const a of novos) await mostrar(a.titulo, a.corpo, a.chave, a.url)
  }
  gravar(K_ENVIADAS, JSON.stringify([...enviadas, ...novos.map((a) => a.chave)]))
}
