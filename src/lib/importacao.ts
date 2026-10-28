// Importação em massa (histórico): modelo .xlsx por tela, leitura da planilha preenchida,
// conferência linha a linha e gravação em lote. Vale para todos os módulos declarados em schema.ts.

import { strToU8, zipSync } from 'fflate'
import { CORES_ETIQUETA, MOD, type Field } from '../data/schema'
import { list, uid, type Item } from '../data/store'
import { iso, label, parseCSV, toNumber } from './format'
import { opcoesCampo } from './opcoes'

// campos internos que não fazem sentido numa importação
const FORA = new Set(['canceladaOutlook', 'descricaoOutlook', 'proximaGerada', 'origemRecorrencia', 'historico'])

export const camposImportaveis = (col: string) => MOD[col].fields.filter((f) => !FORA.has(f.key))

export const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\*/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const SIM = new Set(['sim', 's', 'x', 'yes', 'y', 'true', '1', 'verdadeiro', 'ok'])
const NAO = new Set(['nao', 'n', 'no', 'false', '0', 'falso', ''])

function comoPreencher(f: Field): string {
  switch (f.type) {
    case 'date':
      return 'Data: dd/mm/aaaa (ex.: 31/12/2024)'
    case 'month':
      return 'Mês: mm/aaaa (ex.: 03/2024)'
    case 'time':
      return 'Hora: hh:mm (ex.: 18:00)'
    case 'number':
      return 'Número (ex.: 12 ou 3,5)'
    case 'money':
      return 'Valor em R$ (ex.: 1.234,56)'
    case 'percent':
      return 'Percentual (ex.: 25 ou 25%)'
    case 'rating':
      return 'Nota de 1 a 5'
    case 'bool':
      return 'Sim ou Não'
    case 'select':
      return 'Escolha uma das opções (lista na célula)'
    case 'ref':
      return `Nome exatamente como cadastrado em ${MOD[f.ref!]?.title ?? f.ref}`
    case 'multiref':
      return `Um ou mais nomes de ${MOD[f.ref!]?.title ?? f.ref}, separados por ponto e vírgula (;)`
    case 'url':
      return 'Link (https://…) ou caminho do arquivo'
    case 'textarea':
      return 'Texto livre (pode ter várias linhas)'
    default:
      return 'Texto'
  }
}

function opcoesDoCampo(f: Field): string[] {
  if (f.type === 'select') return opcoesCampo(f)
  if (f.type === 'bool') return ['Sim', 'Não']
  if (f.type === 'ref' || f.type === 'multiref') return list(f.ref!).map((i) => label(f.ref!, i)).filter((x) => x && x !== '(sem título)')
  return []
}

