/// <reference types="@cloudflare/workers-types" />
import { camposOutlook, lerIcs } from '../src/shared/ics'
// API do Gestor Eficiente (Cloudflare Pages Functions + D1 + R2).
// Rotas em /api/*. Sessão por cookie HttpOnly; senhas em PBKDF2-SHA256.

export interface Env {
  DB: D1Database // banco D1 (registros, usuários, sessões, metadados de anexos)
  FILES: R2Bucket // bucket R2 (conteúdo dos anexos)
  SETUP_TOKEN?: string // chave exigida para criar o primeiro administrador
}

type User = {
  id: string
  login: string
  nome: string
  email: string | null
  papel: 'Administrador' | 'Gestor' | 'Leitura'
  pessoa: string | null
  ativo: number
  salt: string
  hash: string
  rec_salt: string | null
  rec_hash: string | null
  ultimo_acesso: string | null
  falhas: number
  bloqueado_ate: string | null
  updated_at: string | null
}

const COOKIE = 'cd_sess'
const ITER = 100_000 // limite do PBKDF2 no runtime do Workers
const MAX_ITEM = 900_000
const MAX_FILE = 50 * 1024 * 1024
const COL = /^[A-Za-z0-9_]{1,40}$/

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS items (col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (col, id))`,
  `CREATE INDEX IF NOT EXISTS items_upd ON items (updated_at)`,
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE COLLATE NOCASE, nome TEXT NOT NULL, email TEXT, papel TEXT NOT NULL, pessoa TEXT, ativo INTEGER NOT NULL DEFAULT 1, salt TEXT NOT NULL, hash TEXT NOT NULL, rec_salt TEXT, rec_hash TEXT, ultimo_acesso TEXT, falhas INTEGER NOT NULL DEFAULT 0, bloqueado_ate TEXT, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, col TEXT NOT NULL, item_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT, size INTEGER, added TEXT, by TEXT, meta TEXT, deleted INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS files_upd ON files (updated_at)`,
  `CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
]
let migrated = false
async function migrate(db: D1Database) {
  if (migrated) return
  await db.batch(SCHEMA.map((s) => db.prepare(s)))
  migrated = true
}

// ───────── utilidades
const now = () => new Date().toISOString()
const enc = new TextEncoder()
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
const rand = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)).buffer)
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)))

async function pbkdf2(senha: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits'])
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITER }, key, 256))
}
function igual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
function codigoRec() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return [...crypto.getRandomValues(new Uint8Array(16))].map((x) => a[x % a.length]).join('').replace(/(.{4})(?=.)/g, '$1-')
}

class HttpError extends Error {
  status: number
  constructor(status: number, msg: string) {
    super(msg)
    this.status = status
  }
}
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } })

async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new HttpError(400, 'Requisição inválida.')
  }
}

const publicUser = (u: User) => ({ id: u.id, nome: u.nome, login: u.login, email: u.email, papel: u.papel, pessoa: u.pessoa, ativo: !!u.ativo, ultimoAcesso: u.ultimo_acesso, _updated: u.updated_at })
const sessUser = (u: User) => ({ id: u.id, nome: u.nome, papel: u.papel })

function cookie(token: string, maxAge: number) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
}

async function abrirSessao(env: Env, u: User, lembrar: boolean) {
  const token = rand(32)
  const dur = lembrar ? 30 * 86400 : 12 * 3600
  const exp = new Date(Date.now() + dur * 1000).toISOString()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)').bind(await sha256(token), u.id, exp),
    env.DB.prepare('UPDATE users SET ultimo_acesso = ?, falhas = 0, bloqueado_ate = NULL, updated_at = ? WHERE id = ?').bind(now(), now(), u.id),
    env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now()),
  ])
  return cookie(token, dur)
}

async function usuarioDaSessao(req: Request, env: Env): Promise<{ user: User; token: string } | null> {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`))
  if (!m) return null
  const t = await sha256(m[1])
  const u = await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires > ? AND u.ativo = 1').bind(t, now()).first<User>()
  return u ? { user: u, token: t } : null
}

