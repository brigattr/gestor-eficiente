import { useState } from 'react'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { Bar, Chip, Kpi } from '../components/ui'
import { get, useDB, type Item } from '../data/store'
import { daysUntil, fmtDate, label } from '../lib/format'

const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

function validade(c: Item): 'Válido' | 'Vencendo' | 'Vencido' {
  const d = daysUntil(c.validade)
  if (d == null) return 'Válido'
  if (d < 0) return 'Vencido'
  return d <= 45 ? 'Vencendo' : 'Válido'
}

export function Treinamentos() {
  const db = useDB()
  return (
    <ModulePage
      col="certificacoes"
      above={(rows) => {
        const st = rows.map(validade)
        const custo = rows.filter((r) => String(r.realizado ?? '').startsWith(String(new Date().getFullYear()))).reduce((a, r) => a + Number(r.custo || 0), 0)
        return (
          <div className="grid g4">
            <Kpi l="Registros" v={rows.length} />
            <Kpi l="Vencendo (45 dias)" v={st.filter((s) => s === 'Vencendo').length} t={st.includes('Vencendo') ? 'warn' : undefined} />
            <Kpi l="Vencidos" v={st.filter((s) => s === 'Vencido').length} t={st.includes('Vencido') ? 'bad' : undefined} />
            <Kpi l="Investimento no ano" v={custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} />
          </div>
        )
      }}
      extraViews={[
        {
          key: 'validade',
          label: 'Validade',
          render: (rows) => (
            <div className="list" style={{ padding: '0 4px' }}>
              {[...rows]
                .filter((r) => r.validade)
                .sort((a, b) => String(a.validade).localeCompare(String(b.validade)))
                .map((r) => (
                  <div key={r.id} style={{ cursor: 'pointer' }} onClick={() => openEditor('certificacoes', r.id)}>
                    <Chip v={validade(r)} t={validade(r) === 'Válido' ? 'ok' : validade(r) === 'Vencendo' ? 'warn' : 'bad'} />
                    <span className="grow">
                      {String(r.nome)} — {label('pessoas', get('pessoas', r.colaborador as string))}
                    </span>
                    <span className="small muted">vence {fmtDate(r.validade)}</span>
                  </div>
                ))}
            </div>
          ),
        },
        {
          key: 'req',
          label: 'Pessoa × requisitos do cargo',
          render: (rows) => (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Cargo</th>
                    <th>Requisitos do cargo</th>
                    <th>Aderência</th>
                  </tr>
                </thead>
                <tbody>
                  {(db.pessoas ?? [])
                    .filter((p) => p.status !== 'Desligado')
                    .map((p) => {
                      const c = get('cargos', p.cargo as string)
                      const req = String(c?.requisitos ?? '')
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean)
                      const meus = rows.filter((r) => r.colaborador === p.id)
                      const st = req.map((rq) => {
                        const m = meus.filter((x) => norm(x.nome).includes(norm(rq)) || norm(rq).includes(norm(x.nome)))
                        if (!m.length) return { rq, s: 'Falta' as const }
                        return { rq, s: m.some((x) => validade(x) !== 'Vencido') ? (m.some((x) => validade(x) === 'Válido') ? ('Ok' as const) : ('Vencendo' as const)) : ('Vencido' as const) }
                      })
                      const ok = st.filter((x) => x.s === 'Ok' || x.s === 'Vencendo').length
                      return (
                        <tr key={p.id}>
                          <td>{String(p.nome)}</td>
                          <td>{label('cargos', c)}</td>
                          <td>
                            <div className="row" style={{ gap: 4 }}>
                              {st.map((x) => (
                                <span
                                  key={x.rq}
                                  className={`chip ${x.s === 'Ok' ? 'ok' : x.s === 'Vencendo' ? 'warn' : 'bad'}`}
                                  style={{ cursor: x.s === 'Ok' ? 'default' : 'pointer' }}
                                  title={x.s}
                                  onClick={() => x.s !== 'Ok' && openEditor('certificacoes', undefined, { colaborador: p.id, nome: x.rq })}
                                >
                                  {x.s === 'Ok' ? '✓' : x.s === 'Falta' ? '✗' : '!'} {x.rq}
                                </span>
                              ))}
                              {!req.length && <span className="muted small">Cadastre requisitos no cargo</span>}
                            </div>
                          </td>
                          <td style={{ minWidth: 110 }}>{req.length ? <Bar value={ok} max={req.length} t={ok === req.length ? 'ok' : 'warn'} /> : '—'}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
              <p className="small muted" style={{ padding: '0 12px' }}>
                Compara o nome do treinamento com os requisitos cadastrados em Cargos e salários. Clique em um requisito pendente para registrar.
              </p>
            </div>
          ),
        },
      ]}
    />
  )
}

export function TreinoInterno() {
  const [cert, setCert] = useState<Item | null>(null)
  return (
    <>
      <ModulePage
        col="treinoInterno"
        extraViews={[
          {
            key: 'presenca',
            label: 'Presença e certificados',
            render: (rows) => (
              <div className="grid g2">
                {rows.map((t) => {
                  const conv = (t.convidados as string[]) ?? []
                  const pres = (t.presentes as string[]) ?? []
                  return (
                    <div key={t.id} className="card">
                      <div className="row">
                        <h3 className="grow">{String(t.tema)}</h3>
                        <Chip v={t.status} />
                      </div>
                      <div className="small muted">
                        Instrutor: {label('pessoas', get('pessoas', t.instrutor as string))} · {fmtDate(t.data)} · {String(t.cargaHoraria ?? '—')}h
                      </div>
                      <div className="row small" style={{ margin: '8px 0' }}>
                        Presença: <b>{pres.length}</b> de {conv.length || pres.length}
                        <span style={{ width: 120 }}>
                          <Bar value={pres.length} max={conv.length || pres.length || 1} />
                        </span>
                      </div>
                      <div className="row">
                        <button className="btn sm" onClick={() => openEditor('treinoInterno', t.id)}>
                          <Icon name="edit" size={14} /> Lista de presença
                        </button>
                        {t.material != null && t.material !== '' && (
                          <a className="btn sm" href={String(t.material)} target="_blank" rel="noreferrer">
                            <Icon name="link" size={14} /> Material
                          </a>
                        )}
                        <button className="btn sm gold" disabled={!pres.length} onClick={() => setCert(t)}>
                          <Icon name="print" size={14} /> Certificados (PDF)
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ),
          },
        ]}
        defaultView="presenca"
      />
      {cert && <Certificados t={cert} onClose={() => setCert(null)} />}
    </>
  )
}

function Certificados({ t, onClose }: { t: Item; onClose: () => void }) {
  const pres = ((t.presentes as string[]) ?? []).map((id) => get('pessoas', id)).filter(Boolean) as Item[]
  const instrutor = label('pessoas', get('pessoas', t.instrutor as string))
  return (
    <div className="overlay" style={{ background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 1040 }} className="stack">
        <div className="row">
          <h2 className="grow">Certificados — {String(t.tema)}</h2>
          <span className="small muted">Na janela de impressão, escolha “Salvar como PDF” (A4 paisagem).</span>
          <button className="btn primary" onClick={() => window.print()}>
            <Icon name="print" size={15} /> Imprimir / salvar PDF
          </button>
          <button className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="print-area stack">
          {pres.map((p) => (
            <div key={p.id} className="cert">
              <span style={{ letterSpacing: 4, fontSize: 13, textTransform: 'uppercase', color: '#b48a1c' }}>Treinamento interno · Controladoria</span>
              <h1>CERTIFICADO</h1>
              <span>Certificamos que</span>
              <span className="nome">{String(p.nome)}</span>
              <span style={{ maxWidth: 680, fontSize: 17 }}>
                participou do treinamento <b>“{String(t.tema)}”</b>, ministrado por {instrutor}, em {fmtDate(t.data)}, com carga horária de {String(t.cargaHoraria ?? '—')} hora(s).
              </span>
              <div style={{ display: 'flex', gap: 120, marginTop: 50 }}>
                <span style={{ borderTop: '1px solid #14254a', paddingTop: 6, minWidth: 220 }}>{instrutor}<br /><small>Instrutor</small></span>
                <span style={{ borderTop: '1px solid #14254a', paddingTop: 6, minWidth: 220 }}>Gestor da área<br /><small>Controladoria</small></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
