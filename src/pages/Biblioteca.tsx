import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal, PageHead, useLocalState } from '../components/ui'
import { AGIL, MICROGESTAO, TABELA, TIME_NOVO, type Conceito } from '../data/content'

export function Biblioteca() {
  const [aba, setAba] = useLocalState('bib:aba', 'tabela')
  const [sel, setSel] = useState<Conceito | null>(null)
  return (
    <>
      <PageHead title="Biblioteca de gestão" desc="Referências para consultar no dia a dia, ligadas aos módulos onde cada conceito é aplicado." />
      <div className="tabs">
        {[
          ['tabela', 'Tabela periódica da gestão'],
          ['agil', 'Gestão ágil: 6 peças'],
          ['time', 'Liderando um time novo'],
          ['micro', 'Gestão × microgestão'],
        ].map(([k, l]) => (
          <button key={k} className={aba === k ? 'on' : ''} onClick={() => setAba(k)}>
            {l}
          </button>
        ))}
      </div>

      {aba === 'tabela' && (
        <div className="ptable">
          {TABELA.map((g) => (
            <div key={g.grupo} style={{ display: 'contents' }}>
              <div className="pgroup">{g.grupo}</div>
              {g.itens.map((c) => (
                <div key={c.sigla} className="pel" onClick={() => setSel(c)}>
                  <b>{c.sigla}</b>
                  <span className="small">{c.nome}</span>
                  {c.modulo && <span className="chip gold small" style={{ justifySelf: 'start' }}>no sistema</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {aba === 'agil' && (
        <>
          <div className="card">
            <h2>Seis peças. Um sistema. E uma ordem certa de aplicar.</h2>
            <p className="muted small">Scrum, Kanban, OKR, Design Thinking, Cultura Lean e Liderança Antifrágil, e onde cada uma aparece aqui.</p>
          </div>
          <div className="grid g3">
            {AGIL.map((a, i) => (
              <div key={a.nome} className="card stack" style={{ gap: 6, borderTop: '3px solid var(--accent)' }}>
                <span className="muted small">Peça {i + 1}</span>
                <h2>{a.nome}</h2>
                <i>“{a.frase}”</i>
                <span className="small">
                  <b>No Gestor Eficiente:</b> {a.aqui}
                </span>
              </div>
            ))}
          </div>
          <a className="small" href="https://lp.mindmaster.com.br/webinars/w143-2/" target="_blank" rel="noreferrer">
            Fonte: MindMaster – Gestão Ágil →
          </a>
        </>
      )}

      {aba === 'time' && (
        <div className="grid g3">
          {TIME_NOVO.map((t, i) => (
            <div key={t.titulo} className="card stack" style={{ gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>{i + 1}</span>
              <h2>{t.titulo}</h2>
              <span className="small">{t.texto}</span>
            </div>
          ))}
        </div>
      )}

      {aba === 'micro' && (
        <div className="card flush">
          <table>
            <thead>
              <tr>
                <th style={{ color: 'var(--bad)' }}>✗ Microgestão (controle)</th>
                <th style={{ color: 'var(--ok)' }}>✓ Gestão (confiança)</th>
              </tr>
            </thead>
            <tbody>
              {MICROGESTAO.map(([a, b]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ textAlign: 'center' }}>
                  Gestão é confiança com direção. Microgestão é controle com ansiedade.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {sel && (
        <Modal title={`${sel.sigla} — ${sel.nome}`} onClose={() => setSel(null)}>
          <div className="modal-body" style={{ display: 'block' }}>
            <p>{sel.resumo}</p>
            <p>
              <b>Como usar:</b> {sel.uso}
            </p>
            {sel.modulo && (
              <Link className="btn primary" to={'/' + sel.modulo} onClick={() => setSel(null)}>
                Abrir no sistema →
              </Link>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