// ───────── roteador
export async function handleApi(req: Request, env: Env): Promise<Response> {
  try {
    if (!env.DB || !env.FILES) return json({ erro: 'Servidor sem banco (D1) ou bucket (R2) vinculados. Configure os bindings DB e FILES no projeto do Cloudflare.' }, 500)
    await migrate(env.DB)
    const url = new URL(req.url)
    const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/'
    const method = req.method.toUpperCase()
    // proteção contra CSRF: escritas exigem cabeçalho próprio (não enviável por outro site sem CORS)
    if (method !== 'GET' && method !== 'HEAD' && req.headers.get('x-chiefdeck') !== '1') throw new HttpError(403, 'Requisição bloqueada.')

    // ── rotas públicas
    if (path === '/health') {
      const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>()
      return json({ ok: true, server: true, temUsuarios: (n?.n ?? 0) > 0, setupConfigurado: !!env.SETUP_TOKEN })
    }
    if (path === '/setup' && method === 'POST') return await setup(req, env)
    if (path === '/login' && method === 'POST') return await login(req, env)
    if (path === '/recover' && method === 'POST') return await recover(req, env)

    // ── rotas autenticadas
    const s = await usuarioDaSessao(req, env)
    if (!s) throw new HttpError(401, 'Sessão expirada. Entre novamente.')
    const u = s.user
    const escreve = u.papel !== 'Leitura'
    const admin = u.papel === 'Administrador'

    if (path === '/logout' && method === 'POST') {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(s.token).run()
      return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) })
    }
    if (path === '/me') return json({ user: sessUser(u) })

    if (path === '/data' && method === 'GET') {
      const [items, files, users] = await env.DB.batch([
        env.DB.prepare('SELECT col, data FROM items WHERE deleted = 0'),
        env.DB.prepare('SELECT id, col, item_id, name, type, size, added, by, meta FROM files WHERE deleted = 0'),
        env.DB.prepare(admin ? 'SELECT * FROM users ORDER BY nome' : 'SELECT * FROM users WHERE id = ?').bind(...(admin ? [] : [u.id])),
      ])
      const db: Record<string, unknown[]> = {}
      for (const r of items.results as { col: string; data: string }[]) (db[r.col] ??= []).push(JSON.parse(r.data))
      db.usuarios = (users.results as User[]).map(publicUser)
      return json({ db, files: (files.results as FileRow[]).map(fileOut), now: now(), user: sessUser(u) })
    }

    if (path === '/changes' && method === 'GET') {
      const since = url.searchParams.get('since') ?? '1970-01-01'
      const desde = new Date(new Date(since).getTime() - 3000).toISOString() // sobreposição para não perder escritas concorrentes
      const [items, files, users] = await env.DB.batch([
        env.DB.prepare('SELECT col, id, data, deleted FROM items WHERE updated_at > ?').bind(desde),
        env.DB.prepare('SELECT id, col, item_id, name, type, size, added, by, meta, deleted FROM files WHERE updated_at > ?').bind(desde),
        env.DB.prepare(admin ? 'SELECT * FROM users WHERE updated_at > ?' : 'SELECT * FROM users WHERE id = ? AND updated_at > ?').bind(...(admin ? [desde] : [u.id, desde])),
      ])
      return json({
        items: (items.results as { col: string; id: string; data: string; deleted: number }[]).map((r) => ({ col: r.col, id: r.id, data: r.deleted ? null : JSON.parse(r.data) })),
        files: (files.results as (FileRow & { deleted: number })[]).map((f) => ({ ...fileOut(f), deleted: !!f.deleted })),
        usuarios: (users.results as User[]).map(publicUser),
        now: now(),
        user: sessUser(u),
      })
    }

    let m = path.match(/^\/items\/([^/]+)\/([^/]+)$/)
    if (m) {
      const [col, id] = [decodeURIComponent(m[1]), decodeURIComponent(m[2])]
      if (!COL.test(col) || col === 'usuarios' || id.length > 80) throw new HttpError(400, 'Coleção ou id inválido.')
      if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
      const t = now()
      if (method === 'PUT') {
        const item = await body<Record<string, unknown>>(req)
        const prev = await env.DB.prepare('SELECT data FROM items WHERE col = ? AND id = ? AND deleted = 0').bind(col, id).first<{ data: string }>()
        const base = prev ? (JSON.parse(prev.data) as Record<string, unknown>) : {}
        const saved = { ...base, ...item, id, _created: base._created ?? t, _createdBy: base._createdBy ?? u.nome, _updated: t, _updatedBy: u.nome }
        const data = JSON.stringify(saved)
        if (data.length > MAX_ITEM) throw new HttpError(413, 'Registro grande demais. Use anexos para conteúdos extensos.')
        await env.DB.prepare('INSERT INTO items (col, id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0').bind(col, id, data, t).run()
        return json({ item: saved })
      }
      if (method === 'DELETE') {
        await env.DB.prepare('UPDATE items SET deleted = 1, updated_at = ? WHERE col = ? AND id = ?').bind(t, col, id).run()
        return json({ ok: true })
      }
    }

    if (path === '/bulk' && method === 'POST') {
      // gravação em lote de um módulo (importação de tickets, budget, despesas…)
      if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
      const b = await body<{ col: string; items: Record<string, unknown>[]; substituir?: boolean }>(req)
      if (!COL.test(b.col ?? '') || b.col === 'usuarios' || !Array.isArray(b.items)) throw new HttpError(400, 'Lote inválido.')
      const t = now()
      const stmts: D1PreparedStatement[] = b.substituir ? [env.DB.prepare('UPDATE items SET deleted = 1, updated_at = ? WHERE col = ? AND deleted = 0').bind(t, b.col)] : []
      for (const r of b.items) {
        if (!r || typeof r.id !== 'string' || r.id.length > 80) continue
        const data = JSON.stringify({ ...r, _created: r._created ?? t, _createdBy: r._createdBy ?? u.nome, _updated: t, _updatedBy: u.nome })
        stmts.push(env.DB.prepare('INSERT INTO items (col, id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0').bind(b.col, r.id, data, t))
      }
      for (let i = 0; i < stmts.length; i += 200) await env.DB.batch(stmts.slice(i, i + 200))
      return json({ ok: true, gravados: b.items.length })
    }

    // ── calendário do Outlook (link ICS publicado)
    if (path === '/calendar' && method === 'GET') return json(await statusCalendario(env))
    if (path === '/calendar' && method === 'PUT') {
      if (!admin) throw new HttpError(403, 'Somente administradores configuram o calendário.')
      const b = await body<{ url: string }>(req)
      const link = String(b.url ?? '').trim().replace(/^webcal:/i, 'https:')
      if (!/^https:\/\/[^\s]+$/i.test(link) && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/i.test(link)) throw new HttpError(400, 'Cole o link ICS completo (começa com https:// ou webcal://).')
      const r = await sincronizarCalendario(env, link) // valida o link antes de salvar
      await env.DB.prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind('ics_url', link, now()).run()
      return json({ ...(await statusCalendario(env)), resultado: r })
    }
    if (path === '/calendar' && method === 'DELETE') {
      if (!admin) throw new HttpError(403, 'Somente administradores.')
      await env.DB.prepare("DELETE FROM config WHERE key IN ('ics_url', 'ics_status')").run()
      if (url.searchParams.has('eventos')) await env.DB.prepare("UPDATE items SET deleted = 1, updated_at = ? WHERE col = 'reunioes' AND deleted = 0 AND json_extract(data, '$.origem') = 'Outlook'").bind(now()).run()
      return json(await statusCalendario(env))
    }
    if (path === '/calendar/sync' && method === 'POST') {
      if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
      const link = (await env.DB.prepare("SELECT value FROM config WHERE key = 'ics_url'").first<{ value: string }>())?.value
      if (!link) throw new HttpError(400, 'Calendário do Outlook não configurado.')
      const se = url.searchParams.has('seAntigo')
      const st = await statusCalendario(env)
      if (se && st.ultima?.em && Date.now() - new Date(st.ultima.em).getTime() < 60 * 60000) return json({ ...st, pulado: true })
      const r = await sincronizarCalendario(env, link)
      return json({ ...(await statusCalendario(env)), resultado: r })
    }

    if (path === '/import' && method === 'POST') {
      if (!admin) throw new HttpError(403, 'Somente administradores restauram backups.')
      const { db } = await body<{ db: Record<string, Record<string, unknown>[]> }>(req)
      const t = now()
      const stmts: D1PreparedStatement[] = [env.DB.prepare('UPDATE items SET deleted = 1, updated_at = ? WHERE deleted = 0').bind(t)]
      for (const [col, rows] of Object.entries(db ?? {})) {
        if (!COL.test(col) || col === 'usuarios' || !Array.isArray(rows)) continue
        for (const r of rows) {
          if (!r || typeof r.id !== 'string') continue
          stmts.push(env.DB.prepare('INSERT INTO items (col, id, data, updated_at, deleted) VALUES (?, ?, ?, ?, 0) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0').bind(col, r.id, JSON.stringify(r), t))
        }
      }
      for (let i = 0; i < stmts.length; i += 200) await env.DB.batch(stmts.slice(i, i + 200))
      return json({ ok: true, registros: stmts.length - 1 })
    }

    // ── usuários
    if (path === '/users' && method === 'POST') {
      if (!admin) throw new HttpError(403, 'Somente administradores criam usuários.')
      return await salvarUsuario(env, await body(req), null, u)
    }
    m = path.match(/^\/users\/([^/]+)$/)
    if (m) {
      const id = decodeURIComponent(m[1])
      if (method === 'PUT') {
        if (!admin && id !== u.id) throw new HttpError(403, 'Você só pode alterar o próprio cadastro.')
        return await salvarUsuario(env, await body(req), id, u)
      }
      if (method === 'DELETE') {
        if (!admin) throw new HttpError(403, 'Somente administradores excluem usuários.')
        if (id === u.id) throw new HttpError(400, 'Você não pode excluir o próprio usuário.')
        await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id), env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id)])
        return json({ ok: true })
      }
    }

    // ── anexos
    if (path === '/files' && method === 'POST') {
      if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
      const col = url.searchParams.get('col') ?? ''
      const itemId = url.searchParams.get('item') ?? ''
      if (!COL.test(col) || !itemId || itemId.length > 80) throw new HttpError(400, 'Registro do anexo inválido.')
      const size = Number(req.headers.get('content-length') ?? 0)
      if (size > MAX_FILE) throw new HttpError(413, 'Arquivo acima de 50 MB.')
      const id = (req.headers.get('x-file-id') ?? '').match(/^[a-z0-9]{6,40}$/i)?.[0] ?? rand(12)
      const name = decodeURIComponent(req.headers.get('x-file-name') ?? 'arquivo').slice(0, 250)
      const type = req.headers.get('content-type') ?? 'application/octet-stream'
      const meta = limparMeta(req.headers.get('x-file-meta'))
      const added = req.headers.get('x-file-added') ?? now()
      const by = req.headers.get('x-file-by') ? decodeURIComponent(req.headers.get('x-file-by')!) : u.nome
      const obj = await env.FILES.put(id, req.body, { httpMetadata: { contentType: type } })
      const t = now()
      await env.DB.prepare('INSERT INTO files (id, col, item_id, name, type, size, added, by, meta, deleted, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?) ON CONFLICT (id) DO UPDATE SET col = excluded.col, item_id = excluded.item_id, name = excluded.name, type = excluded.type, size = excluded.size, meta = excluded.meta, deleted = 0, updated_at = excluded.updated_at')
        .bind(id, col, itemId, name, type, obj?.size ?? size, added, by, meta, t)
        .run()
      return json({ file: fileOut({ id, col, item_id: itemId, name, type, size: obj?.size ?? size, added, by, meta }) })
    }
    if (path === '/files' && method === 'DELETE') {
      // usado na restauração de backup: apaga todos os anexos
      if (!admin) throw new HttpError(403, 'Somente administradores.')
      const ids = (await env.DB.prepare('SELECT id FROM files WHERE deleted = 0').all<{ id: string }>()).results.map((r) => r.id)
      for (let i = 0; i < ids.length; i += 500) await env.FILES.delete(ids.slice(i, i + 500))
      await env.DB.prepare('UPDATE files SET deleted = 1, updated_at = ? WHERE deleted = 0').bind(now()).run()
      return json({ ok: true, removidos: ids.length })
    }
    m = path.match(/^\/files\/([a-z0-9]{6,40})$/i)
    if (m) {
      const id = m[1]
      const f = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND deleted = 0').bind(id).first<FileRow>()
      if (!f) throw new HttpError(404, 'Anexo não encontrado.')
      if (method === 'GET') {
        const obj = await env.FILES.get(id)
        if (!obj) throw new HttpError(404, 'Conteúdo do anexo não encontrado.')
        const inline = !url.searchParams.has('download') && /^(image\/|application\/pdf|text\/plain)/.test(f.type ?? '')
        return new Response(obj.body, {
          headers: {
            'content-type': f.type || 'application/octet-stream',
            'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
            'cache-control': 'private, no-store',
            'x-content-type-options': 'nosniff',
            'content-security-policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
          },
        })
      }
      if (method === 'DELETE') {
        if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
        await env.FILES.delete(id)
        await env.DB.prepare('UPDATE files SET deleted = 1, updated_at = ? WHERE id = ?').bind(now(), id).run()
        return json({ ok: true })
      }
    }

    throw new HttpError(404, 'Rota não encontrada.')
  } catch (e) {
    if (e instanceof HttpError) return json({ erro: e.message }, e.status)
    console.error(e)
    return json({ erro: 'Erro interno no servidor.' }, 500)
  }
}

