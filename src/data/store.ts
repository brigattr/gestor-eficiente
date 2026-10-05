import { useSyncExternalStore } from 'react'

// Persistência local (navegador). Nada sai da máquina do usuário:
// backup/restauração é feito via exportação/importação de JSON em Configurações.

export type Item = { id: string; [field: string]: unknown }
export type DB = Record<string, Item[]>

const KEY = 'gestor-eficiente:db:v1'
const listeners = new Set<() => void>()

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch {
    /* storage indisponível ou corrompido: começa vazio */
  }
  return {}
}

let db: DB = load()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch (e) {
    console.error('Falha ao salvar dados locais', e)
    alert('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado). Exporte um backup.')
  }
  listeners.forEach((l) => l())
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function getDB() {
  return db
}

export function list(col: string): Item[] {
  return db[col] ?? EMPTY
}
const EMPTY: Item[] = []

export function get(col: string, id: string | undefined | null): Item | undefined {
  if (!id) return undefined
  return list(col).find((i) => i.id === id)
}

export function upsert(col: string, item: Partial<Item>): Item {
  const now = new Date().toISOString()
  const rows = [...list(col)]
  const idx = item.id ? rows.findIndex((r) => r.id === item.id) : -1
  let saved: Item
  if (idx >= 0) {
    saved = { ...rows[idx], ...item, id: rows[idx].id, _updated: now }
    rows[idx] = saved
  } else {
    saved = { ...item, id: item.id ?? uid(), _created: now, _updated: now } as Item
    rows.push(saved)
  }
  db = { ...db, [col]: rows }
  persist()
  return saved
}

export function remove(col: string, id: string) {
  db = { ...db, [col]: list(col).filter((r) => r.id !== id) }
  persist()
}

export function replaceAll(next: DB) {
  db = next
  persist()
}

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Re-renderiza o componente sempre que o banco local muda. */
export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => db)
}

export function useList(col: string): Item[] {
  return useSyncExternalStore(subscribe, () => list(col))
}

export function isEmpty() {
  return Object.values(db).every((rows) => !rows?.length)
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
