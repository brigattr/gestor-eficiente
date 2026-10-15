// Limpa o HTML das anotações: só formatação simples (negrito, listas, títulos, tabelas, links).
// Nada de script, imagem embutida, iframe, eventos ou estilos arbitrários.

const PERMITIDAS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'span', 'mark', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'font'])
const DESCARTAR = new Set(['script', 'style', 'iframe', 'object', 'embed', 'img', 'svg', 'math', 'link', 'meta', 'template', 'video', 'audio', 'canvas', 'form', 'input', 'button', 'select', 'textarea', 'noscript', 'head', 'title', 'base'])
const COR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%]+\)|[a-z]{3,20})$/i

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
    if (c && COR.test(c)) novo.setAttribute('style', `color: ${c}`)
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
