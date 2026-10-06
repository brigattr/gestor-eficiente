import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'
import { getDB, replaceAll, type DB } from '../data/store'
import { allStored, restoreFiles } from './files'
import type { StoredFile } from './idb'
import { todayISO } from './format'

// Backup completo em .zip: dados.json + anexos/<id> + anexos.json (metadados).

export async function exportarZip() {
  const files = await allStored()
  const entries: Record<string, Uint8Array> = {
    'dados.json': strToU8(JSON.stringify({ app: 'gestor-eficiente', versao: 2, gerado: new Date().toISOString(), data: getDB() })),
    'anexos.json': strToU8(JSON.stringify(files.map(({ blob: _b, ...m }) => m))),
  }
  for (const f of files) entries[`anexos/${f.id}`] = new Uint8Array(await f.blob.arrayBuffer())
  const zip = zipSync(entries, { level: 6 })
  const blob = new Blob([zip as BlobPart], { type: 'application/zip' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `gestor-eficiente_backup_${todayISO()}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  return { registros: Object.values(getDB()).reduce((s, r) => s + (r?.length ?? 0), 0), anexos: files.length, bytes: zip.byteLength }
}

/** Lê .zip (com anexos) ou .json (só dados, versão anterior). */
export async function lerBackup(f: File): Promise<{ data: DB; files: StoredFile[] | null }> {
  if (/\.zip$/i.test(f.name)) {
    const z = unzipSync(new Uint8Array(await f.arrayBuffer()))
    const dados = JSON.parse(strFromU8(z['dados.json']))
    const metas = JSON.parse(strFromU8(z['anexos.json'] ?? strToU8('[]'))) as Omit<StoredFile, 'blob'>[]
    const files = metas.filter((m) => z[`anexos/${m.id}`]).map((m) => ({ ...m, blob: new Blob([z[`anexos/${m.id}`] as BlobPart], { type: m.type }) }))
    return { data: dados.data as DB, files }
  }
  const j = JSON.parse(await f.text())
  const data = (j.data ?? j) as DB
  if (typeof data !== 'object' || Array.isArray(data)) throw new Error('formato')
  return { data, files: null }
}

export async function restaurar(b: { data: DB; files: StoredFile[] | null }) {
  replaceAll(b.data, !b.data.usuarios?.length)
  if (b.files) await restoreFiles(b.files)
}