type FileRow = { id: string; col: string; item_id: string; name: string; type: string | null; size: number; added: string; by: string | null; meta: string | null }
const fileOut = (f: FileRow) => ({ id: f.id, col: f.col, itemId: f.item_id, name: f.name, type: f.type ?? '', size: f.size, added: f.added, by: f.by ?? undefined, meta: lerMeta(f.meta) })

/** Lê metadados gravados; um registro antigo corrompido não pode derrubar o carregamento. */
function lerMeta(m: string | null): Record<string, string> | undefined {
  if (!m) return undefined
  try {
    const o = JSON.parse(m)
    return o && typeof o === 'object' ? o : undefined
  } catch {
    return undefined
  }
}

// Limites por campo dos dados de e-mail (assunto, remetente, destinatários, resumo)
const LIM_META: Record<string, number> = { assunto: 300, de: 300, para: 1000, data: 40, resumo: 400 }
/** Valida e encurta campo a campo (nunca corta o JSON no meio). */
function limparMeta(h: string | null): string | null {
  if (!h) return null
  let o: unknown
  try {
    o = JSON.parse(decodeURIComponent(h))
  } catch {
    return null
  }
  if (!o || typeof o !== 'object') return null
  const out: Record<string, string> = {}
  for (const [k, lim] of Object.entries(LIM_META)) {
    const v = (o as Record<string, unknown>)[k]
    if (typeof v === 'string' && v) out[k] = v.length > lim ? v.slice(0, lim - 1) + '…' : v
  }
  return Object.keys(out).length ? JSON.stringify(out) : null
}

