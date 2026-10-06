import { useSyncExternalStore } from 'react'
import { avisar } from '../components/Dialogs'
import { api, servidor } from '../lib/api'
import { kvGet, kvSet } from '../lib/idb'
import { canWrite, getUser, isAdmin } from '../lib/session'

// Base em memória, persistida de duas formas:
//  • modo servidor (Cloudflare D1): cada gravação vai para a API; acesso de qualquer computador
//  • modo local (IndexedDB): quando não há API (ex.: prévia estática)

export type Item = { id: string; [field: string]: unknown }
export type DB = Record<string, Item[]>

const KEY = 'db'
const LEGACY = 'gestor-eficiente:db:v1' // versão anterior em localStorage
const listeners = new Set<() => void>()
let db: DB = {}
let timer: ReturnType<typeof setTimeout> | undefined
let pending = false

/** Modo local: carrega a base do IndexedDB (migra do localStorage se preciso). */
export async function initStore() {
  if (servidor()) return
  try {
    const saved = await kvGet<DB>(KEY)
    if (saved) db = saved
    else {
      const raw = localStorage.getItem(LEGACY)
      if (raw) {
        db = JSON.parse(raw) as DB
        await kvSet(KEY, db)
        localStorage.removeItem(LEGACY)
      }
    }
  } catch (e) {
    console.error('Falha ao abrir a base local', e)
    avisar('Não foi possível abrir a base local deste navegador. Verifique se o armazenamento de sites está liberado.')
  }
}

async function flush() {
  pending = false
  try {
    await kvSet(KEY, db)
  } catch (e) {
    console.error('Falha ao salvar dados locais', e)
    avisar('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado). Exporte um backup.')
  }
}

function persist() {
  if (servidor()) {
    listeners.forEach((l) => l())
    return
  }
  pending = true
  clearTimeout(timer)
  timer = setTimeout(flush, 120)
  listeners.forEach((l) => l())
}
window.addEventListener('beforeunload', () => {
  if (pending) void flush()
})

