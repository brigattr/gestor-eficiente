import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV } from '../nav'
import { getPref, setPref } from '../data/store'
import { useAlerts } from '../lib/alerts'
import { Icon } from './Icon'
import { EditorHost } from './ItemForm'

type Theme = 'auto' | 'light' | 'dark'

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => getPref<Theme>('theme', 'auto'))
  const loc = useLocation()
  const alerts = useAlerts()

  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    setPref('theme', theme)
  }, [theme])

  const title = NAV.flatMap((g) => g.items).find((i) => '/' + i.path === loc.pathname || (i.path && loc.pathname.startsWith('/' + i.path + '/')))?.label ?? 'Visão geral'

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <svg width="20" height="20" viewBox="0 0 32 32">
              <path d="M7 22l6-7 4 3 8-9" stroke="#d4a72c" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <b>Gestor Eficiente</b>
            <span>Controladoria</span>
          </div>
        </div>
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
        </header>
        <main className="content">{children}</main>
      </div>
      {open && <div className="overlay" style={{ zIndex: 30, background: 'rgb(0 0 0 / .3)' }} onClick={() => setOpen(false)} />}
      <EditorHost />
    </div>
  )
}
