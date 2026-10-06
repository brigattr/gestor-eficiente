// Leitor de calendários iCalendar (.ics) — usado no servidor (link publicado do Outlook)
// e no navegador (importação de arquivo). Expande recorrências (RRULE/EXDATE/RECURRENCE-ID)
// e converte os horários para o fuso de exibição (padrão: America/Sao_Paulo).

export type Ocorrencia = {
  id: string // estável por ocorrência: ol_<uid>_<início original>
  uid: string
  titulo: string
  data: string // YYYY-MM-DD no fuso de exibição
  hora: string | null // HH:mm (null = dia inteiro)
  horaFim: string | null
  local: string | null
  participantes: string | null
  descricao: string | null
  organizador: string | null
}

type Prop = { name: string; params: Record<string, string>; value: string }
type VEvent = Record<string, Prop[]>

// Nomes de fuso do Windows (Outlook) → IANA
const WIN_TZ: Record<string, string> = {
  'E. South America Standard Time': 'America/Sao_Paulo',
  'SA Eastern Standard Time': 'America/Cayenne',
  'Argentina Standard Time': 'America/Buenos_Aires',
  'Pacific SA Standard Time': 'America/Santiago',
  'SA Pacific Standard Time': 'America/Bogota',
  'Central Standard Time (Mexico)': 'America/Mexico_City',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'Romance Standard Time': 'Europe/Paris',
  'GTB Standard Time': 'Europe/Bucharest',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'FLE Standard Time': 'Europe/Kiev',
  'Turkey Standard Time': 'Europe/Istanbul',
  'Russian Standard Time': 'Europe/Moscow',
  'South Africa Standard Time': 'Africa/Johannesburg',
  'Egypt Standard Time': 'Africa/Cairo',
  'Arabian Standard Time': 'Asia/Dubai',
  'India Standard Time': 'Asia/Kolkata',
  'China Standard Time': 'Asia/Shanghai',
  'Singapore Standard Time': 'Asia/Singapore',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Korea Standard Time': 'Asia/Seoul',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'UTC': 'UTC',
  'Coordinated Universal Time': 'UTC',
}

function tzValida(tz: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
export function ianaDe(tzid: string | undefined, padrao: string) {
  if (!tzid) return padrao
  const limpo = tzid.replace(/^"|"$/g, '').trim()
  if (WIN_TZ[limpo]) return WIN_TZ[limpo]
  if (tzValida(limpo)) return limpo
  // ex.: "(UTC+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna"
  if (/Berlin|Amsterdam|Vienna|Rome/i.test(limpo)) return 'Europe/Berlin'
  if (/Brasilia|Brasília|Sao Paulo|São Paulo/i.test(limpo)) return 'America/Sao_Paulo'
  return padrao
}

// ───────── datas de calendário (aritmética em UTC para não sofrer com horário de verão)
type Civil = { y: number; m: number; d: number; hh: number; mi: number }
const pad = (n: number) => String(n).padStart(2, '0')
const civilMs = (c: Civil) => Date.UTC(c.y, c.m - 1, c.d, c.hh, c.mi)
const deMs = (ms: number): Civil => {
  const x = new Date(ms)
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), hh: x.getUTCHours(), mi: x.getUTCMinutes() }
}
const addDias = (c: Civil, n: number) => deMs(civilMs(c) + n * 86400000)
const dow = (c: Civil) => new Date(Date.UTC(c.y, c.m - 1, c.d)).getUTCDay() // 0 = domingo
const diasNoMes = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function partes(ms: number, tz: string): Civil {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    fmtCache.set(tz, f)
  }
  const p: Record<string, string> = {}
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour % 24, mi: +p.minute }
}
/** Hora local (de parede) num fuso → instante UTC. */
function paraUtc(c: Civil, tz: string) {
  if (tz === 'UTC') return civilMs(c)
  const alvo = civilMs(c)
  let ms = alvo
  for (let i = 0; i < 3; i++) ms += alvo - civilMs(partes(ms, tz))
  return ms
}