function allowed(col: string, item?: Partial<Item>) {
  // usuários: admin gerencia todos; cada um pode alterar o próprio cadastro (exceto o perfil)
  if (col === 'usuarios') return isAdmin() || !(db.usuarios ?? []).length || (!!item?.id && item.id === getUser()?.id && item.papel === undefined)
  if (!canWrite()) {
    avisar('Seu perfil é somente leitura.')
    return false
  }
  return true
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function getDB() {
  return db
}

const EMPTY: Item[] = []
export function list(col: string): Item[] {
  return db[col] ?? EMPTY
}

export function get(col: string, id: string | undefined | null): Item | undefined {
  if (!id) return undefined
  return list(col).find((i) => i.id === id)
}

export function upsert(col: string, item: Partial<Item>): Item | undefined {
  if (!allowed(col, item)) return undefined
  const now = new Date().toISOString()
  const by = getUser()?.nome
  const rows = [...list(col)]
  const idx = item.id ? rows.findIndex((r) => r.id === item.id) : -1
  let saved: Item
  if (idx >= 0) {
    saved = { ...rows[idx], ...item, id: rows[idx].id, _updated: now, _updatedBy: by }
    rows[idx] = saved
  } else {
    saved = { ...item, id: item.id ?? uid(), _created: now, _createdBy: by, _updated: now, _updatedBy: by } as Item
    rows.push(saved)
  }
  db = { ...db, [col]: rows }
  persist()
  if (servidor()) void enviar(col, saved)
  return saved
}

// ── modo servidor: grava na API e aplica a versão confirmada pelo servidor
let erroAvisado = 0
function falhaServidor(msg: string) {
  if (Date.now() - erroAvisado > 4000) avisar(`Não foi possível salvar no servidor: ${msg}`)
  erroAvisado = Date.now()
  onFalha?.()
}
let onFalha: (() => void) | null = null
export const setOnFalha = (f: () => void) => (onFalha = f)

async function enviar(col: string, item: Item) {
  try {
    // autoria e datas são definidas pelo servidor
    const data = Object.fromEntries(Object.entries(item).filter(([k]) => !k.startsWith('_')))
    const r = await api<{ item: Item }>(`/items/${encodeURIComponent(col)}/${encodeURIComponent(item.id)}`, { method: 'PUT', body: data })
    aplicar(col, r.item)
  } catch (e) {
    falhaServidor((e as Error).message)
  }
}

/** Aplica um registro vindo do servidor (null = removido) sem disparar nova gravação. */
export function aplicar(col: string, item: Item | null, id?: string) {
  const rows = list(col)
  const key = item?.id ?? id
  const i = rows.findIndex((r) => r.id === key)
  if (item == null) {
    if (i < 0) return
    db = { ...db, [col]: rows.filter((r) => r.id !== key) }
  } else if (i >= 0) {
    const copy = [...rows]
    copy[i] = item
    db = { ...db, [col]: copy }
  } else db = { ...db, [col]: [...rows, item] }
  listeners.forEach((l) => l())
}

/** Substitui a base em memória pela carregada do servidor. */
export function setDB(next: DB) {
  db = next
  listeners.forEach((l) => l())
}

export function remove(col: string, id: string) {
  if (!allowed(col)) return
  db = { ...db, [col]: list(col).filter((r) => r.id !== id) }
  persist()
  if (servidor()) api(`/items/${encodeURIComponent(col)}/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch((e) => falhaServidor((e as Error).message))
}

/** Substitui a base inteira (backup, importações). Mantém os usuários se o novo conteúdo não tiver. */
export function replaceAll(next: DB, keepUsers = true) {
  if (!canWrite() && (db.usuarios ?? []).length) {
    avisar('Seu perfil é somente leitura.')
    return
  }
  if (servidor()) {
    // usuários são geridos pelo servidor; o restante substitui a base inteira
    const { usuarios: _u, ...dados } = next
    void _u
    db = { ...dados, usuarios: db.usuarios ?? [] }
    listeners.forEach((l) => l())
    return api('/import', { body: { db: dados } })
      .then(() => onFalha?.()) // recarrega do servidor para alinhar datas e autoria
      .catch((e) => falhaServidor((e as Error).message))
  }
  db = keepUsers && !next.usuarios?.length && db.usuarios ? { ...next, usuarios: db.usuarios } : next
  persist()
  return Promise.resolve()
}

/** Grava vários registros de um módulo de uma vez (substituir = apaga os demais do módulo). */
export function bulk(col: string, items: Item[], substituir = false): Promise<void> {
  if (!allowed(col)) return Promise.resolve()
  const t = new Date().toISOString()
  const by = getUser()?.nome
  const map = new Map((substituir ? [] : list(col)).map((r) => [r.id, r]))
  for (const it of items) map.set(it.id, { ...map.get(it.id), ...it, _updated: t, _updatedBy: by })
  db = { ...db, [col]: [...map.values()] }
  persist()
  if (!servidor()) return Promise.resolve()
  return api('/bulk', { body: { col, items, substituir } })
    .then(() => undefined)
    .catch((e) => falhaServidor((e as Error).message))
}

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Re-renderiza o componente sempre que a base local muda. */
export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => db)
}

export function useList(col: string): Item[] {
  return useSyncExternalStore(subscribe, () => list(col))
}

export function isEmpty() {
  return Object.entries(db).every(([k, rows]) => k === 'usuarios' || !rows?.length)
}

// Preferências da interface (tema, filtros) — separadas dos dados
export function getPref<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem('gestor-eficiente:pref:' + k)
    return v == null ? fallback : (JSON.parse(v) as T)
  } catch {
    return fallback
  }
}
export function setPref(k: string, v: unknown) {
  try {
    localStorage.setItem('gestor-eficiente:pref:' + k, JSON.stringify(v))
  } catch {
    /* ignora */
  }
}
