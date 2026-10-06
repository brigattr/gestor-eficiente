import { DialogHost } from './Dialogs'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV } from '../nav'
import { getPref, setPref } from '../data/store'
import { useAlerts } from '../lib/alerts'
import { Icon } from './Icon'
import { EditorHost } from './ItemForm'
import { Logo } from './Logo'
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

  const title = NAV.flatMap((g) => g.items).find((i) => '/' + i.path === loc.pathname || (i.path && loc.pathname.startsWith('/' + i.path + '/')))?.label ?? 'Visão geral'

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
