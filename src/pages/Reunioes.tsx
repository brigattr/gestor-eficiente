import { useEffect, useRef, useState } from 'react'
import { avisar, confirmar } from '../components/Dialogs'
import { Icon } from '../components/Icon'
import { ModulePage } from '../components/ModulePage'
import { Chip } from '../components/ui'
import { bulk, list, type Item } from '../data/store'
import { api, servidor } from '../lib/api'
import { isAdmin, canWrite } from '../lib/session'
import { sincronizarAgora } from '../lib/sync'
import { camposOutlook, lerIcs, origemIcs } from '../shared/ics'

type Ultima = { em: string; eventos: number; novos: number; alterados: number; removidos: number; erro?: string }
type Cal = { id: string; nome: string; origem: string; host: string | null; ultima: Ultima | null }
type Status = { configurado: boolean; calendarios: Cal[] }
type Resposta = Status & { resultado?: Ultima }

const COMO: Record<string, { ex: string; passos: string }> = {
  Outlook: {
    ex: 'https://outlook.office365.com/owa/calendar/…/calendar.ics',
    passos: 'No Outlook (web): Configurações → Calendário → Calendários compartilhados → Publicar um calendário → escolha o calendário e "Pode exibir todos os detalhes" → Publicar → copie o link ICS.',
  },
  Google: {
    ex: 'https://calendar.google.com/calendar/ical/…/basic.ics',
    passos: 'No Google Agenda (computador): ⚙ Configurações → no menu da esquerda, clique na agenda → "Integrar agenda" → copie o "Endereço secreto no formato iCal".',
  },
  iCloud: {
    ex: 'webcal://p00-caldav.icloud.com/published/2/…',
    passos: 'No iPhone/iPad: app Calendário → Calendários → ⓘ ao lado do calendário → ative "Calendário Público" → Compartilhar Link → Copiar. No Mac ou em icloud.com/calendar: clique no ícone de compartilhar do calendário → "Calendário Público" → copie o link.',
  },
}