type Momento = { ms: number; diaInteiro: boolean; civil: Civil; tz: string }
function lerData(p: Prop | undefined, padrao: string): Momento | null {
  if (!p) return null
  const v = p.value.trim()
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
  if (!m) return null
  const civil: Civil = { y: +m[1], m: +m[2], d: +m[3], hh: m[4] ? +m[4] : 0, mi: m[5] ? +m[5] : 0 }
  const diaInteiro = p.params.VALUE === 'DATE' || !m[4]
  if (diaInteiro) return { ms: civilMs(civil), diaInteiro, civil, tz: 'UTC' }
  if (m[7]) return { ms: civilMs(civil), diaInteiro, civil: partes(civilMs(civil), padrao), tz: padrao }
  const tz = ianaDe(p.params.TZID, padrao)
  return { ms: paraUtc(civil, tz), diaInteiro, civil, tz }
}

// ───────── leitura do arquivo
function desdobrar(txt: string) {
  return txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '')
}
function lerProp(linha: string): Prop | null {
  // NOME;PARAM=V;PARAM="V:X":valor  (os dois-pontos dentro de aspas não separam)
  let i = 0
  let q = false
  for (; i < linha.length; i++) {
    const ch = linha[i]
    if (ch === '"') q = !q
    else if (ch === ':' && !q) break
  }
  if (i >= linha.length) return null
  const [nome, ...ps] = linha.slice(0, i).split(';')
  const params: Record<string, string> = {}
  for (const x of ps) {
    const k = x.indexOf('=')
    if (k > 0) params[x.slice(0, k).toUpperCase()] = x.slice(k + 1).replace(/^"|"$/g, '')
  }
  return { name: nome.toUpperCase(), params, value: linha.slice(i + 1) }
}
const texto = (v: string | undefined) =>
  v
    ?.replace(/\\n/gi, '\n')
    .replace(/\\([,;\\])/g, '$1')
    .trim() || null

function eventos(txt: string): VEvent[] {
  const out: VEvent[] = []
  let atual: VEvent | null = null
  let prof = 0
  for (const l of desdobrar(txt).split('\n')) {
    if (!l) continue
    if (/^BEGIN:VEVENT$/i.test(l)) {
      atual = {}
      prof = 0
      continue
    }
    if (/^END:VEVENT$/i.test(l)) {
      if (atual) out.push(atual)
      atual = null
      continue
    }
    if (!atual) continue
    if (/^BEGIN:/i.test(l)) prof++ // VALARM etc.
    else if (/^END:/i.test(l)) prof--
    else if (prof === 0) {
      const p = lerProp(l)
      if (p) (atual[p.name] ??= []).push(p)
    }
  }
  return out
}

// ───────── recorrência
const DIAS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

/** n-ésimo dia da semana no mês (n negativo = do fim). */
function nEsimo(y: number, m: number, wd: number, n: number): number | null {
  const ult = diasNoMes(y, m)
  const dias: number[] = []
  for (let d = 1; d <= ult; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === wd) dias.push(d)
  const i = n > 0 ? n - 1 : dias.length + n
  return dias[i] ?? null
}

