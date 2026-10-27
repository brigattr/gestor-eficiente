import { DialogHost } from './Dialogs'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV } from '../nav'
import { navVisivel, visivel, ETIQUETAS } from '../lib/menu'
import { getPref, setPref } from '../data/store'
import { useAlerts } from '../lib/alerts'
import { Icon } from './Icon'
import { EditorHost } from './ItemForm'
import { BuscaGlobal } from './BuscaGlobal'
import { Logo } from './Logo'
import { itensEtiquetados } from '../pages/Etiquetas'
import { useDB, type DB } from '../data/store'
import { logout } from '../lib/auth'
import { useUser } from '../pages/Login'
import { ativar, desativar, estado, verificar } from '../lib/notificacoes'
import { avisar } from './Dialogs'

type Theme = 'auto' | 'light' | 'dark'

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => getPref<Theme>('theme', 'auto'))
  const loc = useLocation()
  const alerts = useAlerts()
  const user = useUser()
  const db = useDB()

  // avisos do dia (tarefas e vencimentos): confere ao abrir, quando os dados mudam e a cada 10 min
  useEffect(() => {
    const t = setTimeout(() => void verificar(db), 2000)
    return () => clearTimeout(t)
  }, [db])
  useEffect(() => {
    const i = setInterval(() => void verificar(db), 10 * 60000)
    return () => clearInterval(i)
  }, [db])

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
        {navVisivel(db).map((g) => (
          <div key={g.group}>
            <div className="nav-group">{g.group}</div>
            {g.items.map((i) => (
              <NavLink key={i.path} to={'/' + i.path} end={i.path === ''} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setOpen(false)}>
                <Icon name={i.icon} size={17} />
                {i.label}
                {i.path === '' && alerts.length > 0 && <span className="nav-badge">{alerts.length}</span>}
              </NavLink>
            ))}
            {g.group === 'Visão' && visivel(db, ETIQUETAS) && <MenuEtiquetas fechar={() => setOpen(false)} />}
          </div>
        ))}
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn ghost menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">
            <Icon name="menu" />
          </button>
          <span className="muted small hide-sm">{title}</span>
          <BuscaGlobal />
          <span className="grow" />
          <span className="muted small hide-sm">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
          <SinoAvisos db={db} />
          <button
            className="btn ghost sm"
            title="Tema: automático / claro / escuro"
            onClick={() => setTheme(theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto')}
          >
            <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} />
            <span className="hide-sm">{theme === 'auto' ? 'Auto' : theme === 'light' ? 'Claro' : 'Escuro'}</span>
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

/** Menu "Etiquetas": uma linha só, com o total de itens etiquetados em aberto. O filtro por etiqueta fica no painel. */
function MenuEtiquetas({ fechar }: { fechar: () => void }) {
  const db = useDB()
  const n = itensEtiquetados(db).filter((x) => !x.done).length
  return (
    <>
      <div className="nav-group">Etiquetas</div>
      <NavLink to="/etiquetas" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={fechar}>
        <Icon name="tag" size={17} />
        Etiquetas
        {n > 0 && <span className="nav-count">{n}</span>}
      </NavLink>
    </>
  )
}

/** Liga/desliga os avisos de vencimento neste aparelho. */
function SinoAvisos({ db }: { db: DB }) {
  const [st, setSt] = useState(estado)
  if (st === 'sem-suporte') return null
  async function clicar() {
    if (st === 'ativo') {
      desativar()
      setSt(estado())
      avisar('Avisos desligados neste aparelho.')
      return
    }
    if (st === 'negado') {
      avisar('Os avisos estão bloqueados no navegador. Clique no cadeado ao lado do endereço do site → Notificações → Permitir, e depois clique no sino de novo.')
      return
    }
    const r = await ativar()
    setSt(r)
    if (r === 'ativo') void verificar(db)
    if (r !== 'ativo') avisar('Os avisos não foram permitidos. Para ativar depois, libere as notificações do site no navegador e clique no sino.')
  }
  return (
    <button className={'btn ghost sm' + (st === 'ativo' ? '' : ' sino-off')} onClick={clicar} title={st === 'ativo' ? 'Avisos de vencimento ativos neste aparelho (clique para desligar)' : 'Ativar avisos de tarefas e vencimentos do dia neste aparelho'}>
      <Icon name="bell" size={16} />
      <span className="hide-sm">{st === 'ativo' ? 'Avisos' : 'Ativar avisos'}</span>
    </button>
  )
}