// ───────── gerador de .xlsx (SpreadsheetML mínimo, sem bibliotecas)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const colRef = (i: number) => {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
type Cel = { v: string; s?: number }
function planilha(linhas: Cel[][], larguras: number[], extra = '') {
  const cols = `<cols>${larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
  const rows = linhas
    .map((l, r) => `<row r="${r + 1}">${l.map((c, i) => `<c r="${colRef(i)}${r + 1}" t="inlineStr"${c.s ? ` s="${c.s}"` : ''}><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`).join('')}</row>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData>${extra}</worksheet>`
}

/** Modelo .xlsx da tela: aba Dados (cabeçalho + listas de escolha), Instruções e Listas. */
export function gerarModelo(col: string): Uint8Array {
  const m = MOD[col]
  const fs = camposImportaveis(col)
  const listas = fs.map((f) => ({ f, ops: opcoesDoCampo(f) })).filter((x) => x.ops.length && x.f.type !== 'multiref')
  // aba Dados
  const cab = fs.map((f) => ({ v: f.label + (f.required ? ' *' : ''), s: f.required ? 2 : 1 }))
  const valid = listas
    .map(({ f, ops }, k) => {
      const c = colRef(fs.indexOf(f))
      return `<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="${c}2:${c}5000"><formula1>Listas!$${colRef(k)}$2:$${colRef(k)}$${ops.length + 1}</formula1></dataValidation>`
    })
    .join('')
  const dados = planilha([cab], fs.map((f) => (f.type === 'textarea' ? 40 : f.wide ? 34 : 20)), valid ? `<dataValidations count="${listas.length}">${valid}</dataValidations>` : '')
  // aba Instruções
  const instr: Cel[][] = [
    [{ v: `Importação em massa — ${m.title}`, s: 1 }],
    [{ v: 'Preencha a aba "Dados": uma linha por registro, a partir da linha 2. Não mude os títulos da linha 1. Colunas com * são obrigatórias.' }],
    [{ v: 'Depois, no sistema: tela ' + m.title + ' → Importar → escolha este arquivo. Você confere tudo antes de gravar e pode desfazer a importação.' }],
    [],
    [{ v: 'Coluna', s: 1 }, { v: 'Obrigatória', s: 1 }, { v: 'Como preencher', s: 1 }, { v: 'Opções / observação', s: 1 }],
    ...fs.map((f) => {
      const ops = opcoesDoCampo(f)
      const obs = f.type === 'select' ? ops.join(' · ') : f.type === 'ref' || f.type === 'multiref' ? (ops.length ? `Ex.: ${ops.slice(0, 5).join(' · ')}${ops.length > 5 ? ' …' : ''}` : 'Nenhum cadastro ainda — o sistema pode criar na importação') : (f.help ?? '')
      return [{ v: f.label }, { v: f.required ? 'Sim' : '' }, { v: comoPreencher(f) }, { v: obs }]
    }),
  ]
  const instrucoes = planilha(instr, [32, 12, 52, 70])
  // aba Listas (de onde saem as setinhas de escolha)
  const maxL = Math.max(0, ...listas.map((x) => x.ops.length))
  const lin: Cel[][] = [listas.map(({ f }) => ({ v: f.label, s: 1 }))]
  for (let r = 0; r < maxL; r++) lin.push(listas.map(({ ops }) => ({ v: ops[r] ?? '' })))
  const abaListas = planilha(lin, listas.map(() => 26))

  const nomes = ['Dados', 'Instruções', 'Listas']
  const arquivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${nomes.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    ),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"${n === 'Listas' ? ' state="hidden"' : ''}/>`).join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${nomes.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    // estilos: 0 normal · 1 cabeçalho (negrito, fundo azul-claro) · 2 cabeçalho obrigatório (fundo amarelo)
    'xl/styles.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDE68A"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ),
  }
  ;[dados, instrucoes, abaListas].forEach((x, i) => (arquivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(x)))
  return zipSync(arquivos)
}

