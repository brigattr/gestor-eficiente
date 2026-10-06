import { useSyncExternalStore } from 'react'
import { avisar } from '../components/Dialogs'
import { uid } from '../data/store'
import { lerEmail } from './email'
import { fileDelete, fileGet, filePut, filesAll, filesClear, type StoredFile } from './idb'
import { canWrite, getUser } from './session'
import { api, servidor } from './api'

// Anexos de qualquer registro (col + itemId). Os arquivos ficam no IndexedDB;
// aqui mantemos um índice leve (sem o conteúdo) para listas, contagens e busca.

export type FileMeta = Omit<StoredFile, 'blob'>
let index: FileMeta[] = []
const subs = new Set<() => void>()
const emit = () => {
  index = [...index]
  subs.forEach((s) => s())
}
const strip = ({ blob: _b, ...m }: StoredFile): FileMeta => m

export async function initFiles() {
  if (servidor()) return
  try {
    index = (await filesAll()).map(strip)
  } catch (e) {
    console.error('Falha ao ler anexos', e)
  }
}

export function useFileIndex() {
  return useSyncExternalStore(
    (l) => {
      subs.add(l)
      return () => subs.delete(l)
    },
    () => index,
  )
}
export const filesFor = (idx: FileMeta[], col: string, itemId: string) => idx.filter((f) => f.col === col && f.itemId === itemId)
export const countFor = (idx: FileMeta[], col: string, itemId: string) => idx.reduce((a, f) => a + (f.col === col && f.itemId === itemId ? 1 : 0), 0)
export const fileIndex = () => index

const MAX = 50 * 1024 * 1024

export async function addFiles(col: string, itemId: string, files: FileList | File[]): Promise<FileMeta[]> {
  if (!canWrite()) {
    avisar('Seu perfil é somente leitura.')
    return []
  }
  const out: FileMeta[] = []
  for (const f of Array.from(files)) {
    if (f.size > MAX) {
      avisar(`"${f.name}" passa de 50 MB e não foi anexado.`)
      continue
    }
    const meta = await lerEmail(f)
    const rec: StoredFile = {
      id: uid(),
      col,
      itemId,
      name: f.name,
      type: f.type || (f.name.endsWith('.msg') ? 'application/vnd.ms-outlook' : f.name.endsWith('.eml') ? 'message/rfc822' : 'application/octet-stream'),
      size: f.size,
      blob: f,
      added: new Date().toISOString(),
      by: getUser()?.nome,
      meta: meta as Record<string, string> | undefined,
    }
    try {
      if (servidor()) {
        const r = await api<{ file: FileMeta }>(`/files?col=${encodeURIComponent(col)}&item=${encodeURIComponent(itemId)}`, {
          raw: f,
          headers: { 'content-type': rec.type, 'x-file-id': rec.id, 'x-file-name': encodeURIComponent(f.name), ...(meta ? { 'x-file-meta': encodeURIComponent(JSON.stringify(meta)) } : {}) },
        })
        index.push(r.file)
        out.push(r.file)
        continue
      }
      await filePut(rec)
      index.push(strip(rec))
      out.push(strip(rec))
    } catch (e) {
      console.error(e)
      avisar(`Não foi possível salvar "${f.name}": ${(e as Error).message || "armazenamento cheio ou bloqueado"}.`)
    }
  }
  emit()
  return out
}

export async function deleteFile(id: string) {
  if (!canWrite()) return avisar('Seu perfil é somente leitura.')
  if (servidor()) await api(`/files/${id}`, { method: 'DELETE' })
  else await fileDelete(id)
  index = index.filter((f) => f.id !== id)
  emit()
}

export async function deleteFilesOf(col: string, itemId: string) {
  for (const f of filesFor(index, col, itemId)) {
    if (servidor()) await api(`/files/${f.id}`, { method: 'DELETE' }).catch(() => undefined)
    else await fileDelete(f.id)
  }
  index = index.filter((f) => !(f.col === col && f.itemId === itemId))
  emit()
}

/** Abre o anexo: PDF/imagem/texto em nova aba; os demais (e-mails, Office) são baixados e abrem no programa padrão. */
export async function openFile(id: string) {
  if (servidor()) {
    const m = index.find((x) => x.id === id)
    const viewable = /^(image\/|application\/pdf|text\/plain)/.test(m?.type ?? '')
    if (viewable && window.open(`api/files/${id}`, '_blank')) return
    const a = document.createElement('a')
    a.href = `api/files/${id}?download=1`
    a.download = m?.name ?? 'anexo'
    a.click()
    return
  }
  const f = await fileGet(id)
  if (!f) return avisar('Anexo não encontrado.')
  const url = URL.createObjectURL(f.blob)
  const viewable = /^(image\/|application\/pdf|text\/)/.test(f.type)
  if (viewable && window.open(url, '_blank')) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }
  const a = document.createElement('a')
  a.href = url
  a.download = f.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

async function baixar(id: string) {
  const r = await fetch(`api/files/${id}?download=1`, { credentials: 'same-origin' })
  if (!r.ok) throw new Error(`Falha ao baixar o anexo ${id}`)
  return r.blob()
}

export async function getBlob(id: string) {
  if (servidor()) return baixar(id)
  return (await fileGet(id))?.blob
}

export async function allStored(): Promise<StoredFile[]> {
  if (!servidor()) return filesAll()
  const out: StoredFile[] = []
  for (const m of index) out.push({ ...m, blob: await baixar(m.id) })
  return out
}

/** Índice vindo do servidor (carga inicial e sincronização). */
export function setFileIndex(next: FileMeta[]) {
  index = next
  emit()
}
export function applyFileChanges(changes: (FileMeta & { deleted?: boolean })[]) {
  if (!changes.length) return
  const map = new Map(index.map((f) => [f.id, f]))
  for (const c of changes) {
    const { deleted, ...m } = c
    if (deleted) map.delete(m.id)
    else map.set(m.id, m)
  }
  index = [...map.values()]
  emit()
}

/** Restaura anexos de um backup (substitui todos). */
export async function restoreFiles(files: StoredFile[]) {
  if (servidor()) {
    await api('/files', { method: 'DELETE' })
    index = []
    for (const f of files) {
      const r = await api<{ file: FileMeta }>(`/files?col=${encodeURIComponent(f.col)}&item=${encodeURIComponent(f.itemId)}`, {
        raw: f.blob,
        headers: { 'content-type': f.type || 'application/octet-stream', 'x-file-id': f.id, 'x-file-name': encodeURIComponent(f.name), 'x-file-added': f.added, ...(f.by ? { 'x-file-by': encodeURIComponent(f.by) } : {}), ...(f.meta ? { 'x-file-meta': encodeURIComponent(JSON.stringify(f.meta)) } : {}) },
      })
      index.push(r.file)
    }
    emit()
    return
  }
  await filesClear()
  for (const f of files) await filePut(f)
  index = files.map(strip)
  emit()
}

export function fmtSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}
