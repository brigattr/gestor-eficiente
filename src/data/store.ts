import { useSyncExternalStore } from 'react'
import { avisar } from '../components/Dialogs'
import { kvGet, kvSet } from '../lib/idb'
import { canWrite, getUser, isAdmin } from '../lib/session'

// Base local no IndexedDB do navegador. Nada sai da máquina do usuário:
// backup/restauração (com anexos) é feito em Configurações.

export type Item = { id: string; [field: string]: unknown }
export type DB = Record<string, Item[]>

const KEY = 'db'
const LEGACY = 'gestor-eficiente:db:v1' // versão anterior em localStorage
const listeners = new Set<() => void>()
let db: DB = {}
let timer: ReturnType<typeof setTimeout> | undefined
let pending = false

/** Carrega a base antes de renderizar o app (migra do localStorage se preciso). */
export async function initStore() {
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
  return saved
}

export function remove(col: string, id: string) {
  if (!allowed(col)) return
  db = { ...db, [col]: list(col).filter((r) => r.id !== id) }
  persist()
}

/** Substitui a base inteira (backup, importações). Mantém os usuários se o novo conteúdo não tiver. */
export function replaceAll(next: DB, keepUsers = true) {
  if (!canWrite() && (db.usuarios ?? []).length) {
    avisar('Seu perfil é somente leitura.')
    return
  }
  db = keepUsers && !next.usuarios?.length && db.usuarios ? { ...next, usuarios: db.usuarios } : next
  persist()
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
