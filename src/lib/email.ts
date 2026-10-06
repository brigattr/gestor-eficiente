// Extrai assunto, remetente, data e um resumo de e-mails salvos (.eml e .msg do Outlook).

export type EmailMeta = { assunto?: string; de?: string; para?: string; data?: string; resumo?: string }

export const isEmail = (name: string) => /\.(eml|msg)$/i.test(name)

function decodeWords(s: string) {
  // RFC 2047: =?charset?B|Q?texto?=
  return s.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, cs: string, enc: string, txt: string) => {
    try {
      const bytes =
        enc.toUpperCase() === 'B'
          ? Uint8Array.from(atob(txt), (c) => c.charCodeAt(0))
          : Uint8Array.from(txt.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16))), (c) => c.charCodeAt(0))
      return new TextDecoder(cs).decode(bytes)
    } catch {
      return txt
    }
  })
}

type Parte = { headers: string; body: string }

function separar(raw: string): Parte {
  const m = raw.match(/\r?\n\r?\n/)
  if (!m || m.index === undefined) return { headers: raw, body: '' }
  return { headers: raw.slice(0, m.index).replace(/\r?\n[ \t]+/g, ' '), body: raw.slice(m.index + m[0].length) }
}

const cabecalho = (headers: string, k: string) => headers.match(new RegExp(`^${k}:\\s*(.*)$`, 'im'))?.[1].trim()
const param = (v: string | undefined, k: string) => v?.match(new RegExp(`${k}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i'))?.slice(1).find(Boolean)

/** Bytes "binários" (um caractere = um byte) → texto no charset indicado. */
function decodificar(bin: string, charset = 'utf-8') {
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0) & 0xff)
  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

function corpoDecodificado(p: Parte) {
  const cte = (cabecalho(p.headers, 'Content-Transfer-Encoding') ?? '').toLowerCase()
  const charset = param(cabecalho(p.headers, 'Content-Type'), 'charset')
  if (cte === 'base64') {
    try {
      return decodificar(atob(p.body.replace(/[^A-Za-z0-9+/=]/g, '')), charset)
    } catch {
      return ''
    }
  }
  if (cte === 'quoted-printable') {
    const bin = p.body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    return decodificar(bin, charset)
  }
  return p.body
}

/** Procura o texto legível do e-mail, entrando nas partes multipart (texto puro tem preferência). */
function textoDe(p: Parte, nivel = 0): { tipo: 'plain' | 'html'; texto: string } | undefined {
  const ct = cabecalho(p.headers, 'Content-Type') ?? 'text/plain'
  const tipo = ct.split(';')[0].trim().toLowerCase()
  if (/attachment/i.test(cabecalho(p.headers, 'Content-Disposition') ?? '')) return undefined
  if (tipo.startsWith('multipart/') && nivel < 8) {
    const b = param(ct, 'boundary')
    if (!b) return undefined
    const esc = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const partes = p.body
      .split(new RegExp(`^--${esc}(?:--)?[ \t]*$`, 'm'))
      .slice(1)
      .map((x) => x.replace(/^\r?\n/, ''))
      .filter((x) => x.trim())
      .map(separar)
    let html: { tipo: 'plain' | 'html'; texto: string } | undefined
    for (const parte of partes) {
      const t = textoDe(parte, nivel + 1)
      if (t?.tipo === 'plain' && t.texto.trim()) return t
      if (t && !html && t.texto.trim()) html = t
    }
    return html
  }
  if (tipo === 'text/plain') return { tipo: 'plain', texto: corpoDecodificado(p) }
  if (tipo === 'text/html') return { tipo: 'html', texto: corpoDecodificado(p) }
  return undefined
}

function htmlParaTexto(h: string) {
  return h
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
}

/** Limpa um resumo: tira linhas de cabeçalho MIME/fronteiras (também de anexos gravados antes da correção). */
export function limparResumo(t: string | undefined) {
  if (!t) return undefined
  const limpo = t
    .replace(/--[\w=.'()+,/:?-]{8,}(--)?/g, ' ')
    .replace(/\b(Content-[\w-]+|MIME-Version|boundary|type|charset)\s*[:=]\s*("[^"]*"|[^\s;]+);?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return limpo || undefined
}

async function parseEml(f: Blob): Promise<EmailMeta> {
  const raw = await f.slice(0, 512 * 1024).text()
  const msg = separar(raw)
  const h = (k: string) => {
    const v = cabecalho(msg.headers, k)
    return v ? decodeWords(v) : undefined
  }
  const d = h('Date')
  const t = textoDe(msg)
  const texto = t ? (t.tipo === 'html' ? htmlParaTexto(t.texto) : t.texto) : ''
  return {
    assunto: h('Subject'),
    de: h('From'),
    para: h('To'),
    data: d && !isNaN(Date.parse(d)) ? new Date(d).toISOString() : undefined,
    resumo: limparResumo(texto.replace(/\s+/g, ' ').trim().slice(0, 300)),
  }
}

async function parseMsg(f: Blob): Promise<EmailMeta> {
  const { default: MsgReader } = await import('@kenjiuno/msgreader')
  const r = new MsgReader(await f.arrayBuffer())
  const m = r.getFileData()
  const de = m.senderName ? `${m.senderName}${m.senderEmail ? ` <${m.senderEmail}>` : ''}` : m.senderEmail
  const para = m.recipients
    ?.map((x) => x.name ?? x.email)
    .filter(Boolean)
    .join(', ')
  const d = m.messageDeliveryTime ?? m.clientSubmitTime ?? m.creationTime
  return {
    assunto: m.subject,
    de,
    para: para || undefined,
    data: d && !isNaN(Date.parse(d)) ? new Date(d).toISOString() : undefined,
    resumo: m.body?.replace(/\s+/g, ' ').trim().slice(0, 280) || undefined,
  }
}

const corta = (v: string | undefined, n: number) => (v && v.length > n ? v.slice(0, n - 1) + '…' : v)
/** Mantém cada campo num tamanho seguro para gravar (e-mails com dezenas de destinatários). */
function enxugar(m: EmailMeta): EmailMeta {
  return { assunto: corta(m.assunto, 300), de: corta(m.de, 300), para: corta(m.para, 1000), data: m.data, resumo: corta(m.resumo, 400) }
}

export async function lerEmail(f: File): Promise<EmailMeta | undefined> {
  try {
    if (/\.eml$/i.test(f.name)) return enxugar(await parseEml(f))
    if (/\.msg$/i.test(f.name)) return enxugar(await parseMsg(f))
  } catch (e) {
    console.warn('Não foi possível ler o e-mail', f.name, e)
  }
  return undefined
}
