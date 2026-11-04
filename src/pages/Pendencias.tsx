import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { openEditor } from '../components/ItemForm'
import { Chip, Kpi, PageHead, Seg, useLocalState } from '../components/ui'
import { upsert, useDB } from '../data/store'
import { fmtDate, label, todayISO } from '../lib/format'
import { isDone } from '../lib/alerts'
import { isAdmin } from '../lib/session'
import { atribuicoes, delegadasPorMim, minhaPessoa, type Atribuicao } from '../lib/workflow'

// Minhas pendências: o que está comigo (em qualquer tela), o que eu deleguei e o que aguarda terceiros.

type Aba = 'mim' | 'deleguei' | 'aguardando'

export function Pendencias() {
  const db = useDB()
  const pessoa = minhaPessoa(db)
  const [aba, setAba] = useLocalState<Aba>('pend:aba', 'mim')
  const minhas = useMemo(() => (pessoa ? atribuicoes(db, pessoa).filter((a) => !a.feito) : []), [db, pessoa])
  const deleguei = useMemo(() => delegadasPorMim(db, pessoa), [db, pessoa])
  const aguardando = useMemo(() => (pessoa ? (db.tarefas ?? []).filter((t) => t.responsavel === pessoa && (/aguardando/i.test(String(t.status ?? '')) || (!!t.aguardandoPessoa && t.aguardandoPessoa !== pessoa && !isDone('tarefas', t)))) : []), [db, pessoa])
  const hoje = todayISO()
  const atrasadas = minhas.filter((a) => a.prazo && a.prazo < hoje).length
  const aceitar = minhas.filter((a) => a.col === 'tarefas' && String(a.item.delegacao ?? '') === 'Delegada – pendente' && !a.etapa)

  if (!pessoa)
    return (
      <>
        <PageHead title="Minhas pendências" desc="Tudo o que está com você em qualquer tela: tarefas, aprovações, planos de ação, obrigações, contratos e mais." />
        <div className="card stack">
          <b>Seu usuário ainda não está ligado a uma pessoa do Time.</b>
          <span className="muted">
            Para o sistema saber o que é seu, o administrador precisa abrir <b>Sistema → Usuários</b>, editar o seu usuário e escolher a sua pessoa no campo “Pessoa do time”.
          </span>
          {isAdmin() && (
            <Link className="btn primary" to="/usuarios" style={{ justifySelf: 'start' }}>
              Abrir Usuários
            </Link>
          )}
        </div>
      </>
    )

  const linha = (a: Atribuicao, acoes?: boolean) => {
    const atrasada = a.prazo && a.prazo < hoje
    const deleg = a.col === 'tarefas' && !a.etapa ? String(a.item.delegacao ?? '') : ''
    return (
      <div key={a.chave} className="pd-item">
        <div className="pd-corpo" onClick={() => openEditor(a.col, a.item.id)}>
          <b>{a.titulo}</b>
          <span className="small muted">
            {a.etapa ? `Etapa de “${a.etapa}”` : a.modulo} · {a.papel}
            {a.quem && aba === 'mim' ? ` · por ${a.quem}` : ''}
          </span>
        </div>
        {a.prazo && <span className={`small ${atrasada ? 'neg' : 'muted'}`}>{fmtDate(a.prazo)}</span>}
        {a.status && <Chip t="muted">{a.status}</Chip>}
        {deleg.startsWith('Delegada') && <Chip t={deleg.includes('recusada') ? 'bad' : deleg.includes('aceita') ? 'ok' : 'warn'}>{deleg.replace('Delegada – ', '')}</Chip>}
        {acoes && deleg === 'Delegada – pendente' && (
          <span className="row" style={{ gap: 4 }}>
            <button className="btn sm primary" onClick={() => upsert('tarefas', { id: a.item.id, delegacao: 'Delegada – aceita' })}>
              Aceitar
            </button>
            <button className="btn sm" onClick={() => upsert('tarefas', { id: a.item.id, delegacao: 'Delegada – recusada' })}>
              Recusar
            </button>
          </span>
        )}
      </div>
    )
  }
  const porModulo = (xs: Atribuicao[], acoes?: boolean) => {
    if (!xs.length) return <div className="empty">Nada por aqui.</div>
    const grupos = [...new Set(xs.map((x) => x.modulo))]
    return grupos.map((g) => (
      <div key={g} className="pd-grupo">
        <div className="small muted pd-titulo">
          {g} ({xs.filter((x) => x.modulo === g).length})
        </div>
        {xs
          .filter((x) => x.modulo === g)
          .sort((a, b) => String(a.prazo ?? '9999').localeCompare(String(b.prazo ?? '9999')))
          .map((x) => linha(x, acoes))}
      </div>
    ))
  }

  return (
    <>
      <PageHead title="Minhas pendências" desc="Tudo o que está com você em qualquer tela (como responsável, aprovador, backup, titular, instrutor ou líder), o que você delegou e o que aguarda terceiros." />
      <div className="grid g4">
        <Kpi l="Com você" v={minhas.length} d={atrasadas ? `${atrasadas} atrasada(s)` : 'nenhuma atrasada'} t={atrasadas ? 'bad' : undefined} />
        <Kpi l="Para aceitar" v={aceitar.length} d="tarefas delegadas a você" t={aceitar.length ? 'warn' : undefined} />
        <Kpi l="Delegadas por você" v={deleguei.length} d={`${deleguei.filter((d) => String(d.item.delegacao ?? '').includes('recusada')).length} recusada(s)`} />
        <Kpi l="Aguardando terceiros" v={aguardando.length} d="suas tarefas paradas em alguém" />
      </div>
      <div className="card stack">
        <Seg
          value={aba}
          onChange={setAba}
          options={[
            { v: 'mim', l: `Para mim (${minhas.length})` },
            { v: 'deleguei', l: `Delegadas por mim (${deleguei.length})` },
            { v: 'aguardando', l: `Aguardando terceiros (${aguardando.length})` },
          ]}
        />
        {aba === 'mim' && porModulo(minhas, true)}
        {aba === 'deleguei' && porModulo(deleguei)}
        {aba === 'aguardando' &&
          (aguardando.length ? (
            aguardando.map((t) => (
              <div key={t.id} className="pd-item">
                <div className="pd-corpo" onClick={() => openEditor('tarefas', t.id)}>
                  <b>{String(t.titulo)}</b>
                  <span className="small muted">Aguardando: {t.aguardandoPessoa ? label('pessoas', (db.pessoas ?? []).find((p) => p.id === t.aguardandoPessoa)) : String(t.aguardando || '—')}</span>
                </div>
                {typeof t.followup === 'string' && t.followup && <span className={`small ${t.followup < hoje ? 'neg' : 'muted'}`}>follow-up {fmtDate(t.followup)}</span>}
              </div>
            ))
          ) : (
            <div className="empty">Nenhuma tarefa sua aguardando terceiros.</div>
          ))}
      </div>
    </>
  )
}
