import { useRef, useState } from 'react'
import { addFiles, deleteFile, filesFor, fmtSize, openFile, useFileIndex, type FileMeta } from '../lib/files'
import { confirmar } from './Dialogs'
import { Icon } from './Icon'

const ext = (n: string) => (n.split('.').pop() ?? '').toUpperCase().slice(0, 4)

export function FileRow({ f, onRemove, context }: { f: FileMeta; onRemove?: () => void; context?: React.ReactNode }) {
  const email = f.meta?.assunto || f.meta?.de
  return (
    <div className="file">
      <span className={`file-ext ${email ? 'mail' : ''}`}>{email ? '✉' : ext(f.name)}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <a className="file-name" onClick={() => openFile(f.id)} title="Abrir">
          {email ? f.meta!.assunto || f.name : f.name}
        </a>
        <div className="small muted file-sub">
          {email ? (
            <>
              {f.meta!.de ?? ''}
              {f.meta!.data ? ` · ${new Date(f.meta!.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''} · {f.name}
            </>
          ) : (
            <>
              {fmtSize(f.size)} · {new Date(f.added).toLocaleDateString('pt-BR')}
              {f.by ? ` · ${f.by}` : ''}
            </>
          )}
          {context}
        </div>
        {f.meta?.resumo && <div className="small muted file-resumo">{f.meta.resumo}</div>}
      </div>
      <button className="btn ghost sm" onClick={() => openFile(f.id)} title="Abrir">
        <Icon name="link" size={14} />
      </button>
      {onRemove && (
        <button className="btn ghost sm danger" onClick={onRemove} title="Remover anexo">
          <Icon name="trash" size={14} />
        </button>
      )}
    </div>
  )
}

/** Área de anexos de um registro: arraste arquivos ou e-mails salvos (.msg/.eml). */
export function Attachments({ col, itemId }: { col: string; itemId: string }) {
  const idx = useFileIndex()
  const files = filesFor(idx, col, itemId)
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  async function add(list: FileList | null) {
    if (!list?.length) return
    setBusy(true)
    await addFiles(col, itemId, list)
    setBusy(false)
  }
  return (
    <div className="wide stack" style={{ gap: 8 }}>
      <div className="row">
        <b className="small" style={{ color: 'var(--muted)' }}>
          Anexos {files.length ? `(${files.length})` : ''}
        </b>
      </div>
      <div
        className={`dropzone ${over ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void add(e.dataTransfer.files)
        }}
        onClick={() => input.current?.click()}
      >
        <Icon name="upload" size={16} />
        {busy ? 'Salvando…' : 'Arraste arquivos ou e-mails (.msg / .eml) aqui, ou clique para escolher'}
        <input ref={input} type="file" multiple hidden onChange={(e) => (void add(e.target.files), (e.target.value = ''))} />
      </div>
      {files
        .slice()
        .sort((a, b) => b.added.localeCompare(a.added))
        .map((f) => (
          <FileRow
            key={f.id}
            f={f}
            onRemove={async () => {
              if (await confirmar(`Remover o anexo "${f.name}"?`, { ok: 'Remover', danger: true })) await deleteFile(f.id)
            }}
          />
        ))}
    </div>
  )
}