// ───────── autenticação
async function setup(req: Request, env: Env) {
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>()
  if ((n?.n ?? 0) > 0) throw new HttpError(409, 'O administrador já foi criado. Use o login.')
  if (!env.SETUP_TOKEN) throw new HttpError(503, 'Defina a variável secreta SETUP_TOKEN no projeto do Cloudflare para liberar o primeiro acesso.')
  const b = await body<{ chave: string; nome: string; login: string; senha: string; lembrar?: boolean }>(req)
  if (!igual(String(b.chave ?? ''), env.SETUP_TOKEN)) throw new HttpError(403, 'Chave de instalação incorreta.')
  if (!b.nome?.trim() || !b.login?.trim()) throw new HttpError(400, 'Informe nome e usuário.')
  if (String(b.senha ?? '').length < 8) throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.')
  const codigo = codigoRec()
  const id = rand(8)
  const salt = rand(16)
  const recSalt = rand(16)
  const t = now()
  await env.DB.prepare('INSERT INTO users (id, login, nome, papel, ativo, salt, hash, rec_salt, rec_hash, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)')
    .bind(id, b.login.trim(), b.nome.trim(), 'Administrador', salt, await pbkdf2(b.senha, salt), recSalt, await pbkdf2(codigo.replace(/-/g, ''), recSalt), t)
    .run()
  const u = (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>())!
  return json({ user: sessUser(u), codigo }, 200, { 'set-cookie': await abrirSessao(env, u, !!b.lembrar) })
}

