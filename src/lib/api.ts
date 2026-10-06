// Cliente da API (Cloudflare). Em "modo servidor" os dados ficam no D1/R2 e podem
// ser acessados de qualquer computador; sem API (ex.: prévia estática), o sistema
// cai no "modo local" (IndexedDB do navegador).

export type Modo = 'servidor' | 'local'
let modo: Modo = 'local'
export const getModo = () => modo
export const servidor = () => modo === 'servidor'

export type Health = { ok: boolean; server: boolean; temUsuarios: boolean; setupConfigurado: boolean }
let health: Health | null = null
export const getHealth = () => health

export async function detectarModo(): Promise<Modo> {
  try {
    const r = await fetch('api/health', { credentials: 'same-origin', cache: 'no-store' })
    const j = r.ok && r.headers.get('content-type')?.includes('json') ? ((await r.json()) as Health) : null
    if (j?.server) {
      health = j
      modo = 'servidor'
    }
  } catch {
    /* sem API: modo local */
  }
  return modo
}

export class ApiError extends Error {
  status: number
  constructor(status: number, msg: string) {
    super(msg)
    this.status = status
  }
}

let onUnauthorized: (() => void) | null = null
export const setOnUnauthorized = (f: () => void) => (onUnauthorized = f)

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { 'x-chiefdeck': '1', ...opts.headers }
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  let r: Response
  try {
    r = await fetch('api' + path, {
      method: opts.method ?? (opts.body !== undefined || opts.raw ? 'POST' : 'GET'),
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    })
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor. Verifique a internet.')
  }
  const j = r.headers.get('content-type')?.includes('json') ? await r.json().catch(() => ({})) : {}
  if (!r.ok) {
    if (r.status === 401 && !path.startsWith('/login') && !path.startsWith('/setup') && !path.startsWith('/recover')) onUnauthorized?.()
    throw new ApiError(r.status, (j as { erro?: string }).erro ?? `Erro ${r.status}`)
  }
  return j as T
}
