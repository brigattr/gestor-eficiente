import { aplicar, setDB, setOnFalha, type DB, type Item } from '../data/store'
import { api, servidor, setOnUnauthorized } from './api'
import { applyFileChanges, setFileIndex, type FileMeta } from './files'
import { getUser, setUser, type SessionUser } from './session'

// Modo servidor: carrega tudo após o login e busca alterações feitas em outros
// computadores a cada 30 s e sempre que a janela volta ao foco.

let desde = ''
let timer: ReturnType<typeof setInterval> | undefined
let carregando: Promise<void> | null = null

export async function carregarServidor() {
  carregando ??= (async () => {
    try {
      const r = await api<{ db: DB; files: FileMeta[]; now: string; user: SessionUser }>('/data')
      setDB(r.db)
      setFileIndex(r.files)
      setUser(r.user)
      desde = r.now
      iniciarSync()
      void sincronizarOutlook()
    } finally {
      carregando = null
    }
  })()
  return carregando
}

async function buscarMudancas() {
  if (!getUser() || !desde || document.hidden) return
  try {
    const r = await api<{ items: { col: string; id: string; data: Item | null }[]; files: (FileMeta & { deleted?: boolean })[]; usuarios: Item[]; now: string; user: SessionUser }>(`/changes?since=${encodeURIComponent(desde)}`)
    for (const c of r.items) aplicar(c.col, c.data, c.id)
    for (const u of r.usuarios) aplicar('usuarios', u)
    applyFileChanges(r.files)
    const eu = getUser()
    if (eu && (eu.papel !== r.user.papel || eu.nome !== r.user.nome)) setUser(r.user)
    desde = r.now
  } catch {
    /* sem conexão: tenta de novo no próximo ciclo */
  }
}

/** Busca agora as alterações do servidor (ex.: depois de sincronizar o Outlook). */
export async function sincronizarAgora() {
  await buscarMudancas()
}

/** Ao abrir o sistema: atualiza o calendário do Outlook se a última sincronização tem mais de 1 h. */
async function sincronizarOutlook() {
  try {
    const st = await api<{ configurado: boolean }>('/calendar')
    if (!st.configurado || getUser()?.papel === 'Leitura') return
    const r = await api<{ pulado?: boolean }>('/calendar/sync?seAntigo=1', { method: 'POST' })
    if (!r.pulado) await buscarMudancas()
  } catch {
    /* erro fica registrado no status do calendário */
  }
}

function iniciarSync() {
  if (timer) return
  timer = setInterval(buscarMudancas, 30_000)
  window.addEventListener('focus', () => void buscarMudancas())
  document.addEventListener('visibilitychange', () => !document.hidden && void buscarMudancas())
}

export function encerrarSync() {
  clearInterval(timer)
  timer = undefined
  desde = ''
  setDB({})
  setFileIndex([])
}

export function configurarServidor() {
  if (!servidor()) return
  setOnUnauthorized(() => {
    encerrarSync()
    setUser(null)
  })
  setOnFalha(() => void carregarServidor().catch(() => undefined))
}
