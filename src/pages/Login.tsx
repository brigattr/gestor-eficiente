import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { Logo } from '../components/Logo'
import { useDB, type Item } from '../data/store'
import { criarAdmin, cryptoOk, entrar, login, logout, minutosBloqueio, recuperar } from '../lib/auth'
import { getUser, subscribeUser } from '../lib/session'


export function useUser() {
  return useSyncExternalStore(subscribeUser, getUser)
}

/** Exige login. Bloqueia após X minutos sem uso. */
export function AuthGate({ children }: { children: ReactNode }) {
  const user = useUser()
  useEffect(() => {
    if (!user) return
    const min = minutosBloqueio()
    if (!min) return
    let t: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(t)
      t = setTimeout(logout, min * 60_000)
    }
    const evs = ['mousemove', 'keydown', 'pointerdown', 'scroll'] as const
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(t)
      evs.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [user])
  return user ? <>{children}</> : <Login />
}

function Login() {
  const db = useDB()
  const primeiro = !(db.usuarios ?? []).length
  const [modo, setModo] = useState<'login' | 'recuperar'>('login')
  const [nome, setNome] = useState('')
  const [user, setUserName] = useState('')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [codigo, setCodigo] = useState('')
  const [lembrar, setLembrar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [novo, setNovo] = useState<{ codigo: string; u: Item } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!cryptoOk()) return setErro('Este endereço não é seguro (HTTPS). Acesse o sistema por https:// para usar o login.')
    if ((primeiro || modo === 'recuperar') && senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    if ((primeiro || modo === 'recuperar') && senha !== senha2) return setErro('As senhas não conferem.')
    setBusy(true)
    try {
      if (primeiro) {
        if (!nome.trim() || !user.trim()) return setErro('Informe nome e usuário.')
        const r = await criarAdmin(nome.trim(), user.trim(), senha)
        if (r.u) setNovo({ codigo: r.codigo, u: r.u })
      } else if (modo === 'recuperar') {
        setErro(await recuperar(user, codigo, senha))
      } else {
        setErro(await login(user, senha, lembrar))
      }
    } finally {
      setBusy(false)
    }
  }

  if (novo) return <CodigoRecuperacao codigo={novo.codigo} onOk={() => entrar(novo.u, lembrar)} />

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <Logo />
        <h1 className="display">{primeiro ? 'Primeiro acesso' : modo === 'recuperar' ? 'Recuperar acesso' : 'Entrar'}</h1>
        <p className="muted small">
          {primeiro
            ? 'Crie o usuário administrador. Depois você cadastra os demais usuários em Configurações → Usuários.'
            : modo === 'recuperar'
              ? 'Use o código de recuperação gerado na criação do administrador.'
              : 'Gestão de time, projetos e controles da Controladoria.'}
        </p>
        {primeiro && (
          <label className="field">
            <span>Seu nome</span>
            <input id="lg-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Usuário{primeiro ? '' : ' ou e-mail'}</span>
          <input id="lg-user" value={user} onChange={(e) => setUserName(e.target.value)} autoComplete="username" autoFocus />
        </label>
        {modo === 'recuperar' && (
          <label className="field">
            <span>Código de recuperação</span>
            <input id="lg-cod" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" />
          </label>
        )}
        <label className="field">
          <span>{modo === 'recuperar' ? 'Nova senha' : 'Senha'}</span>
          <input id="lg-pass" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={primeiro || modo === 'recuperar' ? 'new-password' : 'current-password'} />
        </label>
        {(primeiro || modo === 'recuperar') && (
          <label className="field">
            <span>Confirmar senha</span>
            <input id="lg-pass2" type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} autoComplete="new-password" />
          </label>
        )}
        {modo === 'login' && (
          <label className="row small" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} /> Manter conectado neste computador por 12 h
          </label>
        )}
        {erro && <div className="small" style={{ color: 'var(--bad)' }}>{erro}</div>}
        <button className="btn gold" disabled={busy} style={{ justifyContent: 'center' }}>
          {busy ? 'Aguarde…' : primeiro ? 'Criar administrador' : modo === 'recuperar' ? 'Redefinir senha e entrar' : 'Entrar'}
        </button>
        {!primeiro && (
          <button type="button" className="btn ghost sm" onClick={() => setModo(modo === 'login' ? 'recuperar' : 'login')}>
            {modo === 'login' ? 'Esqueci a senha do administrador' : 'Voltar ao login'}
          </button>
        )}
        <p className="small muted" style={{ margin: 0 }}>
          Os dados ficam armazenados somente neste navegador. Esqueceu a senha de um usuário comum? O administrador redefine em Configurações.
        </p>
      </form>
    </div>
  )
}

/** Exibido logo após criar o administrador. */
function CodigoRecuperacao({ codigo, onOk }: { codigo: string; onOk: () => void }) {
  return (
    <div className="login">
      <div className="login-card">
        <Logo />
        <h1 className="display">Guarde este código</h1>
        <p className="small">É a única forma de redefinir a senha do administrador se você esquecê-la. Anote em local seguro; ele não será mostrado de novo.</p>
        <code style={{ fontSize: 20, letterSpacing: 2, padding: 12, background: 'var(--surface-2)', borderRadius: 10, textAlign: 'center', userSelect: 'all' }}>{codigo}</code>
        <button className="btn gold" style={{ justifyContent: 'center' }} onClick={onOk}>
          Anotei, continuar
        </button>
      </div>
    </div>
  )
}
