import { avisar } from '../components/Dialogs'
import { useState } from 'react'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { Chip, PageHead } from '../components/ui'
import { ROTEIROS } from '../data/content'
import { get, upsert, useDB } from '../data/store'
import { fmtDate, label, todayISO } from '../lib/format'

/** Conduz uma conversa: escolhe pessoa e roteiro, anota respostas e acordos. */
export function OneOnOne() {
  const db = useDB()
  const pessoas = (db.pessoas ?? []).filter((p) => p.status !== 'Desligado')
  const [pessoa, setPessoa] = useState(pessoas[0]?.id ?? '')
  const [roteiro, setRoteiro] = useState('Gestão')
  const [resp, setResp] = useState<Record<string, string>>({})
  const [acordos, setAcordos] = useState('')
  const [humor, setHumor] = useState(3)
  const [proxima, setProxima] = useState('')
  const hist = (db.umaum ?? []).filter((u) => u.colaborador === pessoa).sort((a, b) => String(b.data).localeCompare(String(a.data)))

  function salvar() {
    const perguntas = ROTEIROS[roteiro]
    const txt = perguntas
      .filter((q) => resp[q]?.trim())
      .map((q) => `• ${q}\n  ${resp[q].trim()}`)
      .join('\n')
    upsert('umaum', { colaborador: pessoa, data: todayISO(), roteiro, humor, acordos: [acordos, txt && '— Respostas —\n' + txt].filter(Boolean).join('\n\n'), proxima: proxima || null })
    setResp({})
    setAcordos('')
    setProxima('')
    avisar('Conversa registrada no histórico de ' + label('pessoas', get('pessoas', pessoa)))
  }

  return (
    <>
      <PageHead title="1:1 e roteiros de conversa" desc="Roteiros da sua base: Gestão, Status, Feedback, Avaliação de time, Delegação e Tomada de decisão. Registre respostas e acordos no histórico da pessoa." />
      <div className="grid g3">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} style={{ maxWidth: 240 }}>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {String(p.nome)}
                </option>
              ))}
            </select>
            <div className="row" style={{ gap: 4 }}>
              {Object.keys(ROTEIROS).map((r) => (
                <button key={r} className={`chip ${r === roteiro ? 'gold' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setRoteiro(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            {ROTEIROS[roteiro].map((q, i) => (
              <label key={q} className="field">
                <span style={{ color: 'var(--text)' }}>
                  {i + 1}. {q}
                </span>
                <textarea rows={2} value={resp[q] ?? ''} onChange={(e) => setResp({ ...resp, [q]: e.target.value })} />
              </label>
            ))}
            <label className="field">
              <span>Acordos / próximos passos</span>
              <textarea value={acordos} onChange={(e) => setAcordos(e.target.value)} />
            </label>
            <div className="row">
              <label className="field">
                <span>Termômetro</span>
                <span className="row" style={{ gap: 2 }}>
                  {[1, 2, 3, 4, 5].map((k) => (
                    <button key={k} className="btn ghost sm" style={{ fontSize: 18, color: humor >= k ? 'var(--accent)' : 'var(--muted)' }} onClick={() => setHumor(k)}>
                      {humor >= k ? '★' : '☆'}
                    </button>
                  ))}
                </span>
              </label>
              <label className="field" style={{ maxWidth: 200 }}>
                <span>Próxima 1:1</span>
                <input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} />
              </label>
              <span className="grow" />
              <button className="btn primary" onClick={salvar} disabled={!pessoa}>
                Registrar conversa
              </button>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <Icon name="clock" />
            <h2>Histórico</h2>
          </div>
          {hist.length === 0 && <div className="empty">Sem conversas registradas.</div>}
          <div className="list">
            {hist.map((h) => (
              <div key={h.id} style={{ display: 'grid', cursor: 'pointer' }} onClick={() => openEditor('umaum', h.id)}>
                <span className="row">
                  <b>{fmtDate(h.data)}</b>
                  <Chip t="muted">{String(h.roteiro ?? '')}</Chip>
                  <span style={{ color: 'var(--accent)' }}>{'★'.repeat(Number(h.humor || 0))}</span>
                </span>
                <span className="small muted pre" style={{ maxHeight: 80, overflow: 'hidden' }}>
                  {String(h.acordos ?? '')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ModulePage col="umaum" embedded />
    </>
  )
}
