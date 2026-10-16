import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MODULES } from '../data/schema'
import { useDB } from '../data/store'
import { openFile, useFileIndex } from '../lib/files'
import { label } from '../lib/format'
import { menuOcultos, navVisivel } from '../lib/menu'
import { Icon } from './Icon'
import { openEditor } from './ItemForm'

// Busca em tudo: telas do menu, registros de todos os módulos, anotações e arquivos. Atalho: Ctrl+K.

const NAO_BUSCA = new Set(['humor', 'sistema', 'desenhos', 'nr1checklist', 'ciencias', 'execucoesChecklist', 'pesquisasPsico', 'pesquisasClima', 'opcoes', 'blocos', 'secoes', 'fechamento'])

type Res = { tipo: string; titulo: string; sub?: string; ir: () => void }
const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function BuscaGlobal() {
  const db = useDB()
  const idx = useFileIndex()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [aberto, setAberto] = useState(false)
  const [sel, setSel] = useState(0)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ref.current?.focus()
        setAberto(true)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const res = useMemo<Res[]>(() => {
    const t = norm(q).trim()
    if (t.length < 2) return []
    const termos = t.split(/\s+/)
    const casa = (txt: string) => termos.every((x) => txt.includes(x))
    const out: Res[] = []
    for (const g of navVisivel(db)) for (const i of g.items) if (casa(norm(i.label))) out.push({ tipo: 'Tela', titulo: i.label, sub: g.group, ir: () => nav('/' + i.path) })
    const ocultos = menuOcultos(db)
    for (const m of MODULES) {
      if (ocultos.has(m.path) || NAO_BUSCA.has(m.col)) continue
      for (const it of db[m.col] ?? []) {
        const titulo = m.col === 'paginas' ? String(it.titulo || 'Sem título') : label(m.col, it)
        const texto = norm(
          Object.entries(it)
            .filter(([k, v]) => !k.startsWith('_') && k !== 'html' && k !== 'tracos' && typeof v === 'string')
            .map(([, v]) => v)
            .join(' '),
        )
        if (casa(norm(titulo)) || casa(texto)) out.push({ tipo: m.singular, titulo, sub: m.title, ir: () => openEditor(m.col, it.id) })
        if (out.length > 60) break
      }
    }
    for (const f of idx) if (casa(norm(f.name)) || casa(norm(f.meta?.assunto))) out.push({ tipo: 'Arquivo', titulo: f.meta?.assunto || f.name, sub: f.meta?.assunto ? f.name : undefined, ir: () => void openFile(f.id) })
    return out.slice(0, 40)
  }, [q, db, idx, nav])

  function escolher(r: Res) {
    r.ir()
    setAberto(false)
    setQ('')
    ref.current?.blur()
  }

  return (
    <div className="busca-global">
      <Icon name="search" size={15} />
      <input
        ref={ref}
        placeholder="Buscar em tudo…  (Ctrl+K)"
        value={q}
        onChange={(e) => (setQ(e.target.value), setAberto(true), setSel(0))}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(s + 1, res.length - 1)))
          if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)))
          if (e.key === 'Enter' && res[sel]) escolher(res[sel])
          if (e.key === 'Escape') (setAberto(false), ref.current?.blur())
        }}
      />
      {aberto && q.trim().length >= 2 && (
        <div className="busca-res">
          {res.length === 0 && <div className="muted small" style={{ padding: 10 }}>Nada encontrado.</div>}
          {res.map((r, i) => (
            <div key={i} className={`busca-item ${i === sel ? 'on' : ''}`} onMouseDown={(e) => (e.preventDefault(), escolher(r))} onMouseEnter={() => setSel(i)}>
              <span className="busca-tipo">{r.tipo}</span>
              <span className="grow busca-titulo">{r.titulo}</span>
              {r.sub && <span className="small muted busca-sub">{r.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