function expandir(base: Momento, rrule: string, ate: number, limite = 1500): Civil[] {
  const r: Record<string, string> = {}
  for (const kv of rrule.split(';')) {
    const [k, v] = kv.split('=')
    if (k && v) r[k.toUpperCase()] = v.toUpperCase()
  }
  const freq = r.FREQ
  const intervalo = Math.max(1, Number(r.INTERVAL || 1))
  const count = r.COUNT ? Number(r.COUNT) : Infinity
  let until = Infinity
  if (r.UNTIL) {
    const u = lerData({ name: 'UNTIL', params: r.UNTIL.length === 8 ? { VALUE: 'DATE' } : {}, value: r.UNTIL }, base.tz)
    if (u) until = u.diaInteiro ? u.ms + 86399000 : u.ms
  }
  const byDay = r.BYDAY ? r.BYDAY.split(',').map((x) => ({ n: x.length > 2 ? Number(x.slice(0, -2)) : 0, wd: DIAS[x.slice(-2)] })) : []
  const byMonthDay = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : []
  const byMonth = r.BYMONTH ? r.BYMONTH.split(',').map(Number) : []
  const setPos = r.BYSETPOS ? Number(r.BYSETPOS) : 0
  const wkst = DIAS[r.WKST ?? 'MO'] ?? 1
  const c0 = base.civil
  const out: Civil[] = []
  const hora = (c: Civil): Civil => ({ ...c, hh: c0.hh, mi: c0.mi })
  const msDe = (c: Civil) => (base.diaInteiro ? civilMs(c) : paraUtc(c, base.tz))
  const aceita = (c: Civil) => {
    if (civilMs(c) < civilMs(c0)) return true // antes do início: ignora, mas continua
    const ms = msDe(c)
    if (ms > until || ms > ate || out.length >= count) return false
    out.push(c)
    return true
  }
  for (let k = 0, passos = 0; passos < limite; k++, passos++) {
    let cand: Civil[] = []
    if (freq === 'DAILY') {
      cand = [addDias(c0, k * intervalo)]
      if (byDay.length) cand = cand.filter((c) => byDay.some((b) => b.wd === dow(c)))
    } else if (freq === 'WEEKLY') {
      const iniSemana = addDias(c0, -((dow(c0) - wkst + 7) % 7) + k * 7 * intervalo)
      const dias = byDay.length ? byDay.map((b) => b.wd) : [dow(c0)]
      cand = dias.map((wd) => hora(addDias(iniSemana, (wd - wkst + 7) % 7))).sort((a, b) => civilMs(a) - civilMs(b))
    } else if (freq === 'MONTHLY' || freq === 'YEARLY') {
      const meses = freq === 'MONTHLY' ? [((c0.m - 1 + k * intervalo) % 12) + 1] : byMonth.length ? byMonth : [c0.m]
      const ano = freq === 'MONTHLY' ? c0.y + Math.floor((c0.m - 1 + k * intervalo) / 12) : c0.y + k * intervalo
      for (const m of meses) {
        let dias: number[] = []
        if (byMonthDay.length) dias = byMonthDay.map((d) => (d < 0 ? diasNoMes(ano, m) + d + 1 : d)).filter((d) => d >= 1 && d <= diasNoMes(ano, m))
        else if (byDay.length) {
          for (const b of byDay) {
            if (b.n) {
              const d = nEsimo(ano, m, b.wd, b.n)
              if (d) dias.push(d)
            } else for (let d = 1; d <= diasNoMes(ano, m); d++) if (new Date(Date.UTC(ano, m - 1, d)).getUTCDay() === b.wd) dias.push(d)
          }
          dias.sort((a, b) => a - b)
          if (setPos) dias = [dias[setPos > 0 ? setPos - 1 : dias.length + setPos]].filter(Boolean)
        } else if (c0.d <= diasNoMes(ano, m)) dias = [c0.d]
        cand.push(...dias.map((d) => ({ y: ano, m, d, hh: c0.hh, mi: c0.mi })))
      }
    } else {
      return [c0] // frequência não suportada: só a primeira
    }
    for (const c of cand) if (!aceita(c)) return out
    if (cand.length && msDe(cand[cand.length - 1]) > ate) return out
  }
  return out
}

function fnv(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}
const carimbo = (c: Civil) => `${c.y}${pad(c.m)}${pad(c.d)}${pad(c.hh)}${pad(c.mi)}`
const nomeDe = (p: Prop) => p.params.CN?.replace(/^"|"$/g, '') || p.value.replace(/^mailto:/i, '')

/**
 * Lê um .ics e devolve as ocorrências entre `de` e `ate` (ms), no fuso `fuso`.
 */
