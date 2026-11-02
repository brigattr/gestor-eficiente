// Limpa o HTML das anotações: só formatação simples (negrito, listas, títulos, tabelas, links).
// Imagens só as guardadas no próprio sistema (data-arquivo = id do anexo da página).
// Nada de script, imagem externa ou embutida, iframe, eventos ou estilos arbitrários.

const PERMITIDAS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'span', 'mark', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'font'])
const DESCARTAR = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'link', 'meta', 'template', 'video', 'audio', 'canvas', 'form', 'input', 'button', 'select', 'textarea', 'noscript', 'head', 'title', 'base'])
const COR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%]+\)|[a-z]{3,20})$/i

/** Fontes permitidas nas anotações (nome exibido → pilha CSS). */
export const CSS_FONTE: Record<string, string> = {
  Nunito: 'Nunito, sans-serif',
  Arial: 'Arial, Helvetica, sans-serif',
  Verdana: 'Verdana, sans-serif',
  'Trebuchet MS': '"Trebuchet MS", sans-serif',
  Georgia: 'Georgia, serif',
  'Times New Roman': '"Times New Roman", serif',
  'Courier New': '"Courier New", monospace',
}
const FONTES = Object.keys(CSS_FONTE)

function estiloSeguro(style: string) {
  const out: string[] = []
  for (const decl of style.split(';')) {
    const [k, ...v] = decl.split(':')
    const prop = k?.trim().toLowerCase()
    const val = v.join(':').trim()
    if ((prop === 'color' || prop === 'background-color') && COR.test(val)) out.push(`${prop}: ${val}`)
    if (prop === 'font-weight' && /^(bold|[5-9]00)$/.test(val)) out.push('font-weight: bold')
    if (prop === 'font-style' && val === 'italic') out.push('font-style: italic')
    if (prop === 'text-decoration' && /^(underline|line-through)$/.test(val)) out.push(`text-decoration: ${val}`)
    if (prop === 'font-size' && /^\d{1,2}(\.\d+)?(px|pt|em|rem)$/.test(val)) out.push(`font-size: ${val}`)
    if (prop === 'font-family') {
      const f = FONTES.find((x) => val.toLowerCase().replace(/["']/g, '').startsWith(x.toLowerCase()))
      if (f) out.push(`font-family: ${CSS_FONTE[f]}`)
    }
  }
  return out.join('; ')
}

function limparNo(no: Node, doc: Document): Node | DocumentFragment | null {
  if (no.nodeType === Node.TEXT_NODE) return doc.createTextNode(no.textContent ?? '')
  if (no.nodeType !== Node.ELEMENT_NODE) return null
  const el = no as Element
  const tag = el.tagName.toLowerCase()
  if (DESCARTAR.has(tag)) return null
  const filhos = () => {
    const f = doc.createDocumentFragment()
    el.childNodes.forEach((c) => {
      const x = limparNo(c, doc)
      if (x) f.appendChild(x)
    })
    return f
  }
  if (tag === 'img') {
    // só imagem guardada no sistema; largura em % (ou px) vinda do redimensionamento
    const id = el.getAttribute('data-arquivo') ?? ''
    if (!/^[a-z0-9]{6,40}$/i.test(id)) return null
    const img = doc.createElement('img')
    img.setAttribute('data-arquivo', id)
    const w = (el.getAttribute('style') ?? '').match(/width:\s*(\d{1,3}(?:\.\d+)?)(%|px)/)
    if (w) img.setAttribute('style', `width: ${w[1]}${w[2]}`)
    return img
  }
  if (!PERMITIDAS.has(tag)) return filhos() // desembrulha (mantém o texto)
  const href = (el.getAttribute('href') ?? '').trim()
  if (tag === 'a' && !/^(https?:|mailto:)/i.test(href)) return filhos() // link inválido vira texto
  const novo = doc.createElement(tag === 'font' ? 'span' : tag)
  if (tag === 'a') {
    novo.setAttribute('href', href)
    novo.setAttribute('target', '_blank')
    novo.setAttribute('rel', 'noopener noreferrer')
  }
  if (tag === 'font') {
    const c = el.getAttribute('color')
    const face = el.getAttribute('face')
    const st = [c && COR.test(c) ? `color: ${c}` : '', face ? estiloSeguro(`font-family: ${face}`) : ''].filter(Boolean).join('; ')
    if (st) novo.setAttribute('style', st)
  }
  const st = el.getAttribute('style')
  if (st && tag !== 'font') {
    const s = estiloSeguro(st)
    if (s) novo.setAttribute('style', s)
  }
  if (tag === 'ul' && el.classList.contains('check')) novo.setAttribute('class', 'check')
  if (tag === 'li' && el.getAttribute('data-check') === '1') novo.setAttribute('data-check', '1')
  if (tag === 'td' || tag === 'th')
    for (const a of ['colspan', 'rowspan']) {
      const v = el.getAttribute(a)
      if (v && /^\d{1,2}$/.test(v)) novo.setAttribute(a, v)
    }
  novo.appendChild(filhos())
  return novo
}

export function limparHtml(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const out = doc.createElement('div')
  doc.body.childNodes.forEach((c) => {
    const x = limparNo(c, doc)
    if (x) out.appendChild(x)
  })
  return out.innerHTML
}

/** Texto puro do HTML (para busca e prévia). */
export function textoDoHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html.replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)>/gi, ' $&')}</body>`, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}