async function login(req: Request, env: Env) {
  const b = await body<{ login: string; senha: string; lembrar?: boolean }>(req)
  const k = String(b.login ?? '').trim()
  const u = await env.DB.prepare('SELECT * FROM users WHERE (login = ? OR lower(email) = lower(?)) AND ativo = 1').bind(k, k).first<User>()
  const falha = new HttpError(401, 'Usuário ou senha incorretos.')
  if (!u) {
    await pbkdf2(String(b.senha ?? ''), 'x') // tempo constante: não revela se o usuário existe
    throw falha
  }
  if (u.bloqueado_ate && u.bloqueado_ate > now()) throw new HttpError(429, 'Muitas tentativas. Tente novamente em alguns minutos.')
  if (!igual(await pbkdf2(String(b.senha ?? ''), u.salt), u.hash)) {
    const f = u.falhas + 1
    await env.DB.prepare('UPDATE users SET falhas = ?, bloqueado_ate = ? WHERE id = ?')
      .bind(f >= 5 ? 0 : f, f >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null, u.id)
      .run()
    throw f >= 5 ? new HttpError(429, 'Muitas tentativas. Acesso bloqueado por 15 minutos.') : falha
  }
  return json({ user: sessUser(u) }, 200, { 'set-cookie': await abrirSessao(env, u, !!b.lembrar) })
}

