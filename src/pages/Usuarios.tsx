import { useState } from 'react'
import { confirmar, avisar } from '../components/Dialogs'
import { Icon } from '../components/Icon'
import { Chip, Modal, PageHead } from '../components/ui'
import { get, useDB, type Item } from '../data/store'
import { minutosBloqueio, removerUsuario, salvarUsuario, setMinutosBloqueio } from '../lib/auth'
import { servidor } from '../lib/api'
import { getUser, isAdmin, type Papel } from '../lib/session'
import { label } from '../lib/format'

const PAPEIS: { p: Papel; d: string }[] = [
  { p: 'Administrador', d: 'Tudo, inclusive usuários, backup e restauração' },
  { p: 'Gestor', d: 'Cria e edita registros e anexos; não gerencia usuários' },
  { p: 'Leitura', d: 'Consulta tudo, sem editar' },
]

export function Usuarios() {
  const db = useDB()
  const [edit, setEdit] = useState<Partial<Item> | null>(null)
  const [lock, setLock] = useState(minutosBloqueio())
  const eu = getUser()
  const admin = isAdmin()
  const users = db.usuarios ?? []
  return (
    <>
      <PageHead title="Usuários e acesso" desc="Cadastro de quem pode entrar no sistema, com perfis de acesso. Cada registro guarda quem criou e quem alterou por último.">
        {admin && (
          <button className="btn primary" onClick={() => setEdit({ papel: 'Gestor', ativo: true })}>
            <Icon name="plus" size={16} /> Novo usuário
          </button>
        )}
        {!admin && eu && (
          <button className="btn" onClick={() => setEdit(get('usuarios', eu.id) ?? null)}>
            Alterar minha senha
          </button>
        )}
      </PageHead>
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Colaborador vinculado</th>
                <th>Último acesso</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={admin || u.id === eu?.id ? 'click' : ''} onClick={() => (admin || u.id === eu?.id) && setEdit(u)}>
                  <td>
                    {String(u.nome)} {u.id === eu?.id && <Chip t="gold">você</Chip>}
                  </td>
                  <td>{String(u.login ?? '')}</td>
                  <td>{String(u.email ?? '')}</td>
                  <td>
                    <Chip t={u.papel === 'Administrador' ? 'info' : u.papel === 'Leitura' ? 'muted' : 'ok'}>{String(u.papel)}</Chip>
                  </td>
                  <td>{u.pessoa ? label('pessoas', get('pessoas', u.pessoa as string)) : '—'}</td>
                  <td className="small muted">{u.ultimoAcesso ? new Date(String(u.ultimoAcesso)).toLocaleString('pt-BR') : '—'}</td>
                  <td>{u.ativo === false ? <Chip t="bad">Inativo</Chip> : <Chip t="ok">Ativo</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid g2">
        <div className="card stack" style={{ gap: 8 }}>
          <h2>Perfis</h2>
          {PAPEIS.map((p) => (
            <div key={p.p} className="small">
              <b>{p.p}:</b> {p.d}
            </div>
          ))}
        </div>
        <div className="card stack" style={{ gap: 8 }}>
          <h2>Bloqueio automático</h2>
          <span className="small muted">Sai do sistema após um período sem uso. Útil no computador do escritório.</span>
          <select
            id="lock-min"
            value={lock}
            style={{ maxWidth: 220 }}
            onChange={(e) => {
              const m = Number(e.target.value)
              setLock(m)
              setMinutosBloqueio(m)
              avisar('Bloqueio automático atualizado. Vale a partir do próximo login.')
            }}
          >
            {[5, 15, 30, 60, 120, 0].map((m) => (
              <option key={m} value={m}>
                {m ? `${m} minutos sem uso` : 'Nunca bloquear'}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="card small muted">
        {servidor()
          ? 'Usuários, senhas e sessões ficam no servidor (Cloudflare). Cada pessoa entra de qualquer computador com o próprio login; após 5 senhas erradas o acesso fica bloqueado por 15 minutos.'
          : 'Modo local: usuários e dados ficam neste navegador. Publicado no Cloudflare com o banco configurado, o cadastro passa a valer em qualquer computador.'}
      </div>
      {edit && <UserForm u={edit} admin={admin} onClose={() => setEdit(null)} />}
    </>
  )
}

function UserForm({ u, admin, onClose }: { u: Partial<Item>; admin: boolean; onClose: () => void }) {
  const db = useDB()
  const [v, setV] = useState<Partial<Item>>(u)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const novo = !u.id
  const eu = getUser()
  const set = (k: string, x: unknown) => setV({ ...v, [k]: x })
  const admins = (db.usuarios ?? []).filter((x) => x.papel === 'Administrador' && x.ativo !== false)

  async function salvar() {
    if (!String(v.nome ?? '').trim() || !String(v.login ?? '').trim()) return setErro('Informe nome e usuário.')
    const dup = (db.usuarios ?? []).find((x) => x.id !== v.id && String(x.login).toLowerCase() === String(v.login).toLowerCase())
    if (dup) return setErro('Já existe um usuário com esse login.')
    if (novo && senha.length < 8) return setErro('Defina uma senha com pelo menos 8 caracteres.')
    if (senha && senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    const tirandoUltimoAdmin = u.papel === 'Administrador' && (v.papel !== 'Administrador' || v.ativo === false) && admins.length <= 1
    if (tirandoUltimoAdmin) return setErro('Precisa existir pelo menos um administrador ativo.')
    const dados: Partial<Item> & { senha?: string } = admin ? { ...v, senha: senha || undefined } : { id: v.id, nome: v.nome, email: v.email, senha: senha || undefined }
    let r: Item | undefined
    try {
      r = await salvarUsuario(dados)
    } catch (e) {
      return setErro((e as Error).message)
    }
    if (r) {
      avisar(novo ? 'Usuário criado.' : 'Usuário atualizado.')
      onClose()
    }
  }

  return (
    <Modal
      title={novo ? 'Novo usuário' : `Usuário: ${String(u.nome)}`}
      onClose={onClose}
      foot={
        <>
          {admin && !novo && u.id !== eu?.id && (
            <button
              className="btn danger"
              onClick={async () => {
                if (await confirmar(`Excluir o usuário ${String(u.nome)}? Os registros criados por ele continuam no sistema.`, { ok: 'Excluir', danger: true })) {
                  try {
                    await removerUsuario(String(u.id))
                    onClose()
                  } catch (e) {
                    setErro((e as Error).message)
                  }
                }
              }}
            >
              <Icon name="trash" size={15} /> Excluir
            </button>
          )}
          <span className="grow small" style={{ color: 'var(--bad)' }}>
            {erro}
          </span>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={salvar}>
            Salvar
          </button>
        </>
      }
    >
      <div className="modal-body">
        <label className="field">
          <span>Nome *</span>
          <input id="u-nome" value={String(v.nome ?? '')} onChange={(e) => set('nome', e.target.value)} />
        </label>
        <label className="field">
          <span>Usuário (login) *</span>
          <input id="u-login" value={String(v.login ?? '')} disabled={!admin} onChange={(e) => set('login', e.target.value.trim())} />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input id="u-email" type="email" value={String(v.email ?? '')} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label className="field">
          <span>{novo ? 'Senha *' : 'Nova senha (deixe vazio para manter)'}</span>
          <input id="u-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
        </label>
        {admin && (
          <>
            <label className="field">
              <span>Perfil</span>
              <select id="u-papel" value={String(v.papel ?? 'Gestor')} onChange={(e) => set('papel', e.target.value)}>
                {PAPEIS.map((p) => (
                  <option key={p.p}>{p.p}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Colaborador vinculado (opcional)</span>
              <select id="u-pessoa" value={String(v.pessoa ?? '')} onChange={(e) => set('pessoa', e.target.value || null)}>
                <option value="">—</option>
                {(db.pessoas ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {String(p.nome)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field wide row">
              <input type="checkbox" checked={v.ativo !== false} onChange={(e) => set('ativo', e.target.checked)} />
              <span>Usuário ativo (pode entrar)</span>
            </label>
          </>
        )}
      </div>
    </Modal>
  )
}