const quando = (em: string) => new Date(em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function CalendariosCard() {
  const [st, setSt] = useState<Status | null>(null)
  const [link, setLink] = useState('')
  const [nome, setNome] = useState('')
  const [guia, setGuia] = useState('Outlook')
  const [busy, setBusy] = useState(false)
  const [novo, setNovo] = useState(false)
  const [trocando, setTrocando] = useState<string | null>(null)
  const arq = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (servidor()) api<Status>('/calendar').then(setSt).catch(() => setSt(null))
  }, [])

  async function rodar(fn: () => Promise<Resposta>, msg: (r: Resposta) => string) {
    setBusy(true)
    try {
      const r = await fn()
      setSt(r)
      avisar(msg(r))
      await sincronizarAgora()
      return true
    } catch (e) {
      avisar((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }
  async function conectar() {
    const ok = await rodar(
      () => api<Resposta>('/calendar', { method: 'POST', body: { url: link, nome: nome.trim() || undefined } }),
      (r) => `Calendário conectado: ${r.resultado?.eventos ?? 0} compromissos nos próximos 4 meses.`,
    )
    if (ok) (setLink(''), setNome(''), setNovo(false))
  }
  async function trocar(id: string) {
    const ok = await rodar(() => api<Resposta>(`/calendar/${id}`, { method: 'PUT', body: { url: link } }), () => 'Link atualizado.')
    if (ok) (setLink(''), setTrocando(null))
  }
  async function renomear(c: Cal) {
    const n = window.prompt('Nome do calendário (ex.: Trabalho, Pessoal, Família):', c.nome)
    if (n == null || !n.trim()) return
    await rodar(() => api<Resposta>(`/calendar/${c.id}`, { method: 'PUT', body: { nome: n } }), () => 'Nome atualizado.')
  }
  const sync = () =>
    rodar(
      () => api<Resposta>('/calendar/sync', { method: 'POST' }),
      (r) => {
        const x = r.resultado
        return x ? `Sincronizado: ${x.novos} novo(s), ${x.alterados} alterado(s), ${x.removidos} removido(s).${x.erro ? ' ' + x.erro : ''}` : 'Sincronizado.'
      },
    )
  async function desconectar(c: Cal) {
    const apagar = await confirmar(`Desconectar o calendário "${c.nome}"?\n\nConfirmar = desconectar e apagar os compromissos que vieram dele.\nCancelar = não fazer nada.`, { ok: 'Desconectar e apagar', danger: true })
    if (!apagar) return
    setSt(await api<Status>(`/calendar/${c.id}?eventos=1`, { method: 'DELETE' }))
    await sincronizarAgora()
  }

  /** Importação de arquivo .ics: cria/atualiza as reuniões preservando suas anotações. */
  async function importar(f: File | undefined) {
    if (!f) return
    try {
      const txt = await f.text()
      const origem = origemIcs(txt)
      const ocs = lerIcs(txt, Date.now() - 30 * 86400000, Date.now() + 365 * 86400000)
      const atuais = new Map(list('reunioes').map((r) => [r.id, r]))
      const itens: Item[] = ocs.map((o) => {
        const c = camposOutlook(o, origem)
        const sugerido = c.tipoSugerido
        delete c.tipoSugerido
        const ant = atuais.get(o.id)
        return ant ? ({ ...ant, ...c } as Item) : ({ id: o.id, ...c, tipo: sugerido ?? null, preparado: false } as Item)
      })
      await bulk('reunioes', itens)
      avisar(`${itens.length} compromisso(s) importado(s) de ${f.name}.`)
    } catch (e) {
      avisar(`Não foi possível ler o arquivo: ${(e as Error).message}`)
    }
  }

  const cals = st?.calendarios ?? []
  const comErro = cals.some((c) => c.ultima?.erro)
  const formLink = (onOk: () => void, rotulo: string, cancelar: () => void) => (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 6 }}>
        {Object.keys(COMO).map((k) => (
          <button key={k} className={'btn sm' + (guia === k ? ' primary' : '')} onClick={() => setGuia(k)}>
            {k}
          </button>
        ))}
      </div>
      <span className="small muted">
        {COMO[guia].passos} Cole o link aqui: ele fica guardado só no servidor e nunca é mostrado de novo.
      </span>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        {rotulo === 'Conectar' && <input aria-label="Nome do calendário" placeholder="Nome (ex.: Pessoal)" style={{ maxWidth: 170 }} value={nome} onChange={(e) => setNome(e.target.value)} />}
        <input id="ics-link" type="password" autoComplete="off" placeholder={COMO[guia].ex} value={link} onChange={(e) => setLink(e.target.value)} />
        <button className="btn primary" disabled={busy || !link.trim()} onClick={onOk}>
          {busy ? 'Conectando…' : rotulo}
        </button>
        <button className="btn" onClick={cancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )

  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row">
        <Icon name="calendar" />
        <h2 className="grow">Calendários conectados</h2>
        {servidor() && cals.length ? <Chip t={comErro ? 'bad' : 'ok'}>{comErro ? 'com erro' : cals.length === 1 ? 'conectado' : `${cals.length} conectados`}</Chip> : <Chip t="muted">nenhum conectado</Chip>}
      </div>
      {servidor() &&
        cals.map((c) => (
          <div key={c.id} className="stack" style={{ gap: 6, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            <div className="row small">
              <Chip t="info">{c.origem}</Chip>
              <span className="grow">
                <b>{c.nome}</b> · {c.host}.{' '}
                {c.ultima ? (
                  <>
                    Última sincronização: {quando(c.ultima.em)} · {c.ultima.eventos} compromissos na janela.
                    {c.ultima.erro && <span style={{ color: 'var(--bad)' }}> {c.ultima.erro}</span>}
                  </>
                ) : (
                  'Ainda não sincronizado.'
                )}
              </span>
              {isAdmin() && (
                <>
                  <button className="btn sm" onClick={() => renomear(c)}>
                    Renomear
                  </button>
                  <button className="btn sm" onClick={() => (setTrocando(c.id), setNovo(false), setLink(''), setGuia(COMO[c.origem] ? c.origem : 'Outlook'))}>
                    Trocar link
                  </button>
                  <button className="btn sm danger" onClick={() => desconectar(c)}>
                    Desconectar
                  </button>
                </>
              )}
            </div>
            {trocando === c.id && formLink(() => trocar(c.id), 'Salvar link', () => setTrocando(null))}
          </div>
        ))}
      {servidor() && (
        <div className="row">
          {isAdmin() && !novo && (
            <button className="btn sm primary" onClick={() => (setNovo(true), setTrocando(null), setLink(''))}>
              <Icon name="plus" size={14} /> Adicionar calendário (Outlook, Google, iCloud…)
            </button>
          )}
          <span className="grow" />
          {canWrite() && cals.length > 0 && (
            <button className="btn sm" disabled={busy} onClick={sync}>
              {busy ? 'Sincronizando…' : 'Sincronizar agora'}
            </button>
          )}
        </div>
      )}
      {servidor() && isAdmin() && novo && formLink(conectar, 'Conectar', () => setNovo(false))}
      <div className="row small muted">
        <span className="grow">
          {servidor()
            ? 'Sincroniza sozinho quando você abre o sistema (no máximo 1× por hora); cada serviço pode levar algumas horas para publicar mudanças. Pauta, materiais, preparo e decisões que você anotar são mantidos.'
            : 'Neste modo (sem servidor) importe um arquivo .ics exportado do Outlook, Google ou iCloud.'}
        </span>
        {canWrite() && (
          <button className="btn sm" onClick={() => arq.current?.click()}>
            <Icon name="upload" size={14} /> Importar arquivo .ics
          </button>
        )}
        <input ref={arq} type="file" accept=".ics,text/calendar" hidden onChange={(e) => (void importar(e.target.files?.[0]), (e.target.value = ''))} />
      </div>
    </div>
  )
}

export function Reunioes() {
  return <ModulePage col="reunioes" above={() => <CalendariosCard />} />
}
