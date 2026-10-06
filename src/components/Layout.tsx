import { DialogHost } from './Dialogs'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV } from '../nav'
import { getPref, setPref } from '../data/store'
import { useAlerts } from '../lib/alerts'
import { Icon } from './Icon'
import { EditorHost } from './ItemForm'
import { Logo } from './Logo'
import { corEtiqueta } from './Tags'
import { itensDaEtiqueta } from '../pages/Etiquetas'
import { useDB } from '../data/store'
import { logout } from '../lib/auth'
import { useUser } from '../pages/Login'

type Theme = 'auto' | 'light' | 'dark'

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => getPref<Theme>('theme', 'auto'))
  const loc = useLocation()
  const alerts = useAlerts()
  const user = useUser()

  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    setPref('theme', theme)
  }, [theme])

  const title = NAV.flatMap((g) => g.items).find((i) => '/' + i.path === loc.pathname || (i.path && loc.pathname.startsWith('/' + i.path + '/')))?.label ?? (loc.pathname.startsWith('/etiquetas') ? 'Etiquetas' : 'Visão geral')

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Logo light />
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="nav-group">{g.group}</div>
            {g.items.map((i) => (
              <NavLink key={i.path} to={'/' + i.path} end={i.path === ''} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setOpen(false)}>
                <Icon name={i.icon} size={17} />
                {i.label}
                {i.path === '' && alerts.length > 0 && <span className="nav-badge">{alerts.length}</span>}
              </NavLink>
            ))}
            {g.group === 'Visão' && <MenuEtiquetas fechar={() => setOpen(false)} />}
          </div>
        ))}
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn ghost menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">
            <Icon name="menu" />
          </button>
          <span className="muted small grow">{title}</span>
          <span className="muted small hide-sm">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
          <button
            className="btn ghost sm"
            title="Tema: automático / claro / escuro"
            onClick={() => setTheme(theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto')}
          >
            <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} />
            {theme === 'auto' ? 'Auto' : theme === 'light' ? 'Claro' : 'Escuro'}
          </button>
          {user && (
            <span className="user">
              <span className="avatar" title={`${user.nome} · ${user.papel}`}>
                {user.nome.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <span className="small hide-sm">
                <b>{user.nome.split(' ')[0]}</b>
                <span className="muted"> · {user.papel}</span>
              </span>
              <button className="btn ghost sm" onClick={logout} title="Sair / bloquear">
                Sair
              </button>
            </span>
          )}
        </header>
        <main className="content">{children}</main>
      </div>
      {open && <div className="overlay" style={{ zIndex: 30, background: 'rgb(0 0 0 / .3)' }} onClick={() => setOpen(false)} />}
      <EditorHost />
      <DialogHost />
    </div>
  )
}

/** Grupo "Etiquetas" do menu: cada etiqueta ativa com a contagem de itens em aberto. */
function MenuEtiquetas({ fechar }: { fechar: () => void }) {
  const db = useDB()
  const tags = (db.etiquetas ?? []).filter((t) => !t.arquivada).sort((a, b) => String(a.nome).localeCompare(String(b.nome)))
  return (
    <>
      <div className="nav-group">Etiquetas</div>
      {tags.map((t) => {
        const n = itensDaEtiqueta(db, t.id).filter((x) => !x.done).length
        return (
          <NavLink key={t.id} to={`/etiquetas/${t.id}`} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={fechar}>
            <span className="nav-tag-dot" style={{ background: corEtiqueta(t.id) }} />
            {String(t.nome)}
            {n > 0 && <span className="nav-count">{n}</span>}
          </NavLink>
        )
      })}
      <NavLink to="/etiquetas" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={fechar}>
        <Icon name="tag" size={17} />
        {tags.length ? 'Configurar etiquetas' : 'Criar etiquetas'}
      </NavLink>
    </>
  )
}
