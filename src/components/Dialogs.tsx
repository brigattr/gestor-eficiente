import { useSyncExternalStore } from 'react'

// Diálogos próprios (substituem confirm/alert do navegador, que nem todo ambiente permite)
type Ask = { msg: string; ok: string; cancel: string; danger?: boolean; resolve: (v: boolean) => void }
let ask: Ask | null = null
let toast: string | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const subs = new Set<() => void>()
const emit = () => subs.forEach((s) => s())
const sub = (l: () => void) => {
  subs.add(l)
  return () => subs.delete(l)
}

export function confirmar(msg: string, opts: { ok?: string; cancel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    ask = { msg, ok: opts.ok ?? 'Confirmar', cancel: opts.cancel ?? 'Cancelar', danger: opts.danger, resolve }
    emit()
  })
}

export function avisar(msg: string) {
  toast = msg
  emit()
  clearTimeout(timer)
  timer = setTimeout(() => {
    toast = null
    emit()
  }, 4500)
}

export function DialogHost() {
  const a = useSyncExternalStore(sub, () => ask)
  const t = useSyncExternalStore(sub, () => toast)
  const close = (v: boolean) => {
    a?.resolve(v)
    ask = null
    emit()
  }
  return (
    <>
      {a && (
        <div className="overlay" style={{ zIndex: 60, placeItems: 'center' }} onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div className="modal" style={{ width: 'min(440px, 100%)' }} role="alertdialog" aria-modal>
            <div className="modal-body pre" style={{ display: 'block' }}>
              {a.msg}
            </div>
            <div className="modal-foot">
              <span className="grow" />
              <button className="btn" onClick={() => close(false)}>
                {a.cancel}
              </button>
              <button className={`btn ${a.danger ? 'danger' : 'primary'}`} autoFocus onClick={() => close(true)}>
                {a.ok}
              </button>
            </div>
          </div>
        </div>
      )}
      {t && <div className="toast">{t}</div>}
    </>
  )
}
