// IndexedDB mínimo: 'kv' guarda a base (JSON) e 'files' guarda os anexos (Blob).
// Comporta centenas de MB, ao contrário do localStorage (~5 MB).

export type StoredFile = {
  id: string
  col: string
  itemId: string
  name: string
  type: string
  size: number
  blob: Blob
  added: string
  by?: string
  meta?: Record<string, string> // ex.: assunto/remetente/data de e-mails
}

const NAME = 'gestor-eficiente'
let dbp: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(NAME, 1)
    r.onupgradeneeded = () => {
      const d = r.result
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv')
      if (!d.objectStoreNames.contains('files')) {
        const s = d.createObjectStore('files', { keyPath: 'id' })
        s.createIndex('item', ['col', 'itemId'])
      }
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  return dbp
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

async function store(name: 'kv' | 'files', mode: IDBTransactionMode = 'readonly') {
  return (await open()).transaction(name, mode).objectStore(name)
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return req((await store('kv')).get(key)) as Promise<T | undefined>
}
export async function kvSet(key: string, value: unknown) {
  await req((await store('kv', 'readwrite')).put(value, key))
}

export async function filePut(f: StoredFile) {
  await req((await store('files', 'readwrite')).put(f))
}
export async function fileGet(id: string): Promise<StoredFile | undefined> {
  return req((await store('files')).get(id)) as Promise<StoredFile | undefined>
}
export async function fileDelete(id: string) {
  await req((await store('files', 'readwrite')).delete(id))
}
export async function filesOf(col: string, itemId: string): Promise<StoredFile[]> {
  return req((await store('files')).index('item').getAll([col, itemId])) as Promise<StoredFile[]>
}
export async function filesAll(): Promise<StoredFile[]> {
  return req((await store('files')).getAll()) as Promise<StoredFile[]>
}
export async function filesClear() {
  await req((await store('files', 'readwrite')).clear())
}

/** Pede ao navegador para não apagar os dados automaticamente quando faltar espaço. */
export async function persistir() {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
export async function uso() {
  try {
    const e = await navigator.storage?.estimate?.()
    return { usado: e?.usage ?? 0, cota: e?.quota ?? 0 }
  } catch {
    return { usado: 0, cota: 0 }
  }
}
