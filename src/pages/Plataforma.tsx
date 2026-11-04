import { useEffect, useState } from 'react'
import { avisar } from '../components/Dialogs'
import { Icon } from '../components/Icon'
import { Chip, Kpi, Modal, PageHead } from '../components/ui'
import { api, servidor } from '../lib/api'
import { fmtDate } from '../lib/format'
import { ETIQUETAS, FIXOS } from '../lib/menu'
import { useUser } from './Login'
import { NAV } from '../nav'

// Painel do dono da plataforma: as contas dos clientes (Individual ou Empresa),
// o que cada uma pode usar e quem é o administrador de cada uma.

type ContaP = {
  id: string
  nome: string
  plano: 'individual' | 'empresa'
  modulos: string[] | null
  ativo: number
  opcoes: { gestorVeEquipe?: boolean }
  criadaEm: string
  usuarios: number
  ultimoAcesso: string | null
  admins: string[]
  registros: number
  minha: boolean
}

const GRUPOS = NAV.map((g) => ({
  group: g.group,
  items: [...g.items, ...(g.group === 'Visão' ? [{ path: ETIQUETAS, label: 'Etiquetas', icon: 'tag' }] : [])].filter((i) => !FIXOS.has(i.path)),
})).filter((g) => g.items.length)
const TODOS = GRUPOS.flatMap((g) => g.items.map((i) => i.path))

