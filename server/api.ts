/// <reference types="@cloudflare/workers-types" />
import { camposOutlook, lerIcs, origemIcs, type OrigemCal } from '../src/shared/ics'
import { chaveArquivo, filtrarCampos, lerConta, motivo, PESSOAL, podeVer, type Conta, type Ctx } from './contas'
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
  papel: 'Administrador' | 'Gestor' | 'Colaborador' | 'Leitura'
  pessoa: string | null
  conta_id: string
  plataforma: number
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

// Todos os dados levam conta_id: cada cliente (conta) só enxerga os próprios registros.
// A conta 'c1' é a instalação original (os dados de antes das contas ficam nela).
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS contas (id TEXT PRIMARY KEY, nome TEXT NOT NULL, plano TEXT NOT NULL DEFAULT 'empresa', modulos TEXT, ativo INTEGER NOT NULL DEFAULT 1, opcoes TEXT, criada_em TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS items (conta_id TEXT NOT NULL DEFAULT 'c1', col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (conta_id, col, id))`,
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE COLLATE NOCASE, nome TEXT NOT NULL, email TEXT, papel TEXT NOT NULL, pessoa TEXT, ativo INTEGER NOT NULL DEFAULT 1, salt TEXT NOT NULL, hash TEXT NOT NULL, rec_salt TEXT, rec_hash TEXT, ultimo_acesso TEXT, falhas INTEGER NOT NULL DEFAULT 0, bloqueado_ate TEXT, updated_at TEXT, conta_id TEXT NOT NULL DEFAULT 'c1', plataforma INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires TEXT NOT NULL, longa INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, col TEXT NOT NULL, item_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT, size INTEGER, added TEXT, by TEXT, meta TEXT, deleted INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, conta_id TEXT NOT NULL DEFAULT 'c1', dono TEXT)`,
  `CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
]
const INDICES = [
  `CREATE INDEX IF NOT EXISTS items_conta_upd ON items (conta_id, updated_at)`,
  `CREATE INDEX IF NOT EXISTS files_conta_upd ON files (conta_id, updated_at)`,
  `CREATE INDEX IF NOT EXISTS users_conta ON users (conta_id)`,
]
/** Garante que nada pessoal fique sem dono: registros (_dono) e arquivos (dono) de cada conta passam a ser de
 *  quem os criou (pelo nome) ou, se não der para saber, do responsável pela conta (dono da plataforma, senão o
 *  primeiro administrador, senão o primeiro usuário). Roda a cada início do servidor e grava o resultado em config. */
async function darDonoAosSemDono(db: D1Database) {
  const cols = [...PESSOAL]
  const responsavel = (t: string) =>
    `COALESCE((SELECT u.id FROM users u WHERE u.conta_id = ${t}.conta_id AND u.plataforma = 1 ORDER BY u.rowid LIMIT 1),
              (SELECT u.id FROM users u WHERE u.conta_id = ${t}.conta_id AND u.papel = 'Administrador' ORDER BY u.rowid LIMIT 1),
              (SELECT u.id FROM users u WHERE u.conta_id = ${t}.conta_id ORDER BY u.rowid LIMIT 1))`
  const st: Record<string, unknown> = { em: now() }
  try {
    const [ri, rf] = await db.batch([
      db
        .prepare(
          `UPDATE items SET data = json_set(data, '$._dono', COALESCE((SELECT u.id FROM users u WHERE u.conta_id = items.conta_id AND u.nome = json_extract(items.data, '$._createdBy') ORDER BY u.rowid LIMIT 1), ${responsavel('items')})), updated_at = ?
           WHERE (COALESCE(json_type(data, '$._dono'), '') <> 'text' OR json_extract(data, '$._dono') = '') AND col IN (${cols.map(() => '?').join(', ')}) AND ${responsavel('items')} IS NOT NULL`,
        )
        .bind(now(), ...cols),
      db
        .prepare(
          `UPDATE files SET dono = COALESCE((SELECT u.id FROM users u WHERE u.conta_id = files.conta_id AND u.nome = files.by ORDER BY u.rowid LIMIT 1), ${responsavel('files')}), updated_at = ?
           WHERE (dono IS NULL OR dono = '') AND ${responsavel('files')} IS NOT NULL`,
        )
        .bind(now()),
    ])
    st.itens = ri.meta?.changes ?? 0
    st.arquivos = rf.meta?.changes ?? 0
  } catch (e) {
    st.erro = (e as Error).message
    console.error('darDonoAosSemDono', e)
  }
  await db.prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('dono_status', ?, ?)").bind(JSON.stringify(st), now()).run().catch(() => undefined)
}

const temColuna = (db: D1Database, tab: string, col: string) =>
  db
    .prepare(`SELECT ${col} FROM ${tab} LIMIT 1`)
    .first()
    .then(() => true)
    .catch(() => false)

let migrated = false
async function migrate(db: D1Database) {
  if (migrated) return
  await db.batch(SCHEMA.map((s) => db.prepare(s)))
  // bancos antigos (antes das contas): ganham as colunas novas sem perder nada
  const add = (sql: string) =>
    db
      .prepare(sql)
      .run()
      .catch(() => undefined) // já existe
  await add('ALTER TABLE sessions ADD COLUMN longa INTEGER NOT NULL DEFAULT 0')
  await add("ALTER TABLE users ADD COLUMN conta_id TEXT NOT NULL DEFAULT 'c1'")
  await add('ALTER TABLE users ADD COLUMN plataforma INTEGER NOT NULL DEFAULT 0')
  await add("ALTER TABLE files ADD COLUMN conta_id TEXT NOT NULL DEFAULT 'c1'")
  await add('ALTER TABLE files ADD COLUMN dono TEXT') // quem enviou (vale para arquivos soltos, ex.: pasta principal de Arquivos)
  if (!(await temColuna(db, 'items', 'conta_id'))) {
    // a chave dos registros passa a incluir a conta: recria a tabela copiando tudo para a conta 1 (numa transação)
    await db.batch([
      db.prepare(`CREATE TABLE items_nova (conta_id TEXT NOT NULL DEFAULT 'c1', col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (conta_id, col, id))`),
      db.prepare(`INSERT INTO items_nova (conta_id, col, id, data, updated_at, deleted) SELECT 'c1', col, id, data, updated_at, deleted FROM items`),
      db.prepare('DROP TABLE items'),
      db.prepare('ALTER TABLE items_nova RENAME TO items'),
    ])
  }
  await db.batch([
    ...INDICES.map((s) => db.prepare(s)),
    db.prepare("INSERT OR IGNORE INTO contas (id, nome, plano, ativo, criada_em) VALUES ('c1', 'Conta principal', 'empresa', 1, ?)").bind(now()),
    // o primeiro administrador da instalação é o dono da plataforma
    db.prepare("UPDATE users SET plataforma = 1 WHERE id = (SELECT id FROM users WHERE papel = 'Administrador' AND conta_id = 'c1' ORDER BY rowid LIMIT 1) AND NOT EXISTS (SELECT 1 FROM users WHERE plataforma = 1)"),
  ])
  // calendários deixam de ser da instalação e passam a ser de cada usuário: os antigos ficam com o dono da plataforma
  const dono = await db.prepare('SELECT id FROM users WHERE plataforma = 1 LIMIT 1').first<{ id: string }>()
  if (dono) {
    const velhas = (await db.prepare("SELECT key FROM config WHERE key IN ('ics_cals', 'ics_url', 'ics_status') OR key LIKE 'ics_status_%'").all<{ key: string }>()).results
    if (velhas.length)
      await db.batch([
        ...velhas.map((r) => db.prepare('UPDATE OR REPLACE config SET key = ? WHERE key = ?').bind(`u:${dono.id}:${r.key}`, r.key)),
      ])
  }
  await darDonoAosSemDono(db)
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
const sessUser = (u: User) => ({ id: u.id, nome: u.nome, papel: u.papel, plataforma: !!u.plataforma, conta: u.conta_id })
const PAPEIS_USUARIO = ['Administrador', 'Gestor', 'Colaborador', 'Leitura']

function cookie(token: string, maxAge: number) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
}

const LONGA = 30 * 86400 // "manter conectado": 30 dias, renovados a cada uso

async function abrirSessao(env: Env, u: User, lembrar: boolean) {
  const token = rand(32)
  const dur = lembrar ? LONGA : 12 * 3600
  const exp = new Date(Date.now() + dur * 1000).toISOString()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (token, user_id, expires, longa) VALUES (?, ?, ?, ?)').bind(await sha256(token), u.id, exp, lembrar ? 1 : 0),
    env.DB.prepare('UPDATE users SET ultimo_acesso = ?, falhas = 0, bloqueado_ate = NULL, updated_at = ? WHERE id = ?').bind(now(), now(), u.id),
    env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now()),
  ])
  return cookie(token, dur)
}

async function usuarioDaSessao(req: Request, env: Env): Promise<{ user: User; token: string; renovar?: string } | null> {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`))
  if (!m) return null
  const t = await sha256(m[1])
  const r = await env.DB.prepare('SELECT u.*, s.expires AS s_expires, s.longa AS s_longa FROM sessions s JOIN users u ON u.id = s.user_id JOIN contas c ON c.id = u.conta_id WHERE s.token = ? AND s.expires > ? AND u.ativo = 1 AND c.ativo = 1')
    .bind(t, now())
    .first<User & { s_expires: string; s_longa: number }>()
  if (!r) return null
  // "manter conectado": a cada dia de uso, empurra o vencimento para 30 dias à frente (e renova o cookie)
  let renovar: string | undefined
  if (r.s_longa && new Date(r.s_expires).getTime() - Date.now() < LONGA * 1000 - 86400_000) {
    await env.DB.prepare('UPDATE sessions SET expires = ? WHERE token = ?').bind(new Date(Date.now() + LONGA * 1000).toISOString(), t).run()
    renovar = cookie(m[1], LONGA)
  }
  return { user: r, token: t, renovar }
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
    const ct = u.conta_id
    const ctx = await contexto(env, u)
    const renov = s.renovar ? { 'set-cookie': s.renovar } : undefined
    /** O registro como este usuário pode vê-lo (null = não pode). */
    const ver = (col: string, d: Record<string, unknown>) => (podeVer(ctx, col, d) ? filtrarCampos(ctx, col, d) : null)
    /** Arquivo solto (sem registro, ex.: pasta principal de Arquivos): no plano Empresa só quem enviou vê. */
    const soltoVisivel = (f: { dono?: string | null }) => ctx.conta.plano !== 'empresa' || f.dono === u.id || (!f.dono && admin)
    const contaOut = () => ({ id: ctx.conta.id, nome: ctx.conta.nome, plano: ctx.conta.plano, modulos: ctx.conta.modulos, opcoes: ctx.conta.opcoes })

    if (path === '/logout' && method === 'POST') {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(s.token).run()
      return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) })
    }
    if (path === '/me') return json({ user: sessUser(u), conta: contaOut() }, 200, renov)

    if (path === '/data' && method === 'GET') {
      const [items, files, users] = await env.DB.batch([
        env.DB.prepare('SELECT col, id, data FROM items WHERE conta_id = ? AND deleted = 0').bind(ct),
        env.DB.prepare('SELECT id, col, item_id, name, type, size, added, by, meta, dono FROM files WHERE conta_id = ? AND deleted = 0').bind(ct),
        env.DB.prepare(admin ? 'SELECT * FROM users WHERE conta_id = ? ORDER BY nome' : 'SELECT * FROM users WHERE id = ?').bind(admin ? ct : u.id),
      ])
      const db: Record<string, unknown[]> = {}
      const ocultos = new Set<string>()
      const existem = new Set<string>()
      for (const r of items.results as { col: string; id: string; data: string }[]) {
        existem.add(r.col + '\u0000' + r.id)
        const d = ver(r.col, JSON.parse(r.data))
        if (d) (db[r.col] ??= []).push(d)
        else ocultos.add(r.col + '\u0000' + r.id)
      }
      db.usuarios = (users.results as User[]).map(publicUser)
      const fs = (files.results as FileRow[])
        .filter((f) => {
          const k = f.col + '\u0000' + f.item_id
          return existem.has(k) ? !ocultos.has(k) : soltoVisivel(f)
        })
        .map(fileOut)
      return json({ db, files: fs, now: now(), user: sessUser(u), conta: contaOut() }, 200, renov)
    }

    if (path === '/changes' && method === 'GET') {
      const since = url.searchParams.get('since') ?? '1970-01-01'
      const desde = new Date(new Date(since).getTime() - 3000).toISOString() // sobreposição para não perder escritas concorrentes
      const [items, files, users] = await env.DB.batch([
        env.DB.prepare('SELECT col, id, data, deleted FROM items WHERE conta_id = ? AND updated_at > ?').bind(ct, desde),
        env.DB.prepare('SELECT id, col, item_id, name, type, size, added, by, meta, dono, deleted FROM files WHERE conta_id = ? AND updated_at > ?').bind(ct, desde),
        env.DB.prepare(admin ? 'SELECT * FROM users WHERE conta_id = ? AND updated_at > ?' : 'SELECT * FROM users WHERE id = ? AND updated_at > ?').bind(admin ? ct : u.id, desde),
      ])
      const mudou = (items.results as { col: string; id: string; data: string; deleted: number }[]).map((r) => ({ col: r.col, id: r.id, data: r.deleted ? null : ver(r.col, JSON.parse(r.data)) }))
      // anexos: só os de registros visíveis; quem acabou de receber um registro recebe também os anexos dele
      const fsMud = files.results as (FileRow & { deleted: number })[]
      const pais = new Map<string, boolean | 'solto'>()
      for (const r of mudou) pais.set(r.col + '\u0000' + r.id, !!r.data)
      const faltam = [...new Set(fsMud.map((f) => f.col + '\u0000' + f.item_id).filter((k) => !pais.has(k)))]
      for (const k of faltam) {
        const [col, id] = k.split('\u0000')
        const p = await env.DB.prepare('SELECT data FROM items WHERE conta_id = ? AND col = ? AND id = ? AND deleted = 0').bind(ct, col, id).first<{ data: string }>()
        pais.set(k, p ? podeVer(ctx, col, JSON.parse(p.data)) : 'solto')
      }
      const fsOut = fsMud
        .filter((f) => {
          const v = pais.get(f.col + '\u0000' + f.item_id)
          return v === 'solto' ? soltoVisivel(f) : v !== false
        })
        .map((f) => ({ ...fileOut(f), deleted: !!f.deleted }))
      const novosVisiveis = mudou.filter((r) => r.data && PESSOAL.has(r.col))
      for (let i = 0; i < novosVisiveis.length; i += 40) {
        const lote = novosVisiveis.slice(i, i + 40)
        const r = await env.DB.prepare(`SELECT id, col, item_id, name, type, size, added, by, meta, dono FROM files WHERE conta_id = ? AND deleted = 0 AND (${lote.map(() => '(col = ? AND item_id = ?)').join(' OR ')})`)
          .bind(ct, ...lote.flatMap((x) => [x.col, x.id]))
          .all<FileRow>()
        for (const f of r.results) if (!fsOut.some((x) => x.id === f.id)) fsOut.push({ ...fileOut(f), deleted: false })
      }
      return json({ items: mudou, files: fsOut, usuarios: (users.results as User[]).map(publicUser), now: now(), user: sessUser(u), conta: contaOut() }, 200, renov)
    }

    let m = path.match(/^\/items\/([^/]+)\/([^/]+)$/)
    if (m) {
      const [col, id] = [decodeURIComponent(m[1]), decodeURIComponent(m[2])]
      if (!COL.test(col) || col === 'usuarios' || id.length > 80) throw new HttpError(400, 'Coleção ou id inválido.')
      const t = now()
      if (col === 'humor') {
        // termômetro de humor: voto anônimo de qualquer usuário — não grava autoria, só semana e nota
        if (method !== 'PUT') throw new HttpError(403, 'Votos não podem ser alterados.')
        const v = await body<Record<string, unknown>>(req)
        const semana = String(v.semana ?? '')
        const nota = Number(v.nota)
        if (!/^\d{4}-W\d{2}$/.test(semana) || !(nota >= 1 && nota <= 5)) throw new HttpError(400, 'Voto inválido.')
        if (await env.DB.prepare('SELECT 1 FROM items WHERE conta_id = ? AND col = ? AND id = ?').bind(ct, col, id).first()) throw new HttpError(409, 'Voto já registrado.')
        const saved = { id, semana, nota: Math.round(nota), _created: t.slice(0, 10) }
        await env.DB.prepare('INSERT INTO items (conta_id, col, id, data, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0)').bind(ct, col, id, JSON.stringify(saved), t).run()
        return json({ item: saved })
      }
      if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
      const prev = await env.DB.prepare('SELECT data FROM items WHERE conta_id = ? AND col = ? AND id = ? AND deleted = 0').bind(ct, col, id).first<{ data: string }>()
      const base = prev ? (JSON.parse(prev.data) as Record<string, unknown>) : null
      if (base && !podeVer(ctx, col, base)) throw new HttpError(403, 'Este registro não está compartilhado com você.')
      if (method === 'PUT') {
        // campos de sistema (_…) são definidos aqui; o perfil Colaborador não grava remuneração
        const item = Object.fromEntries(Object.entries(filtrarCampos(ctx, col, await body<Record<string, unknown>>(req))).filter(([k]) => !k.startsWith('_')))
        const b0 = base ?? {}
        const dono = base ? b0._dono : u.id
        const saved = { ...b0, ...item, id, _created: b0._created ?? t, _createdBy: b0._createdBy ?? u.nome, _updated: t, _updatedBy: u.nome, ...(dono ? { _dono: dono } : {}) }
        const data = JSON.stringify(saved)
        if (data.length > MAX_ITEM) throw new HttpError(413, 'Registro grande demais. Use anexos para conteúdos extensos.')
        await env.DB.prepare('INSERT INTO items (conta_id, col, id, data, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT (conta_id, col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0').bind(ct, col, id, data, t).run()
        return json({ item: filtrarCampos(ctx, col, saved) })
      }
      if (method === 'DELETE') {
        await env.DB.prepare('UPDATE items SET deleted = 1, updated_at = ? WHERE conta_id = ? AND col = ? AND id = ?').bind(t, ct, col, id).run()
        return json({ ok: true })
      }
    }

    if ((path === '/bulk-delete' || path === '/bulk') && method === 'POST') {
      if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
      const b = await body<{ col: string; ids?: string[]; items?: Record<string, unknown>[]; substituir?: boolean }>(req)
      if (!COL.test(b.col ?? '') || b.col === 'usuarios' || b.col === 'humor') throw new HttpError(400, 'Lote inválido.')
      const t = now()
      // registros que já existem no módulo: só mexe nos que este usuário pode ver
      const atuais = new Map(
        (await env.DB.prepare('SELECT id, data FROM items WHERE conta_id = ? AND col = ? AND deleted = 0').bind(ct, b.col).all<{ id: string; data: string }>()).results.map((r) => [r.id, JSON.parse(r.data) as Record<string, unknown>]),
      )
      const meu = (id: string) => {
        const d = atuais.get(id)
        return !d || podeVer(ctx, b.col, d)
      }
      const apagar = (id: string) => env.DB.prepare('UPDATE items SET deleted = 1, updated_at = ? WHERE conta_id = ? AND col = ? AND id = ?').bind(t, ct, b.col, id)
      const stmts: D1PreparedStatement[] = []
      if (path === '/bulk-delete') {
        // exclusão em lote (desfazer importação)
        if (!Array.isArray(b.ids)) throw new HttpError(400, 'Lote inválido.')
        for (const id of b.ids) if (typeof id === 'string' && id.length <= 80 && atuais.has(id) && meu(id)) stmts.push(apagar(id))
        for (let i = 0; i < stmts.length; i += 200) await env.DB.batch(stmts.slice(i, i + 200))
        return json({ ok: true, removidos: stmts.length })
      }
      // gravação em lote de um módulo (importação de planilha, tickets, budget, despesas…)
      if (!Array.isArray(b.items)) throw new HttpError(400, 'Lote inválido.')
      const vindos = new Set<string>()
      for (const r0 of b.items) {
        if (!r0 || typeof r0.id !== 'string' || r0.id.length > 80 || !meu(r0.id)) continue
        const r = filtrarCampos(ctx, b.col, r0)
        const ant = atuais.get(r0.id)
        vindos.add(r0.id)
        const dono = ant ? ant._dono : u.id
        const data = JSON.stringify({ ...(ant ?? {}), ...r, id: r0.id, _created: ant?._created ?? r._created ?? t, _createdBy: ant?._createdBy ?? r._createdBy ?? u.nome, _updated: t, _updatedBy: u.nome, ...(dono ? { _dono: dono } : {}) })
        stmts.push(env.DB.prepare('INSERT INTO items (conta_id, col, id, data, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT (conta_id, col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0').bind(ct, b.col, r0.id, data, t))
      }
      if (b.substituir) for (const id of atuais.keys()) if (!vindos.has(id) && meu(id)) stmts.push(apagar(id))
      for (let i = 0; i < stmts.length; i += 200) await env.DB.batch(stmts.slice(i, i + 200))
      return json({ ok: true, gravados: vindos.size })
    }

    // ── calendários externos (links ICS publicados: Outlook, Google, iCloud…) — cada usuário conecta os seus
    if (path === '/calendar' && method === 'GET') return json(await statusCalendarios(env, u))
    if (path === '/calendar' && method === 'POST') {
      if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
      const b = await body<{ url: string; nome?: string }>(req)
      const link = linkIcs(b.url)
      const cals = await lerCalendarios(env, u)
      if (cals.length >= 10) throw new HttpError(400, 'Limite de 10 calendários conectados.')
      if (cals.some((c) => c.url === link)) throw new HttpError(400, 'Este calendário já está conectado.')
      const cal: Cal = { id: crypto.randomUUID().slice(0, 8), nome: '', origem: 'Outro calendário', url: link }
      const r = await sincronizarCalendario(env, u, cal) // valida o link antes de salvar
      cal.nome = String(b.nome ?? '').trim().slice(0, 60) || cal.origem
      await gravarCalendarios(env, u, [...cals, cal])
      return json({ ...(await statusCalendarios(env, u)), resultado: r })
    }
    const mCal = /^\/calendar\/([\w-]{1,20})$/.exec(path)
    if (mCal && (method === 'PUT' || method === 'DELETE')) {
      if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
      const cals = await lerCalendarios(env, u)
      const cal = cals.find((c) => c.id === mCal[1])
      if (!cal) throw new HttpError(404, 'Calendário não encontrado.')
      if (method === 'PUT') {
        const b = await body<{ url?: string; nome?: string }>(req)
        if (b.nome != null) cal.nome = String(b.nome).trim().slice(0, 60) || cal.origem
        let r: StatusCal | undefined
        if (b.url) {
          cal.url = linkIcs(b.url)
          r = await sincronizarCalendario(env, u, cal)
        }
        await gravarCalendarios(env, u, cals)
        return json({ ...(await statusCalendarios(env, u)), resultado: r })
      }
      await gravarCalendarios(env, u, cals.filter((c) => c.id !== cal.id))
      await env.DB.prepare('DELETE FROM config WHERE key = ?').bind(`u:${u.id}:ics_status_${cal.id}`).run()
      if (url.searchParams.has('eventos')) await env.DB.prepare(`UPDATE items SET deleted = 1, updated_at = ? WHERE conta_id = ? AND col = 'reunioes' AND deleted = 0 AND ${DO_CAL}`).bind(now(), ct, u.id, cal.id, cal.id).run()
      return json(await statusCalendarios(env, u))
    }
    if (path === '/calendar/sync' && method === 'POST') {
      if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
      const cals = await lerCalendarios(env, u)
      if (!cals.length) throw new HttpError(400, 'Nenhum calendário conectado.')
      const se = url.searchParams.has('seAntigo')
      const so = url.searchParams.get('id')
      const st = await statusCalendarios(env, u)
      const total: StatusCal = { em: now(), eventos: 0, novos: 0, alterados: 0, removidos: 0 }
      const erros: string[] = []
      let feitos = 0
      for (const cal of cals) {
        if (so && cal.id !== so) continue
        const ult = st.calendarios.find((c) => c.id === cal.id)?.ultima
        if (se && ult?.em && Date.now() - new Date(ult.em).getTime() < 60 * 60000) continue
        try {
          const r = await sincronizarCalendario(env, u, cal)
          for (const k of ['eventos', 'novos', 'alterados', 'removidos'] as const) total[k] += r[k]
        } catch (e) {
          erros.push(`${cal.nome}: ${(e as Error).message}`)
        }
        feitos++
      }
      if (!feitos) return json({ ...st, pulado: true })
      if (erros.length && erros.length === feitos) throw new HttpError(502, erros.join(' '))
      if (erros.length) total.erro = erros.join(' ')
      return json({ ...(await statusCalendarios(env, u)), resultado: total })
    }

    if (path === '/import' && method === 'POST') {
      // restauração de backup: substitui todos os dados desta conta (as outras contas não são tocadas)
      if (!admin) throw new HttpError(403, 'Somente administradores restauram backups.')
      const { db } = await body<{ db: Record<string, Record<string, unknown>[]> }>(req)
      const t = now()
      const stmts: D1PreparedStatement[] = [env.DB.prepare('UPDATE items SET deleted = 1, updated_at = ? WHERE conta_id = ? AND deleted = 0').bind(t, ct)]
      for (const [col, rows] of Object.entries(db ?? {})) {
        if (!COL.test(col) || col === 'usuarios' || !Array.isArray(rows)) continue
        for (const r of rows) {
          if (!r || typeof r.id !== 'string') continue
          // backup antigo (sem dono): os registros pessoais ficam com quem restaurou
          const d = PESSOAL.has(col) && !r._dono ? { ...r, _dono: u.id } : r
          stmts.push(env.DB.prepare('INSERT INTO items (conta_id, col, id, data, updated_at, deleted) VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT (conta_id, col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0').bind(ct, col, r.id, JSON.stringify(d), t))
        }
      }
      for (let i = 0; i < stmts.length; i += 200) await env.DB.batch(stmts.slice(i, i + 200))
      return json({ ok: true, registros: stmts.length - 1 })
    }

    // ── opções da empresa (administrador da conta)
    if (path === '/conta' && method === 'PUT') {
      if (!admin) throw new HttpError(403, 'Somente administradores.')
      const b = await body<{ nome?: string; opcoes?: { gestorVeEquipe?: boolean } }>(req)
      const nome = typeof b.nome === 'string' && b.nome.trim() ? b.nome.trim().slice(0, 80) : ctx.conta.nome
      const opcoes = { ...ctx.conta.opcoes, ...(b.opcoes && typeof b.opcoes.gestorVeEquipe === 'boolean' ? { gestorVeEquipe: b.opcoes.gestorVeEquipe } : {}) }
      await env.DB.prepare('UPDATE contas SET nome = ?, opcoes = ? WHERE id = ?').bind(nome, JSON.stringify(opcoes), ct).run()
      return json({ conta: { ...contaOut(), nome, opcoes } })
    }

    // tomar posse do que estiver sem dono na conta (administrador): registros pessoais e arquivos
    if (path === '/conta/sem-dono' && (method === 'GET' || method === 'POST')) {
      if (!admin) throw new HttpError(403, 'Somente administradores.')
      const cols = [...PESSOAL]
      const filtro = `conta_id = ? AND deleted = 0 AND col IN (${cols.map(() => '?').join(', ')}) AND (COALESCE(json_type(data, '$._dono'), '') <> 'text' OR json_extract(data, '$._dono') = '')`
      if (method === 'POST') {
        const t = now()
        const [ri, rf] = await env.DB.batch([
          env.DB.prepare(`UPDATE items SET data = json_set(data, '$._dono', ?), updated_at = ? WHERE ${filtro}`).bind(u.id, t, ct, ...cols),
          env.DB.prepare("UPDATE files SET dono = ?, updated_at = ? WHERE conta_id = ? AND (dono IS NULL OR dono = '')").bind(u.id, t, ct),
        ])
        return json({ ok: true, itens: ri.meta?.changes ?? 0, arquivos: rf.meta?.changes ?? 0 })
      }
      const [ni, nf, stt] = await env.DB.batch([
        env.DB.prepare(`SELECT COUNT(*) AS n FROM items WHERE ${filtro}`).bind(ct, ...cols),
        env.DB.prepare("SELECT COUNT(*) AS n FROM files WHERE conta_id = ? AND deleted = 0 AND (dono IS NULL OR dono = '')").bind(ct),
        env.DB.prepare("SELECT value FROM config WHERE key = 'dono_status'"),
      ])
      const v = (stt.results[0] as { value?: string } | undefined)?.value
      return json({ itens: (ni.results[0] as { n: number }).n, arquivos: (nf.results[0] as { n: number }).n, ultimaVerificacao: v ? JSON.parse(v) : null })
    }

    // ── painel da plataforma (somente o dono do sistema)
    if (path.startsWith('/plataforma/')) {
      if (!u.plataforma) throw new HttpError(403, 'Somente o dono da plataforma.')
      return await plataforma(req, env, path, method, u)
    }

    // ── usuários (sempre dentro da própria conta)
    if (path === '/users' && method === 'POST') {
      if (!admin) throw new HttpError(403, 'Somente administradores criam usuários.')
      return await salvarUsuario(env, await body(req), null, u)
    }
    // diagnóstico: o que um usuário da conta enxerga nas telas pessoais, e por quê (só administrador)
    const mVisao = /^\/users\/([^/]+)\/visao$/.exec(path)
    if (mVisao && method === 'GET') {
      if (!admin) throw new HttpError(403, 'Somente administradores.')
      const alvo = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND conta_id = ?').bind(decodeURIComponent(mVisao[1]), ct).first<User>()
      if (!alvo) throw new HttpError(404, 'Usuário não encontrado.')
      const cx = await contexto(env, alvo)
      const cols = [...PESSOAL]
      const rows = (
        await env.DB.prepare(`SELECT col, id, data FROM items WHERE conta_id = ? AND deleted = 0 AND col IN (${cols.map(() => '?').join(', ')})`)
          .bind(ct, ...cols)
          .all<{ col: string; id: string; data: string }>()
      ).results
      const nomes = new Map((await env.DB.prepare('SELECT id, nome FROM users WHERE conta_id = ?').bind(ct).all<{ id: string; nome: string }>()).results.map((x) => [x.id, x.nome]))
      const itens: { col: string; id: string; titulo: string; motivo: string; dono: string }[] = []
      for (const r of rows) {
        const d = JSON.parse(r.data) as Record<string, unknown>
        const mo = motivo(cx, r.col, d)
        if (!mo) continue
        const titulo = String(d.titulo ?? d.nome ?? d.assunto ?? d.descricao ?? d.objetivo ?? r.id).slice(0, 120)
        itens.push({ col: r.col, id: r.id, titulo, motivo: mo, dono: typeof d._dono === 'string' ? (nomes.get(d._dono) ?? 'outro usuário') : 'sem dono' })
      }
      return json({ usuario: alvo.nome, papel: alvo.papel, pessoa: alvo.pessoa, plano: cx.conta.plano, gestorVeEquipe: !!cx.conta.opcoes.gestorVeEquipe, total: rows.length, itens })
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
        const alvo = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND conta_id = ?').bind(id, ct).first()
        if (!alvo) throw new HttpError(404, 'Usuário não encontrado.')
        await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id), env.DB.prepare('DELETE FROM users WHERE id = ? AND conta_id = ?').bind(id, ct)])
        return json({ ok: true })
      }
    }

    // ── anexos
    /** O registro dono do anexo está visível para este usuário? (anexo solto: só de quem enviou, no plano Empresa) */
    const paiVisivel = async (col: string, itemId: string, dono: string | null | undefined = u.id) => {
      const p = await env.DB.prepare('SELECT data FROM items WHERE conta_id = ? AND col = ? AND id = ? AND deleted = 0').bind(ct, col, itemId).first<{ data: string }>()
      return p ? podeVer(ctx, col, JSON.parse(p.data)) : soltoVisivel({ dono })
    }
    if (path === '/files' && method === 'POST') {
      if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
      const col = url.searchParams.get('col') ?? ''
      const itemId = url.searchParams.get('item') ?? ''
      if (!COL.test(col) || !itemId || itemId.length > 80) throw new HttpError(400, 'Registro do anexo inválido.')
      if (!(await paiVisivel(col, itemId))) throw new HttpError(403, 'Este registro não está compartilhado com você.')
      const size = Number(req.headers.get('content-length') ?? 0)
      if (size > MAX_FILE) throw new HttpError(413, 'Arquivo acima de 50 MB.')
      let id = (req.headers.get('x-file-id') ?? '').match(/^[a-z0-9]{6,40}$/i)?.[0] ?? rand(12)
      const existente = await env.DB.prepare('SELECT conta_id, dono FROM files WHERE id = ?').bind(id).first<{ conta_id: string; dono: string | null }>()
      if (existente && (existente.conta_id !== ct || existente.dono !== u.id)) id = rand(12) // nunca sobrescreve anexo de outra conta ou de outra pessoa
      const name = decodeURIComponent(req.headers.get('x-file-name') ?? 'arquivo').slice(0, 250)
      const type = req.headers.get('content-type') ?? 'application/octet-stream'
      const meta = limparMeta(req.headers.get('x-file-meta'))
      const added = req.headers.get('x-file-added') ?? now()
      const by = req.headers.get('x-file-by') ? decodeURIComponent(req.headers.get('x-file-by')!) : u.nome
      const obj = await env.FILES.put(chaveArquivo(ct, id), req.body, { httpMetadata: { contentType: type } })
      const t = now()
      await env.DB.prepare('INSERT INTO files (id, col, item_id, name, type, size, added, by, meta, deleted, updated_at, conta_id, dono) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET col = excluded.col, item_id = excluded.item_id, name = excluded.name, type = excluded.type, size = excluded.size, meta = excluded.meta, deleted = 0, updated_at = excluded.updated_at')
        .bind(id, col, itemId, name, type, obj?.size ?? size, added, by, meta, t, ct, u.id)
        .run()
      return json({ file: fileOut({ id, col, item_id: itemId, name, type, size: obj?.size ?? size, added, by, meta }) })
    }
    if (path === '/files' && method === 'DELETE') {
      // usado na restauração de backup: apaga todos os anexos desta conta
      if (!admin) throw new HttpError(403, 'Somente administradores.')
      const ids = (await env.DB.prepare('SELECT id FROM files WHERE conta_id = ? AND deleted = 0').bind(ct).all<{ id: string }>()).results.map((r) => chaveArquivo(ct, r.id))
      for (let i = 0; i < ids.length; i += 500) await env.FILES.delete(ids.slice(i, i + 500))
      await env.DB.prepare('UPDATE files SET deleted = 1, updated_at = ? WHERE conta_id = ? AND deleted = 0').bind(now(), ct).run()
      return json({ ok: true, removidos: ids.length })
    }
    m = path.match(/^\/files\/([a-z0-9]{6,40})$/i)
    if (m) {
      const id = m[1]
      const f = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND conta_id = ? AND deleted = 0').bind(id, ct).first<FileRow>()
      if (!f || !(await paiVisivel(f.col, f.item_id, f.dono))) throw new HttpError(404, 'Anexo não encontrado.')
      if (method === 'GET') {
        const obj = await env.FILES.get(chaveArquivo(ct, id))
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
      if (method === 'PATCH') {
        // mover para outra pasta/registro ou renomear
        if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
        const b = (await body(req)) as { col?: string; itemId?: string; name?: string }
        const col = b.col ?? f.col
        const itemId = b.itemId ?? f.item_id
        const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 250) : f.name
        if (!COL.test(col) || !itemId || itemId.length > 80) throw new HttpError(400, 'Destino inválido.')
        if (!(await paiVisivel(col, itemId, f.dono))) throw new HttpError(403, 'O destino não está compartilhado com você.')
        await env.DB.prepare('UPDATE files SET col = ?, item_id = ?, name = ?, updated_at = ? WHERE id = ? AND conta_id = ?').bind(col, itemId, name, now(), id, ct).run()
        return json({ file: fileOut({ ...f, col, item_id: itemId, name }) })
      }
      if (method === 'DELETE') {
        if (!escreve) throw new HttpError(403, 'Seu perfil é somente leitura.')
        await env.FILES.delete(chaveArquivo(ct, id))
        await env.DB.prepare('UPDATE files SET deleted = 1, updated_at = ? WHERE id = ? AND conta_id = ?').bind(now(), id, ct).run()
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

type FileRow = { id: string; col: string; item_id: string; name: string; type: string | null; size: number; added: string; by: string | null; meta: string | null; dono?: string | null }
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

// ───────── contas
/** Dados da conta do usuário e o que é preciso para decidir a visibilidade de cada registro. */
async function contexto(env: Env, u: User): Promise<Ctx> {
  const r = await env.DB.prepare('SELECT * FROM contas WHERE id = ?').bind(u.conta_id).first<Parameters<typeof lerConta>[0]>()
  if (!r) throw new HttpError(403, 'Conta não encontrada.')
  const conta = lerConta(r)
  const ctx: Ctx = { conta, userId: u.id, pessoa: u.pessoa, papel: u.papel, pessoaDe: new Map(), gestorDe: new Map() }
  if (conta.plano === 'empresa' && conta.opcoes.gestorVeEquipe) {
    const [us, ps] = await env.DB.batch([
      env.DB.prepare('SELECT id, pessoa FROM users WHERE conta_id = ?').bind(u.conta_id),
      env.DB.prepare("SELECT id, json_extract(data, '$.gestor') AS gestor FROM items WHERE conta_id = ? AND col = 'pessoas' AND deleted = 0").bind(u.conta_id),
    ])
    for (const x of us.results as { id: string; pessoa: string | null }[]) ctx.pessoaDe.set(x.id, x.pessoa)
    for (const x of ps.results as { id: string; gestor: string | null }[]) ctx.gestorDe.set(x.id, x.gestor)
  }
  return ctx
}

type ContaIn = { nome?: string; plano?: string; modulos?: string[] | null; ativo?: boolean; opcoes?: Conta['opcoes']; admin?: { nome?: string; login?: string; email?: string; senha?: string } }
const limparModulos = (m: unknown) => (Array.isArray(m) ? [...new Set(m.filter((x): x is string => typeof x === 'string' && /^[\w-]{1,40}$/.test(x)))].slice(0, 300) : null)

/** Painel do dono da plataforma: cria e administra as contas dos clientes. */
async function plataforma(req: Request, env: Env, path: string, method: string, quem: User) {
  if (path === '/plataforma/contas' && method === 'GET') {
    const [cs, us, its] = await env.DB.batch([
      env.DB.prepare('SELECT * FROM contas ORDER BY criada_em'),
      env.DB.prepare("SELECT conta_id, COUNT(*) AS n, MAX(ultimo_acesso) AS ult, GROUP_CONCAT(CASE WHEN papel = 'Administrador' THEN login END) AS admins FROM users GROUP BY conta_id"),
      env.DB.prepare('SELECT conta_id, COUNT(*) AS n FROM items WHERE deleted = 0 GROUP BY conta_id'),
    ])
    const porConta = <T,>(rs: unknown[]) => new Map((rs as (T & { conta_id: string })[]).map((x) => [x.conta_id, x]))
    const u = porConta<{ n: number; ult: string | null; admins: string | null }>(us.results)
    const it = porConta<{ n: number }>(its.results)
    return json({
      contas: (cs.results as Parameters<typeof lerConta>[0][]).map((r) => ({
        ...lerConta(r),
        criadaEm: (r as unknown as { criada_em: string }).criada_em,
        usuarios: u.get(r.id)?.n ?? 0,
        ultimoAcesso: u.get(r.id)?.ult ?? null,
        admins: (u.get(r.id)?.admins ?? '').split(',').filter(Boolean),
        registros: it.get(r.id)?.n ?? 0,
        minha: r.id === quem.conta_id,
      })),
    })
  }
  if (path === '/plataforma/contas' && method === 'POST') {
    const b = await body<ContaIn>(req)
    const nome = String(b.nome ?? '').trim().slice(0, 80)
    const a = b.admin ?? {}
    if (!nome) throw new HttpError(400, 'Informe o nome da conta.')
    if (!a.nome?.trim() || !a.login?.trim()) throw new HttpError(400, 'Informe o nome e o usuário do administrador da conta.')
    if (String(a.senha ?? '').length < 8) throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.')
    if (await env.DB.prepare('SELECT 1 FROM users WHERE login = ?').bind(a.login.trim()).first()) throw new HttpError(409, 'Já existe um usuário com esse login (os logins valem para a plataforma inteira).')
    const id = 'c' + rand(5)
    const uid = rand(8)
    const salt = rand(16)
    const recSalt = rand(16)
    const codigo = codigoRec()
    const t = now()
    await env.DB.batch([
      env.DB.prepare('INSERT INTO contas (id, nome, plano, modulos, ativo, opcoes, criada_em) VALUES (?, ?, ?, ?, 1, ?, ?)').bind(id, nome, b.plano === 'individual' ? 'individual' : 'empresa', b.modulos ? JSON.stringify(limparModulos(b.modulos)) : null, '{}', t),
      env.DB.prepare("INSERT INTO users (id, login, nome, email, papel, ativo, salt, hash, rec_salt, rec_hash, updated_at, conta_id) VALUES (?, ?, ?, ?, 'Administrador', 1, ?, ?, ?, ?, ?, ?)").bind(
        uid,
        a.login.trim(),
        a.nome.trim(),
        a.email?.trim() || null,
        salt,
        await pbkdf2(String(a.senha), salt),
        recSalt,
        await pbkdf2(codigo.replace(/-/g, ''), recSalt),
        t,
        id,
      ),
    ])
    return json({ conta: { id, nome }, codigo })
  }
  const m = /^\/plataforma\/contas\/([\w-]{1,20})$/.exec(path)
  if (m && method === 'PUT') {
    const r = await env.DB.prepare('SELECT * FROM contas WHERE id = ?').bind(m[1]).first<Parameters<typeof lerConta>[0]>()
    if (!r) throw new HttpError(404, 'Conta não encontrada.')
    const c = lerConta(r)
    const b = await body<ContaIn>(req)
    const ativo = typeof b.ativo === 'boolean' ? b.ativo : !!c.ativo
    if (!ativo && c.id === quem.conta_id) throw new HttpError(400, 'Você não pode desativar a sua própria conta.')
    const nome = typeof b.nome === 'string' && b.nome.trim() ? b.nome.trim().slice(0, 80) : c.nome
    const plano = b.plano === 'individual' || b.plano === 'empresa' ? b.plano : c.plano
    const modulos = b.modulos === undefined ? c.modulos : limparModulos(b.modulos)
    const opcoes = { ...c.opcoes, ...(b.opcoes && typeof b.opcoes.gestorVeEquipe === 'boolean' ? { gestorVeEquipe: b.opcoes.gestorVeEquipe } : {}) }
    await env.DB.prepare('UPDATE contas SET nome = ?, plano = ?, modulos = ?, ativo = ?, opcoes = ? WHERE id = ?').bind(nome, plano, modulos ? JSON.stringify(modulos) : null, ativo ? 1 : 0, JSON.stringify(opcoes), c.id).run()
    if (!ativo) await env.DB.prepare('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE conta_id = ?)').bind(c.id).run()
    return json({ ok: true })
  }
  throw new HttpError(404, 'Rota não encontrada.')
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
  await env.DB.prepare("INSERT INTO users (id, login, nome, papel, ativo, salt, hash, rec_salt, rec_hash, updated_at, conta_id, plataforma) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'c1', 1)")
    .bind(id, b.login.trim(), b.nome.trim(), 'Administrador', salt, await pbkdf2(b.senha, salt), recSalt, await pbkdf2(codigo.replace(/-/g, ''), recSalt), t)
    .run()
  const u = (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>())!
  return json({ user: sessUser(u), codigo }, 200, { 'set-cookie': await abrirSessao(env, u, !!b.lembrar) })
}

async function login(req: Request, env: Env) {
  const b = await body<{ login: string; senha: string; lembrar?: boolean }>(req)
  const k = String(b.login ?? '').trim()
  const u = await env.DB.prepare('SELECT u.* FROM users u JOIN contas c ON c.id = u.conta_id WHERE (u.login = ? OR lower(u.email) = lower(?)) AND u.ativo = 1 AND c.ativo = 1').bind(k, k).first<User>()
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
  const ct = quem.conta_id
  const atual = id ? await env.DB.prepare('SELECT * FROM users WHERE id = ? AND conta_id = ?').bind(id, ct).first<User>() : null
  if (id && !atual) throw new HttpError(404, 'Usuário não encontrado.')
  const papel = admin ? (b.papel ?? atual?.papel ?? 'Gestor') : atual!.papel
  if (!PAPEIS_USUARIO.includes(papel)) throw new HttpError(400, 'Perfil inválido.')
  const ativo = admin ? (b.ativo ?? !!(atual?.ativo ?? 1)) : true
  if (atual?.papel === 'Administrador' && (papel !== 'Administrador' || !ativo)) {
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE papel = 'Administrador' AND ativo = 1 AND id <> ? AND conta_id = ?").bind(atual.id, ct).first<{ n: number }>()
    if (!n?.n) throw new HttpError(400, 'Precisa existir pelo menos um administrador ativo.')
  }
  const nome = String(b.nome ?? atual?.nome ?? '').trim()
  const login = admin ? String(b.login ?? atual?.login ?? '').trim() : atual!.login
  if (!nome || !login) throw new HttpError(400, 'Informe nome e usuário.')
  if (b.senha && b.senha.length < 8) throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.')
  if (!atual && !b.senha) throw new HttpError(400, 'Defina uma senha para o novo usuário.')
  const dup = await env.DB.prepare('SELECT id FROM users WHERE login = ? AND id <> ?').bind(login, id ?? '').first()
  if (dup) throw new HttpError(409, 'Já existe um usuário com esse login.')
  // cada pessoa do Time só pode estar ligada a um usuário (senão um vê o que é do outro)
  const pessoa = admin ? (b.pessoa ?? null) : (atual?.pessoa ?? null)
  if (pessoa && pessoa !== atual?.pessoa) {
    const outro = await env.DB.prepare('SELECT nome FROM users WHERE conta_id = ? AND pessoa = ? AND id <> ?').bind(ct, pessoa, id ?? '').first<{ nome: string }>()
    if (outro) throw new HttpError(409, `Esta pessoa do Time já está ligada ao usuário ${outro.nome}. Cada usuário precisa da sua própria pessoa (cadastre-a em Time).`)
  }
  const t = now()
  const salt = b.senha ? rand(16) : atual!.salt
  const hash = b.senha ? await pbkdf2(b.senha, salt) : atual!.hash
  const uid = id ?? rand(8)
  await env.DB.prepare(
    'INSERT INTO users (id, login, nome, email, papel, pessoa, ativo, salt, hash, updated_at, conta_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET login = excluded.login, nome = excluded.nome, email = excluded.email, papel = excluded.papel, pessoa = excluded.pessoa, ativo = excluded.ativo, salt = excluded.salt, hash = excluded.hash, updated_at = excluded.updated_at',
  )
    .bind(uid, login, nome, b.email ?? atual?.email ?? null, papel, pessoa, ativo ? 1 : 0, salt, hash, t, ct)
    .run()
  if (!ativo || (b.senha && id && id !== quem.id)) await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(uid).run()
  const u = (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(uid).first<User>())!
  return json({ user: publicUser(u) })
}

// ───────── sincronização dos calendários (links ICS publicados)
type StatusCal = { em: string; eventos: number; novos: number; alterados: number; removidos: number; erro?: string }
type Cal = { id: string; nome: string; origem: OrigemCal; url: string }

// Reuniões de um calendário do usuário (parâmetros: dono, calendário, calendário).
// As antigas do Outlook (antes de existir mais de um) não têm "calendario" nem dono.
const DO_CAL = "(json_extract(data, '$._dono') IS NULL OR json_extract(data, '$._dono') = ?) AND (json_extract(data, '$.calendario') = ? OR (? = 'outlook' AND json_extract(data, '$.calendario') IS NULL AND json_extract(data, '$.origem') = 'Outlook'))"

function linkIcs(u: unknown) {
  const link = String(u ?? '').trim().replace(/^webcal:/i, 'https:')
  if (!/^https:\/\/[^\s]+$/i.test(link) && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/i.test(link)) throw new HttpError(400, 'Cole o link ICS completo (começa com https:// ou webcal://).')
  return link
}

async function setConfig(env: Env, key: string, value: string) {
  await env.DB.prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind(key, value, now()).run()
}

/** Lista de calendários conectados do usuário. Converte a configuração antiga (um único link do Outlook). */
async function lerCalendarios(env: Env, u: User): Promise<Cal[]> {
  const p = `u:${u.id}:`
  const rows = (await env.DB.prepare('SELECT key, value FROM config WHERE key IN (?, ?, ?)').bind(p + 'ics_cals', p + 'ics_url', p + 'ics_status').all<{ key: string; value: string }>()).results
  const v = (k: string) => rows.find((r) => r.key === p + k)?.value
  const cals = JSON.parse(v('ics_cals') ?? '[]') as Cal[]
  const antigo = v('ics_url')
  if (antigo) {
    if (!cals.some((c) => c.id === 'outlook')) cals.unshift({ id: 'outlook', nome: 'Outlook', origem: 'Outlook', url: antigo })
    await gravarCalendarios(env, u, cals)
    const st = v('ics_status')
    if (st) await setConfig(env, p + 'ics_status_outlook', st)
    await env.DB.prepare('DELETE FROM config WHERE key IN (?, ?)').bind(p + 'ics_url', p + 'ics_status').run()
  }
  return cals
}

async function gravarCalendarios(env: Env, u: User, cals: Cal[]) {
  await setConfig(env, `u:${u.id}:ics_cals`, JSON.stringify(cals))
}

async function statusCalendarios(env: Env, u: User) {
  const cals = await lerCalendarios(env, u)
  const p = `u:${u.id}:ics_status_`
  const sts = (await env.DB.prepare("SELECT key, value FROM config WHERE key LIKE ? ESCAPE '\\'").bind(p.replace(/_/g, '\\_') + '%').all<{ key: string; value: string }>()).results
  const calendarios = cals.map((c) => {
    let host: string | null = null
    try {
      host = new URL(c.url).host
    } catch {
      host = null
    }
    const st = sts.find((s) => s.key === p + c.id)?.value
    // o link é tratado como senha: nunca volta para a tela, só o domínio
    return { id: c.id, nome: c.nome, origem: c.origem, host, ultima: st ? (JSON.parse(st) as StatusCal) : null }
  })
  return { configurado: cals.length > 0, calendarios }
}

const CAMPOS_USUARIO = ['preparado', 'pauta', 'materiais', 'decisoes', 'roteiro', 'etiquetas']

async function sincronizarCalendario(env: Env, u: User, cal: Cal) {
  const ct = u.conta_id
  const salvarStatus = (st: StatusCal) => setConfig(env, `u:${u.id}:ics_status_${cal.id}`, JSON.stringify(st))
  let txt: string
  try {
    const r = await fetch(cal.url, { headers: { accept: 'text/calendar, */*' }, redirect: 'follow', cf: { cacheTtl: 0 } } as RequestInit)
    if (!r.ok) throw new Error(`o servidor do calendário respondeu ${r.status}`)
    txt = await r.text()
    if (txt.length > 15_000_000) throw new Error('calendário grande demais')
    if (!/BEGIN:VCALENDAR/i.test(txt)) throw new Error('o link não devolveu um calendário (.ics)')
  } catch (e) {
    const erro = `Não foi possível ler o calendário: ${(e as Error).message}.`
    if (cal.nome) await salvarStatus({ em: now(), eventos: 0, novos: 0, alterados: 0, removidos: 0, erro })
    throw new HttpError(502, erro)
  }
  if (cal.id !== 'outlook') cal.origem = origemIcs(txt, cal.url)
  const quem = cal.origem
  // ids das reuniões: o calendário antigo do Outlook mantém os ids de antes (preserva as anotações)
  const idDe = (id: string) => (cal.id === 'outlook' ? id : `${id}_${cal.id}`)
  const de = Date.now() - 30 * 86400000
  const ate = Date.now() + 120 * 86400000
  const ocs = lerIcs(txt, de, ate)
  const t = now()
  const atuais = (await env.DB.prepare(`SELECT id, data FROM items WHERE conta_id = ? AND col = 'reunioes' AND deleted = 0 AND ${DO_CAL}`).bind(ct, u.id, cal.id, cal.id).all<{ id: string; data: string }>()).results
  const mapa = new Map(atuais.map((r) => [r.id, JSON.parse(r.data) as Record<string, unknown>]))
  const stmts: D1PreparedStatement[] = []
  const put = (id: string, item: Record<string, unknown>) =>
    stmts.push(env.DB.prepare("INSERT INTO items (conta_id, col, id, data, updated_at, deleted) VALUES (?, 'reunioes', ?, ?, ?, 0) ON CONFLICT (conta_id, col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0").bind(ct, id, JSON.stringify({ ...item, _dono: u.id }), t))
  let novos = 0
  let alterados = 0
  let removidos = 0
  const vistos = new Set<string>()
  for (const o of ocs) {
    const id = idDe(o.id)
    vistos.add(id)
    const campos: Record<string, unknown> = { ...camposOutlook(o, quem), calendario: cal.id }
    const sugerido = campos.tipoSugerido
    delete campos.tipoSugerido
    const ant = mapa.get(id)
    if (!ant) {
      put(id, { id, ...campos, tipo: sugerido ?? null, preparado: false, _created: t, _createdBy: quem, _updated: t, _updatedBy: quem })
      novos++
      continue
    }
    const mudou = Object.entries(campos).some(([k, v]) => JSON.stringify(ant[k] ?? null) !== JSON.stringify(v ?? null)) || ant.canceladaOutlook || ant._dono !== u.id
    if (mudou) {
      put(id, { ...ant, ...campos, canceladaOutlook: false, _updated: t, _updatedBy: quem })
      alterados++
    }
  }
  // reuniões que saíram do calendário dentro da janela: apaga, ou marca como cancelada se você já anotou algo nela
  const deDia = new Date(de).toISOString().slice(0, 10)
  const ateDia = new Date(ate).toISOString().slice(0, 10)
  for (const [id, ant] of mapa) {
    if (vistos.has(id)) continue
    const dia = String(ant.data ?? '')
    if (dia < deDia || dia > ateDia) continue
    const anotada = CAMPOS_USUARIO.some((k) => (Array.isArray(ant[k]) ? (ant[k] as unknown[]).length > 0 : !!ant[k] && ant[k] !== ''))
    if (anotada) {
      if (!ant.canceladaOutlook) put(id, { ...ant, canceladaOutlook: true, _updated: t, _updatedBy: quem })
    } else stmts.push(env.DB.prepare("UPDATE items SET deleted = 1, updated_at = ? WHERE conta_id = ? AND col = 'reunioes' AND id = ?").bind(t, ct, id))
    removidos++
  }
  for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100))
  const st: StatusCal = { em: now(), eventos: ocs.length, novos, alterados, removidos }
  await salvarStatus(st)
  return st
}
