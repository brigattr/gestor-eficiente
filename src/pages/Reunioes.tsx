import { useEffect, useRef, useState } from 'react'
import { avisar, confirmar } from '../components/Dialogs'
import { Icon } from '../components/Icon'
import { ModulePage } from '../components/ModulePage'
import { Chip } from '../components/ui'
import { bulk, list, type Item } from '../data/store'
import { api, servidor } from '../lib/api'
import { isAdmin, canWrite } from '../lib/session'
import { sincronizarAgora } from '../lib/sync'
import { camposOutlook, lerIcs } from '../shared/ics'

type Status = { configurado: boolean; host: string | null; ultima: { em: string; eventos: number; novos: number; alterados: number; removidos: number; erro?: string } | null }

function OutlookCard() {
  const [st, setSt] = useState<Status | null>(null)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [editando, setEditando] = useState(false)
  const arq = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (servidor()) api<Status>('/calendar').then(setSt).catch(() => setSt(null))
  }, [])

  async function salvar() {
    setBusy(true)
    try {
      const r = await api<Status & { resultado: Status['ultima'] }>('/calendar', { method: 'PUT', body: { url: link } })
      setSt(r)
      setLink('')
      setEditando(false)
      avisar(`Calendário conectado: ${r.resultado?.eventos ?? 0} reuniões nos próximos 4 meses.`)
      await sincronizarAgora()
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function sync() {
    setBusy(true)
    try {
      const r = await api<Status & { resultado: Status['ultima'] }>('/calendar/sync', { method: 'POST' })
      setSt(r)
      const x = r.resultado
      avisar(x ? `Sincronizado: ${x.novos} nova(s), ${x.alterados} alterada(s), ${x.removidos} removida(s).` : 'Sincronizado.')
      await sincronizarAgora()
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function desconectar() {
    const apagar = await confirmar('Desconectar o calendário do Outlook?\n\nConfirmar = desconectar e apagar as reuniões que vieram do Outlook.\nCancelar = não fazer nada.', { ok: 'Desconectar e apagar', danger: true })
    if (!apagar) return
    setSt(await api<Status>('/calendar?eventos=1', { method: 'DELETE' }))
    await sincronizarAgora()
  }

  /** Importação de arquivo .ics: cria/atualiza as reuniões preservando suas anotações. */
  async function importar(f: File | undefined) {
    if (!f) return
    try {
      const ocs = lerIcs(await f.text(), Date.now() - 30 * 86400000, Date.now() + 365 * 86400000)
      const atuais = new Map(list('reunioes').map((r) => [r.id, r]))
      const itens: Item[] = ocs.map((o) => {
        const c = camposOutlook(o)
        const sugerido = c.tipoSugerido
        delete c.tipoSugerido
        const ant = atuais.get(o.id)
        return ant ? ({ ...ant, ...c } as Item) : ({ id: o.id, ...c, tipo: sugerido ?? null, preparado: false } as Item)
      })
      await bulk('reunioes', itens)
      avisar(`${itens.length} reunião(ões) importada(s) de ${f.name}.`)
    } catch (e) {
      avisar(`Não foi possível ler o arquivo: ${(e as Error).message}`)
    }
  }

  const u = st?.ultima
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row">
        <Icon name="calendar" />
        <h2 className="grow">Calendário do Outlook</h2>
        {servidor() && st?.configurado ? <Chip t={u?.erro ? 'bad' : 'ok'}>{u?.erro ? 'com erro' : 'conectado'}</Chip> : <Chip t="muted">não conectado</Chip>}
      </div>
      {servidor() && st?.configurado && !editando && (
        <div className="row small">
          <span className="grow">
            Link de <b>{st.host}</b>.{' '}
            {u ? (
              <>
                Última sincronização: {new Date(u.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {u.eventos} reuniões na janela (30 dias atrás a 4 meses à frente).
                {u.erro && <span style={{ color: 'var(--bad)' }}> {u.erro}</span>}
              </>
            ) : (
              'Ainda não sincronizado.'
            )}
          </span>
          {canWrite() && (
            <button className="btn primary sm" disabled={busy} onClick={sync}>
              {busy ? 'Sincronizando…' : 'Sincronizar agora'}
            </button>
          )}
          {isAdmin() && (
            <>
              <button className="btn sm" onClick={() => setEditando(true)}>
                Trocar link
              </button>
              <button className="btn sm danger" onClick={desconectar}>
                Desconectar
              </button>
            </>
          )}
        </div>
      )}
      {servidor() && isAdmin() && (!st?.configurado || editando) && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="small muted">
            No Outlook: Configurações → Calendário → Calendários compartilhados → <b>Publicar um calendário</b> → copie o link <b>ICS</b> e cole aqui. O link fica guardado só no servidor e nunca é mostrado de novo.
          </span>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input id="ics-link" type="password" autoComplete="off" placeholder="https://outlook.office365.com/owa/calendar/…/calendar.ics" value={link} onChange={(e) => setLink(e.target.value)} />
            <button className="btn primary" disabled={busy || !link.trim()} onClick={salvar}>
              {busy ? 'Conectando…' : 'Conectar'}
            </button>
            {editando && (
              <button className="btn" onClick={() => setEditando(false)}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
      <div className="row small muted">
        <span className="grow">
          {servidor()
            ? 'Sincroniza sozinho quando você abre o sistema (no máximo 1× por hora). O Outlook pode levar algumas horas para publicar mudanças. Pauta, materiais, preparo e decisões que você anotar são mantidos.'
            : 'Neste modo (sem servidor) importe um arquivo .ics exportado do Outlook.'}
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
  return <ModulePage col="reunioes" above={() => <OutlookCard />} />
}
