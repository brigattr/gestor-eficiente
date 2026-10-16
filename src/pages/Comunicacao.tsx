import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { openEditor } from '../components/ItemForm'
import { ModulePage } from '../components/ModulePage'
import { Chip, PageHead } from '../components/ui'
import { get, useDB, type DB } from '../data/store'
import { daysUntil, fmtDate, label, todayISO } from '../lib/format'

const hoje = () => todayISO()

/** Avisos válidos hoje (publicados e não vencidos), fixados primeiro. */
function avisosValidos(db: DB) {
  return (db.avisos ?? [])
    .filter((a) => (!a.publicadoEm || String(a.publicadoEm) <= hoje()) && (!a.validoAte || String(a.validoAte) >= hoje()))
    .sort((a, b) => Number(!!b.fixado) - Number(!!a.fixado) || String(b.publicadoEm ?? b._created ?? '').localeCompare(String(a.publicadoEm ?? a._created ?? '')))
}

/** Aniversariantes do mês (dia/mês da data de nascimento). */
function aniversariantes(db: DB) {
  const m = new Date().getMonth() + 1
  return (db.pessoas ?? [])
    .filter((p) => p.nascimento && !/deslig/i.test(String(p.status ?? '')) && Number(String(p.nascimento).slice(5, 7)) === m)
    .sort((a, b) => String(a.nascimento).slice(8).localeCompare(String(b.nascimento).slice(8)))
}

function reconhecimentosRecentes(db: DB, dias = 30) {
  return (db.reconhecimentos ?? [])
    .filter((r) => r.publico !== false && (daysUntil(r.data ?? String(r._created ?? '').slice(0, 10)) ?? -999) >= -dias)
    .sort((a, b) => String(b.data ?? b._created ?? '').localeCompare(String(a.data ?? a._created ?? '')))
}

const corTipo: Record<string, string> = { Aviso: 'info', 'Meta do mês': 'gold', Campanha: 'warn', Conquista: 'ok', Evento: 'info', Lembrete: 'muted' }