async function recover(req: Request, env: Env) {
  const b = await body<{ login: string; codigo: string; senha: string }>(req)
  const u = await env.DB.prepare('SELECT * FROM users WHERE login = ? AND ativo = 1').bind(String(b.login ?? '').trim()).first<User>()
  const erro = new HttpError(403, 'Usuário ou código de recuperação inválido.')
  if (!u?.rec_salt || !u.rec_hash) throw erro
  if (u.bloqueado_ate && u.bloqueado_ate > now()) throw new HttpError(429, 'Muitas tentativas. Tente novamente em alguns minutos.')
  if (!igual(await pbkdf2(String(b.codigo ?? '').replace(/[-\s]/g, '').toUpperCase(), u.rec_salt), u.rec_hash)) {
    await env.DB.prepare('UPDATE users SET falhas = falhas + 1, bloqueado_ate = CASE WHEN falhas + 1 >= 5 THEN ? ELSE NULL END WHERE id = ?').bind(new Date(Date.now() + 15 * 60000).toISOString(), u.id).run()
    throw erro
  }
  if (String(b.senha ?? '').length < 8) throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.')
  const salt = rand(16)
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET salt = ?, hash = ?, updated_at = ? WHERE id = ?').bind(salt, await pbkdf2(b.senha, salt), now(), u.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id),
  ])
  return json({ user: sessUser(u) }, 200, { 'set-cookie': await abrirSessao(env, u, false) })
}