export function baixarModelo(col: string) {
  const blob = new Blob([gerarModelo(col) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `modelo-${MOD[col].path}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

// ───────── leitura da planilha preenchida
export type Bruto = { cab: string[]; linhas: unknown[][] }

export async function lerPlanilha(f: File): Promise<Bruto> {
  if (/\.xlsx$/i.test(f.name)) {
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const sheets = await readXlsxFile(f)
    const aba = sheets.find((s) => norm(s.sheet) === 'dados') ?? sheets[0]
    const data = (aba?.data ?? []) as unknown[][]
    return { cab: (data[0] ?? []).map((x) => String(x ?? '')), linhas: data.slice(1) }
  }
  const rows = parseCSV(await f.text())
  return { cab: rows[0] ?? [], linhas: rows.slice(1) }
}

// ───────── conversão e conferência
/** Só cria automaticamente cadastros simples (cujo campo principal é texto). */
const podeCriar = (ref: string) => MOD[ref]?.fields.find((f) => f.key === MOD[ref].titleField)?.type === 'text'
export type Problema = { linha: number; nivel: 'erro' | 'aviso'; msg: string }
export type Faltante = { ref: string; nome: string }
export type Resultado = { itens: Item[]; problemas: Problema[]; ignoradas: string[]; mapa: { col: number; f: Field }[]; faltantes: Faltante[]; linhasComErro: number }

const pad = (n: number) => String(n).padStart(2, '0')
function excelData(n: number) {
  // número de série do Excel (dias desde 30/12/1899)
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
function data(v: unknown): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`
  if (typeof v === 'number') return v > 20000 && v < 80000 ? excelData(v) : null
  const t = String(v).trim()
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/) ?? t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\s/)
  if (m) {
    const ano = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    if (+m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return null
    return `${ano}-${pad(+m[2])}-${pad(+m[1])}`
  }
  if (/^\d{5}$/.test(t)) return excelData(+t)
  return null
}
function mes(v: unknown): string | null {
  const d = data(v)
  if (d) return d.slice(0, 7)
  const t = String(v).trim()
  let m = t.match(/^(\d{1,2})[/-](\d{4})$/)
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${pad(+m[1])}`
  m = t.match(/^(\d{4})-(\d{1,2})$/)
  if (m) return `${m[1]}-${pad(+m[2])}`
  return null
}
function hora(v: unknown): string | null {
  if (v instanceof Date) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const min = Math.round(v * 1440)
    return `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`
  }
  const m = String(v).trim().match(/^(\d{1,2})[:h](\d{2})?/)
  return m && +m[1] < 24 ? `${pad(+m[1])}:${m[2] ?? '00'}` : null
}

/** Converte as linhas da planilha em registros do módulo, apontando erros e avisos. */
export function converter(col: string, bruto: Bruto, criarFaltantes: boolean, lote: string): Resultado {
  const fs = camposImportaveis(col)
  const porNome = new Map<string, Field>()
  for (const f of fs) {
    porNome.set(norm(f.label), f)
    porNome.set(norm(f.key), f)
  }
  const mapa: { col: number; f: Field }[] = []
  const ignoradas: string[] = []
  bruto.cab.forEach((c, i) => {
    if (!String(c ?? '').trim()) return
    const f = porNome.get(norm(c))
    if (f && !mapa.some((x) => x.f.key === f.key)) mapa.push({ col: i, f })
    else ignoradas.push(String(c))
  })
  const problemas: Problema[] = []
  const itens: Item[] = []
  const faltantes = new Map<string, Faltante>()
  // índice dos cadastros referenciados (pessoas, projetos, etiquetas…) pelo nome
  const indice = new Map<string, Map<string, string>>()
  const idDe = (ref: string, nome: string) => {
    if (!indice.has(ref)) {
      // aceita o nome exibido, o campo principal, o código ou o nome (ex.: centro de custo "4120" ou "Custos & FP&A")
      const mp = new Map<string, string>()
      for (const i of list(ref)) for (const k of [label(ref, i), i[MOD[ref]?.titleField ?? 'nome'], i.codigo, i.nome]) if (typeof k === 'string' && k.trim()) mp.set(norm(k), i.id)
      indice.set(ref, mp)
    }
    return indice.get(ref)!.get(norm(nome))
  }
  let linhasComErro = 0

  bruto.linhas.forEach((ln, idx) => {
    const n = idx + 2 // número da linha na planilha
    if (!ln || ln.every((c) => c == null || String(c).trim() === '')) return
    const it: Item = { id: uid(), _importacao: lote }
    for (const f of fs) if (f.default !== undefined) it[f.key] = f.default
    let erro = false
    for (const { col: ci, f } of mapa) {
      const v = ln[ci]
      if (v == null || String(v).trim() === '') continue
      const txt = v instanceof Date ? '' : String(v).trim()
      const ruim = (msg: string, nivel: 'erro' | 'aviso' = 'aviso') => problemas.push({ linha: n, nivel, msg: `${f.label}: ${msg}` })
      switch (f.type) {
        case 'date': {
          const d = data(v)
          if (d) it[f.key] = d
          else ruim(`data “${txt}” não reconhecida (use dd/mm/aaaa) — ficou em branco`)
          break
        }
        case 'month': {
          const d = mes(v)
          if (d) it[f.key] = d
          else ruim(`mês “${txt}” não reconhecido (use mm/aaaa) — ficou em branco`)
          break
        }
        case 'time': {
          const h = hora(v)
          if (h) it[f.key] = h
          else ruim(`hora “${txt}” não reconhecida (use hh:mm) — ficou em branco`)
          break
        }
        case 'number':
        case 'money':
        case 'rating':
        case 'percent': {
          let x = toNumber(v)
          if (x == null) {
            ruim(`“${txt}” não é um número — ficou em branco`)
            break
          }
          // percentual vindo do Excel como fração (25% = 0,25)
          if (f.type === 'percent' && typeof v === 'number' && Math.abs(x) <= 1 && x !== 0) x = Math.round(x * 10000) / 100
          if (f.type === 'rating') x = Math.min(5, Math.max(1, Math.round(x)))
          it[f.key] = x
          break
        }
        case 'bool': {
          const b = norm(v)
          if (SIM.has(b)) it[f.key] = true
          else if (NAO.has(b)) it[f.key] = false
          else ruim(`use Sim ou Não (veio “${txt}”)`)
          break
        }
        case 'select': {
          const ops = opcoesCampo(f)
          const achou = ops.find((o) => norm(o) === norm(v))
          it[f.key] = achou ?? txt
          if (!achou && ops.length) ruim(`“${txt}” não está na lista de opções — importado assim mesmo`)
          break
        }
        case 'ref': {
          const id = idDe(f.ref!, txt)
          if (id) it[f.key] = id
          else if (criarFaltantes && podeCriar(f.ref!)) {
            faltantes.set(`${f.ref}|${norm(txt)}`, { ref: f.ref!, nome: txt })
            it[f.key] = `__novo__${f.ref}|${norm(txt)}`
          } else ruim(`“${txt}” não existe em ${MOD[f.ref!]?.title ?? f.ref} — ficou em branco`)
          break
        }
        case 'multiref': {
          const ids: string[] = []
          for (const nome of txt.split(/[;\n]/).map((x) => x.trim()).filter(Boolean)) {
            const id = idDe(f.ref!, nome)
            if (id) ids.push(id)
            else if (criarFaltantes && podeCriar(f.ref!)) {
              faltantes.set(`${f.ref}|${norm(nome)}`, { ref: f.ref!, nome })
              ids.push(`__novo__${f.ref}|${norm(nome)}`)
            } else ruim(`“${nome}” não existe em ${MOD[f.ref!]?.title ?? f.ref} — ignorado`)
          }
          if (ids.length) it[f.key] = ids
          break
        }
        default:
          it[f.key] = v instanceof Date ? iso(v) : String(v)
      }
    }
    for (const f of fs) {
      if (f.required && (it[f.key] == null || it[f.key] === '')) {
        problemas.push({ linha: n, nivel: 'erro', msg: `${f.label} é obrigatório — linha não será importada` })
        erro = true
      }
    }
    if (erro) linhasComErro++
    else itens.push(it)
  })
  for (const f of fs) if (f.required && !mapa.some((x) => x.f.key === f.key)) problemas.unshift({ linha: 1, nivel: 'erro', msg: `A coluna obrigatória “${f.label}” não está na planilha` })
  return { itens, problemas, ignoradas, mapa, faltantes: [...faltantes.values()], linhasComErro }
}

/** Cria os cadastros que faltavam (pessoas, projetos, etiquetas…) e troca as referências provisórias. */
export function resolverFaltantes(res: Resultado, lote: string): { col: string; itens: Item[] }[] {
  const novos = new Map<string, Item>()
  const porCol = new Map<string, Item[]>()
  for (const fal of res.faltantes) {
    const m = MOD[fal.ref]
    const it: Item = { id: uid(), [m.titleField]: fal.nome, _importacao: lote }
    for (const f of m.fields) if (f.default !== undefined && it[f.key] === undefined) it[f.key] = f.default
    if (fal.ref === 'etiquetas') it.cor = Object.keys(CORES_ETIQUETA)[novos.size % Object.keys(CORES_ETIQUETA).length]
    novos.set(`${fal.ref}|${norm(fal.nome)}`, it)
    porCol.set(fal.ref, [...(porCol.get(fal.ref) ?? []), it])
  }
  const troca = (v: unknown) => (typeof v === 'string' && v.startsWith('__novo__') ? (novos.get(v.slice(8))?.id ?? null) : v)
  for (const it of res.itens)
    for (const k of Object.keys(it)) {
      const v = it[k]
      it[k] = Array.isArray(v) ? v.map(troca).filter(Boolean) : troca(v)
    }
  return [...porCol.entries()].map(([col, itens]) => ({ col, itens }))
}