export function Plataforma() {
  const user = useUser()
  const [contas, setContas] = useState<ContaP[] | null>(null)
  const [edit, setEdit] = useState<Partial<ContaP> | null>(null)
  const [criada, setCriada] = useState<{ nome: string; login: string; codigo: string } | null>(null)
  const carregar = () =>
    api<{ contas: ContaP[] }>('/plataforma/contas')
      .then((r) => setContas(r.contas))
      .catch((e) => avisar((e as Error).message))
  useEffect(() => {
    if (user?.plataforma) void carregar()
  }, [user?.plataforma])

  if (!servidor() || !user?.plataforma)
    return (
      <>
        <PageHead title="Plataforma (contas)" />
        <div className="card">Somente o dono da plataforma acessa esta tela.</div>
      </>
    )
  const ativas = (contas ?? []).filter((c) => c.ativo)
  return (
    <>
      <PageHead title="Plataforma (contas)" desc="As contas dos seus clientes: cada uma tem os próprios dados, usuários e ferramentas. Você escolhe o plano e o que cada conta pode usar.">
        <button className="btn primary" onClick={() => setEdit({ plano: 'empresa', modulos: null })}>
          <Icon name="plus" size={16} /> Nova conta
        </button>
      </PageHead>
      <div className="grid g4">
        <Kpi l="Contas ativas" v={ativas.length} d={`${(contas ?? []).length - ativas.length} desativada(s)`} />
        <Kpi l="Empresa" v={ativas.filter((c) => c.plano === 'empresa').length} d="equipes com delegação" />
        <Kpi l="Individual" v={ativas.filter((c) => c.plano === 'individual').length} d="gestor organizando a própria rotina" />
        <Kpi l="Usuários" v={ativas.reduce((a, c) => a + c.usuarios, 0)} d="em todas as contas ativas" />
      </div>
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Conta</th>
                <th>Plano</th>
                <th>Ferramentas</th>
                <th>Administrador</th>
                <th>Usuários</th>
                <th>Registros</th>
                <th>Último acesso</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {(contas ?? []).map((c) => (
                <tr key={c.id} className="click" onClick={() => setEdit(c)}>
                  <td>
                    <b>{c.nome}</b>
                    {c.minha && <span className="small muted"> · a sua</span>}
                  </td>
                  <td>
                    <Chip t={c.plano === 'empresa' ? 'info' : 'ok'}>{c.plano === 'empresa' ? 'Empresa' : 'Individual'}</Chip>
                  </td>
                  <td className="small">{c.modulos ? `${c.modulos.filter((p) => TODOS.includes(p)).length} de ${TODOS.length}` : 'Todas'}</td>
                  <td className="small">{c.admins.join(', ') || '—'}</td>
                  <td>{c.usuarios}</td>
                  <td>{c.registros}</td>
                  <td className="small">{c.ultimoAcesso ? fmtDate(c.ultimoAcesso.slice(0, 10)) : '—'}</td>
                  <td>{c.ativo ? <Chip t="ok">Ativa</Chip> : <Chip t="muted">Desativada</Chip>}</td>
                </tr>
              ))}
              {contas && !contas.length && (
                <tr>
                  <td colSpan={8} className="empty">
                    Nenhuma conta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {edit && (
        <EditarConta
          c={edit}
          onClose={() => setEdit(null)}
          onSalvo={(nova) => {
            setEdit(null)
            if (nova) setCriada(nova)
            void carregar()
          }}
        />
      )}
      {criada && (
        <Modal
          title="Conta criada"
          onClose={() => setCriada(null)}
          foot={
            <button className="btn primary" onClick={() => setCriada(null)}>
              Anotei
            </button>
          }
        >
          <div className="stack">
            <span>
              A conta <b>{criada.nome}</b> está pronta e começa vazia. Passe ao administrador o endereço do sistema, o usuário <b>{criada.login}</b> e a senha que você definiu.
            </span>
            <span>Código de recuperação (para ele trocar a senha se esquecer — aparece só agora):</span>
            <code style={{ fontSize: 18, padding: 10, background: 'var(--surface-2)', borderRadius: 8, textAlign: 'center' }}>{criada.codigo}</code>
            <span className="small muted">Ao entrar, o administrador cadastra as pessoas do Time e os usuários da equipe em Sistema → Usuários (ligando cada usuário à sua pessoa).</span>
          </div>
        </Modal>
      )}
    </>
  )
}

function EditarConta({ c, onClose, onSalvo }: { c: Partial<ContaP>; onClose: () => void; onSalvo: (nova?: { nome: string; login: string; codigo: string }) => void }) {
  const nova = !c.id
  const [v, setV] = useState({ nome: c.nome ?? '', plano: c.plano ?? 'empresa', ativo: c.ativo == null ? true : !!c.ativo, gestorVeEquipe: !!c.opcoes?.gestorVeEquipe })
  const [mods, setMods] = useState<Set<string>>(() => new Set(c.modulos ?? TODOS))
  const [adm, setAdm] = useState({ nome: '', login: '', email: '', senha: '' })
  const [busy, setBusy] = useState(false)
  const alternar = (ps: string[], on: boolean) =>
    setMods((s) => {
      const n = new Set(s)
      for (const p of ps) {
        if (on) n.add(p)
        else n.delete(p)
      }
      return n
    })
  async function salvar() {
    const modulos = TODOS.every((p) => mods.has(p)) ? null : TODOS.filter((p) => mods.has(p))
    setBusy(true)
    try {
      if (nova) {
        const r = await api<{ codigo: string }>('/plataforma/contas', { body: { nome: v.nome, plano: v.plano, modulos, admin: adm } })
        onSalvo({ nome: v.nome, login: adm.login, codigo: r.codigo })
      } else {
        await api(`/plataforma/contas/${c.id}`, { method: 'PUT', body: { nome: v.nome, plano: v.plano, modulos, ativo: v.ativo, opcoes: { gestorVeEquipe: v.gestorVeEquipe } } })
        onSalvo()
      }
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      wide
      title={nova ? 'Nova conta' : `Conta: ${c.nome}`}
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <span className="grow" />
          <button className="btn primary" disabled={busy || !v.nome.trim()} onClick={() => void salvar()}>
            {nova ? 'Criar conta' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="modal-body">
        <label className="field">
          <span>Nome da conta *</span>
          <input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} placeholder="Ex.: Empresa X ou nome do gestor" />
        </label>
        <label className="field">
          <span>Plano</span>
          <select value={v.plano} onChange={(e) => setV({ ...v, plano: e.target.value as 'empresa' | 'individual' })}>
            <option value="empresa">Empresa — equipe com delegação, cada um com a própria visão</option>
            <option value="individual">Individual — um gestor organizando a própria rotina</option>
          </select>
        </label>
        {!nova && (
          <label className="field">
            <span>Situação</span>
            <select value={v.ativo ? '1' : '0'} disabled={c.minha} onChange={(e) => setV({ ...v, ativo: e.target.value === '1' })}>
              <option value="1">Ativa</option>
              <option value="0">Desativada (ninguém da conta entra; os dados ficam guardados)</option>
            </select>
          </label>
        )}
        {!nova && v.plano === 'empresa' && (
          <label className="field">
            <span>Gestor vê tudo da equipe</span>
            <select value={v.gestorVeEquipe ? '1' : '0'} onChange={(e) => setV({ ...v, gestorVeEquipe: e.target.value === '1' })}>
              <option value="0">Não — cada um vê o que é seu, delegado ou compartilhado</option>
              <option value="1">Sim — o gestor imediato vê os registros pessoais dos subordinados</option>
            </select>
          </label>
        )}
        {nova && (
          <>
            <div className="field wide" style={{ display: 'grid', gap: 2, marginTop: 6 }}>
              <b>Administrador da conta</b>
              <span className="small muted">Quem vai cadastrar a equipe e configurar a conta. O login vale para a plataforma inteira (não pode repetir).</span>
            </div>
            <label className="field">
              <span>Nome *</span>
              <input value={adm.nome} onChange={(e) => setAdm({ ...adm, nome: e.target.value })} />
            </label>
            <label className="field">
              <span>Usuário (login) *</span>
              <input value={adm.login} autoCapitalize="none" onChange={(e) => setAdm({ ...adm, login: e.target.value })} />
            </label>
            <label className="field">
              <span>E-mail</span>
              <input type="email" value={adm.email} onChange={(e) => setAdm({ ...adm, email: e.target.value })} />
            </label>
            <label className="field">
              <span>Senha inicial * (mín. 8)</span>
              <input type="password" autoComplete="new-password" value={adm.senha} onChange={(e) => setAdm({ ...adm, senha: e.target.value })} />
            </label>
          </>
        )}
        <div className="field wide">
          <div className="row">
            <b className="grow">Ferramentas liberadas</b>
            <span className="small muted">
              {TODOS.filter((p) => mods.has(p)).length} de {TODOS.length}
            </span>
            <button type="button" className="btn sm" onClick={() => alternar(TODOS, true)}>
              Todas
            </button>
            <button type="button" className="btn sm" onClick={() => alternar(TODOS, false)}>
              Nenhuma
            </button>
          </div>
          <span className="small muted">O que ficar desmarcado não aparece para a conta. Painel, Usuários e Configurações sempre ficam. O administrador da conta ainda pode esconder mais itens no menu dele.</span>
          <div className="menu-cfg" style={{ marginTop: 8 }}>
            {GRUPOS.map((g) => {
              const ps = g.items.map((i) => i.path)
              const n = ps.filter((p) => mods.has(p)).length
              return (
                <div key={g.group} className="menu-cfg-grupo">
                  <label className="row menu-cfg-titulo">
                    <input
                      type="checkbox"
                      checked={n > 0}
                      ref={(el) => {
                        if (el) el.indeterminate = n > 0 && n < ps.length
                      }}
                      onChange={(e) => alternar(ps, e.target.checked)}
                    />
                    <b className="grow">{g.group}</b>
                    <span className="small muted">
                      {n}/{ps.length}
                    </span>
                  </label>
                  {g.items.map((i) => (
                    <label key={i.path} className="row menu-cfg-item">
                      <input type="checkbox" checked={mods.has(i.path)} onChange={(e) => alternar([i.path], e.target.checked)} />
                      <Icon name={i.icon} size={15} />
                      <span className="grow">{i.label}</span>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