type UserIn = { nome?: string; login?: string; email?: string; papel?: string; pessoa?: string | null; ativo?: boolean; senha?: string }
async function salvarUsuario(env: Env, b: UserIn, id: string | null, quem: User) {
  const admin = quem.papel === 'Administrador'
  const atual = id ? await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>() : null
  if (id && !atual) throw new HttpError(404, 'Usuário não encontrado.')
  const papel = admin ? (b.papel ?? atual?.papel ?? 'Gestor') : atual!.papel
  if (!['Administrador', 'Gestor', 'Leitura'].includes(papel)) throw new HttpError(400, 'Perfil inválido.')
  const ativo = admin ? (b.ativo ?? !!(atual?.ativo ?? 1)) : true
  if (atual?.papel === 'Administrador' && (papel !== 'Administrador' || !ativo)) {
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE papel = 'Administrador' AND ativo = 1 AND id <> ?").bind(atual.id).first<{ n: number }>()
    if (!n?.n) throw new HttpError(400, 'Precisa existir pelo menos um administrador ativo.')
  }
  const nome = String(b.nome ?? atual?.nome ?? '').trim()
  const login = admin ? String(b.login ?? atual?.login ?? '').trim() : atual!.login
  if (!nome || !login) throw new HttpError(400, 'Informe nome e usuário.')
  if (b.senha && b.senha.length < 8) throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.')
  if (!atual && !b.senha) throw new HttpError(400, 'Defina uma senha para o novo usuário.')
  const dup = await env.DB.prepare('SELECT id FROM users WHERE login = ? AND id <> ?').bind(login, id ?? '').first()
  if (dup) throw new HttpError(409, 'Já existe um usuário com esse login.')
  const t = now()
  const salt = b.senha ? rand(16) : atual!.salt
  const hash = b.senha ? await pbkdf2(b.senha, salt) : atual!.hash
  const uid = id ?? rand(8)
  await env.DB.prepare(
    'INSERT INTO users (id, login, nome, email, papel, pessoa, ativo, salt, hash, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET login = excluded.login, nome = excluded.nome, email = excluded.email, papel = excluded.papel, pessoa = excluded.pessoa, ativo = excluded.ativo, salt = excluded.salt, hash = excluded.hash, updated_at = excluded.updated_at',
  )
    .bind(uid, login, nome, b.email ?? atual?.email ?? null, papel, admin ? (b.pessoa ?? null) : (atual?.pessoa ?? null), ativo ? 1 : 0, salt, hash, t)
    .run()
  if (!ativo || (b.senha && id && id !== quem.id)) await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(uid).run()
  const u = (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(uid).first<User>())!
  return json({ user: publicUser(u) })
}

// ───────── sincronização do calendário
type StatusCal = { em: string; eventos: number; novos: number; alterados: number; removidos: number; erro?: string }

async function statusCalendario(env: Env) {
  const rows = (await env.DB.prepare("SELECT key, value FROM config WHERE key IN ('ics_url', 'ics_status')").all<{ key: string; value: string }>()).results
  const link = rows.find((r) => r.key === 'ics_url')?.value
  const st = rows.find((r) => r.key === 'ics_status')?.value
  let host: string | null = null
  try {
    host = link ? new URL(link).host : null
  } catch {
    host = null
  }
  // o link é tratado como senha: nunca volta para a tela, só o domínio
  return { configurado: !!link, host, ultima: st ? (JSON.parse(st) as StatusCal) : null }
}

const CAMPOS_USUARIO = ['preparado', 'pauta', 'materiais', 'decisoes', 'roteiro', 'etiquetas']

