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

async function parseEml(f: Blob): Promise<EmailMeta> {
  const txt = await f.slice(0, 256 * 1024).text()
  const [head, ...rest] = txt.split(/\r?\n\r?\n/)
  const unfolded = head.replace(/\r?\n[ \t]+/g, ' ')
  const h = (k: string) => {
    const m = unfolded.match(new RegExp(`^${k}:\\s*(.*)$`, 'im'))
    return m ? decodeWords(m[1].trim()) : undefined
  }
  const d = h('Date')
  const body = rest
    .join('\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/=\r?\n/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { assunto: h('Subject'), de: h('From'), para: h('To'), data: d && !isNaN(Date.parse(d)) ? new Date(d).toISOString() : undefined, resumo: body.slice(0, 280) || undefined }
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

export async function lerEmail(f: File): Promise<EmailMeta | undefined> {
  try {
    if (/\.eml$/i.test(f.name)) return await parseEml(f)
    if (/\.msg$/i.test(f.name)) return await parseMsg(f)
  } catch (e) {
    console.warn('Não foi possível ler o e-mail', f.name, e)
  }
  return undefined
}