export function Mural() {
  const db = useDB()
  const avisos = avisosValidos(db)
  const anivs = aniversariantes(db)
  const recs = reconhecimentosRecentes(db)
  return (
    <>
      <PageHead title="Mural" desc="Avisos da área, metas do mês, campanhas, aniversariantes e reconhecimentos. Use o modo TV para deixar passando numa tela.">
        <Link className="btn" to="/tv">
          <Icon name="presentation" size={15} /> Modo TV
        </Link>
        <button className="btn primary" onClick={() => openEditor('avisos', undefined, { publicadoEm: hoje() })}>
          <Icon name="plus" size={15} /> Novo aviso
        </button>
      </PageHead>
      <div className="mural">
        <div className="stack">
          {avisos.length === 0 && <div className="card empty">Nenhum aviso válido hoje.</div>}
          {avisos.map((a) => (
            <div key={a.id} className={`card stack aviso ${a.fixado ? 'fixado' : ''}`} onClick={() => openEditor('avisos', a.id)}>
              <div className="row">
                <Chip t={corTipo[String(a.tipo)] ?? 'info'}>{String(a.tipo ?? 'Aviso')}</Chip>
                {a.fixado ? <span className="small muted">📌 fixado</span> : null}
                <span className="grow" />
                <span className="small muted">{fmtDate(a.publicadoEm ?? String(a._created ?? '').slice(0, 10))}</span>
              </div>
              <h2>{String(a.titulo)}</h2>
              {a.texto ? <p className="aviso-texto">{String(a.texto)}</p> : null}
              {a.validoAte ? <span className="small muted">até {fmtDate(a.validoAte)}</span> : null}
            </div>
          ))}
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2 className="grow">🎂 Aniversariantes do mês</h2>
            </div>
            {anivs.length === 0 ? (
              <span className="small muted">Ninguém neste mês (ou datas não cadastradas no Time).</span>
            ) : (
              <div className="list">
                {anivs.map((p) => (
                  <div key={p.id}>
                    <b style={{ width: 44 }}>{String(p.nascimento).slice(8, 10)}/{String(p.nascimento).slice(5, 7)}</b>
                    <span className="grow">{String(p.nome)}</span>
                    {String(p.nascimento).slice(5) === hoje().slice(5) && <Chip t="gold">hoje!</Chip>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-head">
              <h2 className="grow">🏆 Reconhecimentos recentes</h2>
              <Link className="small" to="/reconhecimentos">
                todos →
              </Link>
            </div>
            {recs.length === 0 ? (
              <span className="small muted">Nenhum nos últimos 30 dias.</span>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {recs.slice(0, 6).map((r) => (
                  <div key={r.id} className="stack" style={{ gap: 2 }}>
                    <span>
                      <b>{label('pessoas', get('pessoas', String(r.para)))}</b> {r.valor ? <Chip t="ok">{String(r.valor)}</Chip> : null}
                    </span>
                    <span className="small">“{String(r.mensagem)}”</span>
                    <span className="small muted">
                      {r.de ? String(r.de) : String(r._createdBy ?? '')} · {fmtDate(r.data ?? String(r._created ?? '').slice(0, 10))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <ModulePage col="avisos" embedded />
    </>
  )
}

export function Reconhecimentos() {
  return (
    <ModulePage
      col="reconhecimentos"
      above={(rows) => {
        const ano = new Date().getFullYear()
        const doAno = rows.filter((r) => String(r.data ?? r._created ?? '').startsWith(String(ano)))
        const ranking = new Map<string, number>()
        for (const r of doAno) ranking.set(String(r.para), (ranking.get(String(r.para)) ?? 0) + 1)
        const porValor = new Map<string, number>()
        for (const r of doAno) if (r.valor) porValor.set(String(r.valor), (porValor.get(String(r.valor)) ?? 0) + 1)
        return doAno.length ? (
          <div className="grid g2" style={{ alignItems: 'start' }}>
            <div className="card">
              <div className="card-head">
                <h2 className="grow">Mais reconhecidos em {ano}</h2>
              </div>
              <div className="list">
                {[...ranking.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([id, n], i) => (
                    <div key={id}>
                      <b style={{ width: 22 }}>{i + 1}º</b>
                      <span className="grow">{label('pessoas', get('pessoas', id))}</span>
                      <span>{'🏆'.repeat(Math.min(n, 5))}</span>
                      <b>{n}</b>
                    </div>
                  ))}
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h2 className="grow">Valores mais lembrados</h2>
              </div>
              <div className="list">
                {[...porValor.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([v, n]) => (
                    <div key={v}>
                      <span className="grow">{v}</span>
                      <b>{n}</b>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : null
      }}
    />
  )
}

// ───────────────────────── Modo TV: slides que giram sozinhos (tela cheia)
export function ModoTV() {
  const db = useDB()
  const [i, setI] = useState(0)
  const [, tick] = useState(0)
  const slides: { titulo: string; corpo: React.ReactNode; tipo: string }[] = []
  for (const a of avisosValidos(db)) slides.push({ tipo: String(a.tipo ?? 'Aviso'), titulo: String(a.titulo), corpo: a.texto ? <p>{String(a.texto)}</p> : null })
  const anivs = aniversariantes(db)
  if (anivs.length)
    slides.push({
      tipo: 'Aniversariantes',
      titulo: '🎂 Aniversariantes do mês',
      corpo: (
        <ul>
          {anivs.map((p) => (
            <li key={p.id}>
              {String(p.nascimento).slice(8, 10)}/{String(p.nascimento).slice(5, 7)} — {String(p.nome)}
            </li>
          ))}
        </ul>
      ),
    })
  for (const r of reconhecimentosRecentes(db, 14).slice(0, 5))
    slides.push({ tipo: 'Reconhecimento', titulo: `🏆 ${label('pessoas', get('pessoas', String(r.para)))}`, corpo: <p>“{String(r.mensagem)}”{r.valor ? <><br /><small>{String(r.valor)}</small></> : null}</p> })
  if (!slides.length) slides.push({ tipo: 'Mural', titulo: 'Nada no mural agora', corpo: <p>Cadastre avisos em Comunicação › Mural.</p> })

  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), 10000)
    const r = setInterval(() => tick((x) => x + 1), 60000) // relógio
    return () => (clearInterval(t), clearInterval(r))
  }, [])
  const s = slides[i % slides.length]
  return (
    <div className="tv">
      <div className="tv-topo">
        <span>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
        <span className="tv-hora">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        <Link to="/mural" className="tv-sair" title="Sair do modo TV">
          ✕
        </Link>
      </div>
      <div className="tv-slide" key={i}>
        <span className="tv-tipo">{s.tipo}</span>
        <h1>{s.titulo}</h1>
        <div className="tv-corpo">{s.corpo}</div>
      </div>
      <div className="tv-pontos">
        {slides.map((_, k) => (
          <span key={k} className={k === i % slides.length ? 'on' : ''} onClick={() => setI(k)} />
        ))}
      </div>
    </div>
  )
}

