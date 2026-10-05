import { useEffect, useState, type ReactNode } from 'react'
import { tone } from '../lib/format'
import { Icon } from './Icon'

export function Chip({ v, t, children }: { v?: unknown; t?: string; children?: ReactNode }) {
  if (v == null && children == null) return null
  return <span className={`chip ${t ?? tone(v)}`}>{children ?? String(v)}</span>
}

export function Bar({ value, max = 100, t }: { value: number; max?: number; t?: string }) {
  const p = Math.max(0, Math.min(100, (value / (max || 1)) * 100))
  return (
    <div className={`bar ${t ?? ''}`} title={`${Math.round(p)}%`}>
      <i style={{ width: `${p}%` }} />
    </div>
  )
}

export function Modal({ title, onClose, children, foot, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { width: 'min(1040px, 100%)' } : undefined} role="dialog" aria-modal>
        <div className="modal-head">
          <h2 className="grow">{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </div>
        {children}
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  )
}

export function PageHead({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="grow">
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  )
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

export function Kpi({ l, v, d, t }: { l: string; v: ReactNode; d?: ReactNode; t?: string }) {
  return (
    <div className="card kpi">
      <span className="l">{l}</span>
      <span className="v" style={t ? { color: `var(--${t})` } : undefined}>
        {v}
      </span>
      {d && <span className="d muted">{d}</span>}
    </div>
  )
}

export function useLocalState<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const s = sessionStorage.getItem('ge:' + key)
      return s ? (JSON.parse(s) as T) : init
    } catch {
      return init
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem('ge:' + key, JSON.stringify(v))
    } catch {
      /* ignora */
    }
  }, [key, v])
  return [v, setV] as const
}