async function sincronizarCalendario(env: Env, link: string) {
  const salvarStatus = (st: StatusCal) =>
    env.DB.prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind('ics_status', JSON.stringify(st), now()).run()
  let txt: string
  try {
    const r = await fetch(link, { headers: { accept: 'text/calendar, */*' }, redirect: 'follow', cf: { cacheTtl: 0 } } as RequestInit)
    if (!r.ok) throw new Error(`o Outlook respondeu ${r.status}`)
    txt = await r.text()
    if (txt.length > 15_000_000) throw new Error('calendário grande demais')
    if (!/BEGIN:VCALENDAR/i.test(txt)) throw new Error('o link não devolveu um calendário (.ics)')
  } catch (e) {
    const erro = `Não foi possível ler o calendário: ${(e as Error).message}.`
    await salvarStatus({ em: now(), eventos: 0, novos: 0, alterados: 0, removidos: 0, erro })
    throw new HttpError(502, erro)
  }
  const de = Date.now() - 30 * 86400000
  const ate = Date.now() + 120 * 86400000
  const ocs = lerIcs(txt, de, ate)
  const t = now()
  const atuais = (await env.DB.prepare("SELECT id, data FROM items WHERE col = 'reunioes' AND deleted = 0 AND json_extract(data, '$.origem') = 'Outlook'").all<{ id: string; data: string }>()).results
  const mapa = new Map(atuais.map((r) => [r.id, JSON.parse(r.data) as Record<string, unknown>]))
  const stmts: D1PreparedStatement[] = []
  const put = (id: string, item: Record<string, unknown>) =>
    stmts.push(env.DB.prepare("INSERT INTO items (col, id, data, updated_at, deleted) VALUES ('reunioes', ?, ?, ?, 0) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0").bind(id, JSON.stringify(item), t))
  let novos = 0
  let alterados = 0
  let removidos = 0
  const vistos = new Set<string>()
  for (const o of ocs) {
    vistos.add(o.id)
    const campos = camposOutlook(o)
    const sugerido = campos.tipoSugerido
    delete campos.tipoSugerido
    const ant = mapa.get(o.id)
    if (!ant) {
      put(o.id, { id: o.id, ...campos, tipo: sugerido ?? null, preparado: false, _created: t, _createdBy: 'Outlook', _updated: t, _updatedBy: 'Outlook' })
      novos++
      continue
    }
    const mudou = Object.entries(campos).some(([k, v]) => JSON.stringify(ant[k] ?? null) !== JSON.stringify(v ?? null)) || ant.canceladaOutlook
    if (mudou) {
      put(o.id, { ...ant, ...campos, canceladaOutlook: false, _updated: t, _updatedBy: 'Outlook' })
      alterados++
    }
  }
  // reuniões que saíram do Outlook dentro da janela: apaga, ou marca como cancelada se você já anotou algo nela
  const deDia = new Date(de).toISOString().slice(0, 10)
  const ateDia = new Date(ate).toISOString().slice(0, 10)
  for (const [id, ant] of mapa) {
    if (vistos.has(id)) continue
    const dia = String(ant.data ?? '')
    if (dia < deDia || dia > ateDia) continue
    const anotada = CAMPOS_USUARIO.some((k) => (Array.isArray(ant[k]) ? (ant[k] as unknown[]).length > 0 : !!ant[k] && ant[k] !== ''))
    if (anotada) {
      if (!ant.canceladaOutlook) put(id, { ...ant, canceladaOutlook: true, _updated: t, _updatedBy: 'Outlook' })
    } else stmts.push(env.DB.prepare("UPDATE items SET deleted = 1, updated_at = ? WHERE col = 'reunioes' AND id = ?").bind(t, id))
    removidos++
  }
  for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100))
  const st: StatusCal = { em: now(), eventos: ocs.length, novos, alterados, removidos }
  await salvarStatus(st)
  return st
}
