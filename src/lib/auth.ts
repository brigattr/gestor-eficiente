import { getDB, getPref, list, setPref, upsert, type Item } from '../data/store'
import { setUser, type Papel, type SessionUser } from './session'

// Usuários e senhas ficam na base local. A senha nunca é guardada: só o hash PBKDF2 (SHA-256).
// Exige contexto seguro (HTTPS ou localhost) para a Web Crypto API.

const ITER = 150_000
const SESSION = 'gestor-eficiente:sessao'

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

export function cryptoOk() {
  return !!globalThis.crypto?.subtle
}

export async function hashSenha(senha: string, salt?: string) {
  const s = salt ?? hex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(s), iterations: ITER }, key, 256)
  return { salt: s, hash: hex(bits) }
}

export function codigoRecuperacao() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const r = crypto.getRandomValues(new Uint8Array(16))
  return [...r].map((x) => a[x % a.length]).join('').replace(/(.{4})(?=.)/g, '$1-')
}

const toSession = (u: Item): SessionUser => ({ id: u.id, nome: String(u.nome), papel: (u.papel as Papel) ?? 'Leitura' })

function start(u: Item, lembrar: boolean) {
  setUser(toSession(u))
  const s = JSON.stringify({ id: u.id, ate: Date.now() + (lembrar ? 12 : 0) * 3600_000 })
  try {
    sessionStorage.setItem(SESSION, s)
    if (lembrar) localStorage.setItem(SESSION, s)
    else localStorage.removeItem(SESSION)
  } catch {
    /* ignora */
  }
  upsert('usuarios', { id: u.id, ultimoAcesso: new Date().toISOString() })
}

/** Restaura a sessão da aba (ou "manter conectado" por 12 h). */
export function restoreSession() {
  try {
    const raw = sessionStorage.getItem(SESSION) ?? localStorage.getItem(SESSION)
    if (!raw) return
    const { id, ate } = JSON.parse(raw) as { id: string; ate: number }
    const fromLocal = !sessionStorage.getItem(SESSION)
    if (fromLocal && Date.now() > ate) return localStorage.removeItem(SESSION)
    const u = list('usuarios').find((x) => x.id === id && x.ativo !== false)
    if (u) {
      setUser(toSession(u))
      sessionStorage.setItem(SESSION, raw)
    }
  } catch {
    /* ignora */
  }
}

export function logout() {
  try {
    sessionStorage.removeItem(SESSION)
    localStorage.removeItem(SESSION)
  } catch {
    /* ignora */
  }
  setUser(null)
}

export async function login(loginOuEmail: string, senha: string, lembrar: boolean): Promise<string | null> {
  const k = loginOuEmail.trim().toLowerCase()
  const u = list('usuarios').find((x) => String(x.login ?? '').toLowerCase() === k || String(x.email ?? '').toLowerCase() === k)
  if (!u || u.ativo === false) return 'Usuário ou senha incorretos.'
  const { hash } = await hashSenha(senha, String(u.salt))
  if (hash !== u.hash) return 'Usuário ou senha incorretos.'
  start(u, lembrar)
  return null
}

/** Cria/atualiza um usuário. Sem senha informada, mantém a atual. */
export async function salvarUsuario(dados: Partial<Item> & { senha?: string }) {
  const { senha, ...rest } = dados
  const patch: Partial<Item> = { ...rest }
  if (senha) Object.assign(patch, await hashSenha(senha))
  return upsert('usuarios', patch)
}

/** Primeiro acesso: cria o administrador e devolve o código de recuperação (a sessão começa com entrar()). */
export async function criarAdmin(nome: string, loginName: string, senha: string) {
  const codigo = codigoRecuperacao()
  const rec = await hashSenha(codigo.replace(/-/g, ''))
  const u = await salvarUsuario({ nome, login: loginName, papel: 'Administrador', ativo: true, senha, recSalt: rec.salt, recHash: rec.hash })
  return { codigo, u }
}
export const entrar = start

/** Redefine a senha de um administrador usando o código de recuperação. */
export async function recuperar(loginName: string, codigo: string, novaSenha: string): Promise<string | null> {
  const u = list('usuarios').find((x) => String(x.login ?? '').toLowerCase() === loginName.trim().toLowerCase())
  if (!u?.recSalt) return 'Usuário não encontrado ou sem código de recuperação.'
  const { hash } = await hashSenha(codigo.replace(/[-\s]/g, '').toUpperCase(), String(u.recSalt))
  if (hash !== u.recHash) return 'Código de recuperação inválido.'
  setUser(toSession(u)) // permite gravar a nova senha
  await salvarUsuario({ id: u.id, senha: novaSenha })
  start(u, false)
  return null
}

export const temUsuarios = () => (getDB().usuarios ?? []).length > 0

export const minutosBloqueio = () => getPref<number>('lockMin', 30)
export const setMinutosBloqueio = (m: number) => setPref('lockMin', m)