export function lerIcs(txt: string, de: number, ate: number, fuso = 'America/Sao_Paulo'): Ocorrencia[] {
  const evs = eventos(txt)
  // exceções editadas (RECURRENCE-ID) por UID
  const excecoes = new Map<string, Map<number, VEvent>>()
  for (const e of evs) {
    const rid = e['RECURRENCE-ID']?.[0]
    const uid = e.UID?.[0]?.value
    if (!rid || !uid) continue
    const m = lerData(rid, fuso)
    if (!m) continue
    if (!excecoes.has(uid)) excecoes.set(uid, new Map())
    excecoes.get(uid)!.set(m.ms, e)
  }
  const out: Ocorrencia[] = []
  const emitir = (e: VEvent, ini: Momento, origCivil: Civil, uid: string) => {
    if (/CANCELLED/i.test(e.STATUS?.[0]?.value ?? '')) return
    const fimP = lerData(e.DTEND?.[0], fuso)
    const durMs = fimP ? fimP.ms - (lerData(e.DTSTART?.[0], fuso)?.ms ?? fimP.ms) : 0
    const loc = ini.diaInteiro ? ini.civil : partes(ini.ms, fuso)
    if (ini.ms + Math.max(durMs, 0) < de || ini.ms > ate) return
    const fimLoc = !ini.diaInteiro && durMs > 0 ? partes(ini.ms + durMs, fuso) : null
    const att = (e.ATTENDEE ?? []).map(nomeDe).filter(Boolean)
    const org = e.ORGANIZER?.[0] ? nomeDe(e.ORGANIZER[0]) : null
    const privado = /PRIVATE|CONFIDENTIAL/i.test(e.CLASS?.[0]?.value ?? '')
    out.push({
      id: `ol_${fnv(uid)}_${carimbo(origCivil)}`,
      uid,
      titulo: texto(e.SUMMARY?.[0]?.value) ?? (privado ? 'Compromisso particular' : '(sem título)'),
      data: `${loc.y}-${pad(loc.m)}-${pad(loc.d)}`,
      hora: ini.diaInteiro ? null : `${pad(loc.hh)}:${pad(loc.mi)}`,
      horaFim: fimLoc ? `${pad(fimLoc.hh)}:${pad(fimLoc.mi)}` : null,
      local: texto(e.LOCATION?.[0]?.value),
      participantes: att.length ? att.slice(0, 30).join(', ') + (att.length > 30 ? ` e mais ${att.length - 30}` : '') : null,
      descricao: texto(e.DESCRIPTION?.[0]?.value)?.slice(0, 4000) ?? null,
      organizador: org,
    })
  }
  for (const e of evs) {
    if (e['RECURRENCE-ID']) continue
    const uid = e.UID?.[0]?.value ?? fnv(JSON.stringify(e.SUMMARY ?? '') + JSON.stringify(e.DTSTART ?? ''))
    const ini = lerData(e.DTSTART?.[0], fuso)
    if (!ini) continue
    const rrule = e.RRULE?.[0]?.value
    if (!rrule) {
      emitir(e, ini, ini.civil, uid)
      continue
    }
    const ex = new Set<number>()
    for (const p of e.EXDATE ?? [])
      for (const v of p.value.split(',')) {
        const m = lerData({ ...p, value: v }, fuso)
        if (m) ex.add(m.ms)
      }
    const mods = excecoes.get(uid)
    for (const c of expandir(ini, rrule, ate)) {
      const ms = ini.diaInteiro ? civilMs(c) : paraUtc(c, ini.tz)
      if (ex.has(ms)) continue
      const mod = mods?.get(ms)
      if (mod) {
        const mi = lerData(mod.DTSTART?.[0], fuso)
        if (mi) emitir(mod, mi, c, uid)
        continue
      }
      emitir(e, { ...ini, ms, civil: c }, c, uid)
    }
  }
  return out.sort((a, b) => (a.data + (a.hora ?? '')).localeCompare(b.data + (b.hora ?? '')))
}

/** Campos que vêm do Outlook (o restante da reunião — pauta, preparo, decisões — é do usuário). */
export function camposOutlook(o: Ocorrencia): Record<string, unknown> {
  const c: Record<string, unknown> = {
    titulo: o.titulo,
    data: o.data,
    hora: o.hora,
    horaFim: o.horaFim,
    local: o.local,
    participantes: o.participantes,
    descricaoOutlook: o.descricao,
    organizador: o.organizador,
    origem: 'Outlook',
  }
  if (/\b1[:x]1\b|one.?on.?one/i.test(o.titulo)) c.tipoSugerido = '1:1'
  return c
}
