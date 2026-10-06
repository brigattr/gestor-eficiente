import { confirmar } from './Dialogs'
import { useState, useSyncExternalStore } from 'react'
import { CORES_ETIQUETA, MOD, type Field } from '../data/schema'
import { get, getDB, list, remove, uid, upsert, type Item } from '../data/store'
import { bonus } from '../lib/incentive'
import { deleteFilesOf } from '../lib/files'
import { Attachments } from './Attachments'
import { corEtiqueta } from './Tags'
import { label, pct } from '../lib/format'
import { Icon } from './Icon'
import { Modal } from './ui'

// ── Editor global: qualquer tela pode abrir um registro de qualquer módulo
type EditorState = { col: string; id?: string; preset?: Record<string, unknown> } | null
let editor: EditorState = null
const subs = new Set<() => void>()
export function openEditor(col: string, id?: string, preset?: Record<string, unknown>) {
  editor = { col, id, preset }
  subs.forEach((s) => s())
}
function closeEditor() {
  editor = null
  subs.forEach((s) => s())
}
export function EditorHost() {
  const e = useSyncExternalStore(
    (l) => {
      subs.add(l)
      return () => subs.delete(l)
    },
    () => editor,
  )
  if (!e) return null
  return <ItemForm key={`${e.col}:${e.id ?? 'novo'}`} col={e.col} id={e.id} preset={e.preset} onClose={closeEditor} />
}

function initial(fields: Field[], item: Item | undefined, preset?: Record<string, unknown>) {
  if (item) return { ...item }
  const o: Record<string, unknown> = {}
  for (const f of fields) if (f.default !== undefined) o[f.key] = f.default
  return { ...o, ...preset }
}

function ItemForm({ col, id, preset, onClose }: { col: string; id?: string; preset?: Record<string, unknown>; onClose: () => void }) {
  const m = MOD[col]
  const existing = get(col, id)
  const [v, setV] = useState<Record<string, unknown>>(() => initial(m.fields, existing, preset))
  const [err, setErr] = useState<string | null>(null)
  // id definido já na abertura: anexos de um registro novo ficam vinculados a ele
  const [itemId] = useState(() => existing?.id ?? uid())
  const set = (k: string, val: unknown) => setV((s) => ({ ...s, [k]: val }))
  const cancel = () => {
    if (!existing) void deleteFilesOf(col, itemId) // descarta anexos de um registro não salvo
    onClose()
  }

  function save() {
    const data = { ...v }
    if (col === 'despesas' && (data.valor == null || data.valor === '') && data.quantidade && data.valorUnit) data.valor = Number(data.quantidade) * Number(data.valorUnit)
    const missing = m.fields.filter((f) => f.required && (data[f.key] == null || data[f.key] === '')).map((f) => f.label)
    if (missing.length) {
      setErr('Preencha: ' + missing.join(', '))
      return
    }
    if (upsert(col, { ...data, id: itemId })) onClose()
  }

  return (
    <Modal
      title={existing ? `${m.singular}: ${label(col, existing)}` : `Novo(a) ${m.singular.toLowerCase()}`}
      onClose={cancel}
      foot={
        <>
          {existing && (
            <button
              className="btn danger"
              onClick={async () => {
                if (await confirmar('Excluir este registro?', { ok: 'Excluir', danger: true })) {
                  remove(col, existing.id)
                  void deleteFilesOf(col, existing.id)
                  onClose()
                }
              }}
            >
              <Icon name="trash" size={15} /> Excluir
            </button>
          )}
          <span className="grow small" style={{ color: 'var(--bad)' }}>
            {err}
          </span>
          {existing?._updated != null && (
            <span className="small muted hide-sm" title={`Criado ${existing._createdBy ? 'por ' + String(existing._createdBy) + ' ' : ''}em ${new Date(String(existing._created)).toLocaleString('pt-BR')}`}>
              Alterado {existing._updatedBy ? `por ${String(existing._updatedBy)} ` : ''}em {new Date(String(existing._updated)).toLocaleDateString('pt-BR')}
            </span>
          )}
          <button className="btn" onClick={cancel}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save}>
            Salvar
          </button>
        </>
      }
    >
      <div className="modal-body">
        {col === 'reunioes' && <ReuniaoTopo v={v} />}
        {camposVisiveis(col, m.fields, v).map((f) => (
          <label key={f.key} className={`field ${f.wide || f.type === 'textarea' || f.type === 'multiref' ? 'wide' : ''}`}>
            <span>
              {f.label}
              {f.required && ' *'}
            </span>
            <Input f={f} value={v[f.key]} onChange={(x) => set(f.key, x)} selfId={existing?.id} />
            {f.help && <span className="help">{f.help}</span>}
          </label>
        ))}
        {col === 'projetos' && <IncentiveLink v={v} />}
        <Attachments col={col} itemId={itemId} />
      </div>
    </Modal>
  )
}

// ── Reuniões: dados do Outlook (somente leitura) separados das suas anotações
const ANOTACOES = ['tipo', 'roteiro', 'pauta', 'materiais', 'preparado', 'decisoes', 'etiquetas']

function camposVisiveis(col: string, fields: Field[], v: Record<string, unknown>) {
  if (col !== 'reunioes') return fields
  const porKey = (ks: string[]) => ks.map((k) => fields.find((f) => f.key === k)).filter(Boolean) as Field[]
  if (v.origem === 'Outlook') return porKey(ANOTACOES)
  // reunião criada aqui: dados básicos editáveis + anotações (sem os campos internos do Outlook)
  return porKey(['titulo', 'data', 'hora', 'horaFim', 'local', 'participantes', ...ANOTACOES])
}

function ReuniaoTopo({ v }: { v: Record<string, unknown> }) {
  if (v.origem !== 'Outlook') return null
  const t = (k: string) => (v[k] == null || v[k] === '' ? null : String(v[k]))
  const data = t('data')
  return (
    <>
      <div className="wide card" style={{ background: 'var(--info-soft)', boxShadow: 'none', display: 'grid', gap: 6 }}>
        <div className="row">
          <Icon name="calendar" />
          <b className="grow">Do Outlook</b>
          {Boolean(v.canceladaOutlook) && <span className="chip bad">cancelada no Outlook</span>}
          <span className="small muted">atualizado automaticamente</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{t('titulo')}</div>
        <div className="small">
          {data ? new Date(data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : ''}
          {t('hora') ? ` · ${t('hora')}${t('horaFim') ? `–${t('horaFim')}` : ''}` : ' · dia inteiro'}
          {t('local') ? ` · ${t('local')}` : ''}
        </div>
        {t('organizador') && <div className="small muted">Organizador: {t('organizador')}</div>}
        {t('participantes') && <div className="small muted">Participantes: {t('participantes')}</div>}
        {t('descricaoOutlook') && (
          <details>
            <summary className="small" style={{ cursor: 'pointer' }}>
              Ver convite
            </summary>
            <div className="small pre" style={{ maxHeight: 200, overflow: 'auto', marginTop: 4 }}>
              {t('descricaoOutlook')}
            </div>
          </details>
        )}
      </div>
      <h3 className="wide" style={{ margin: '4px 0 -4px' }}>
        Minhas anotações
      </h3>
    </>
  )
}

/** Projeto ↔ Incentive Model: mostra os dados da meta vinculada. */
function IncentiveLink({ v }: { v: Record<string, unknown> }) {
  if (!v.noIncentive) return null
  const meta = get('incentivos', v.incentivo as string)
  return (
    <div className="wide card" style={{ background: 'var(--accent-soft)', boxShadow: 'none' }}>
      <div className="row">
        <Icon name="trophy" />
        <b>Vínculo com o Incentive Model</b>
      </div>
      {meta ? (
        <div className="small" style={{ marginTop: 6 }}>
          <b>{String(meta.meta)}</b> — {meta.colaborador ? label('pessoas', get('pessoas', meta.colaborador as string)) : 'minhas metas'} · {String(meta.ano)}
          {meta.pai ? ` · sub-KPI de "${label('incentivos', get('incentivos', meta.pai as string))}"` : ''}
          <br />
          Peso {pct(meta.peso)} · Target {meta.v100 != null ? `${String(meta.v100)} ${String(meta.metrica ?? '')}` : '—'} · Realizado {meta.real != null ? String(meta.real) : '—'}
          <br />
          Bônus pela régua: <b>{pct(Math.round(bonus(getDB(), meta) ?? 0))}</b>
        </div>
      ) : (
        <div className="small" style={{ marginTop: 6 }}>
          Selecione acima a meta do Incentive Model correspondente. Se ainda não existe, crie em Desenvolvimento → Incentive model.
        </div>
      )}
    </div>
  )
}

function Input({ f, value, onChange, selfId }: { f: Field; value: unknown; onChange: (v: unknown) => void; selfId?: string }) {
  const s = value == null ? '' : String(value)
  switch (f.type) {
    case 'textarea':
      return <textarea value={s} onChange={(e) => onChange(e.target.value)} rows={3} />
    case 'number':
    case 'money':
    case 'percent':
      return (
        <input
          type="number"
          step={f.type === 'money' ? '0.01' : 'any'}
          value={s}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={f.type === 'money' ? 'R$' : f.type === 'percent' ? '%' : ''}
        />
      )
    case 'date':
      return <input type="date" value={s} onChange={(e) => onChange(e.target.value || null)} />
    case 'month':
      return <input type="month" value={s} onChange={(e) => onChange(e.target.value || null)} />
    case 'time':
      return <input type="time" value={s} onChange={(e) => onChange(e.target.value || null)} />
    case 'bool':
      return (
        <span className="row">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> <span style={{ fontWeight: 400 }}>{value ? 'Sim' : 'Não'}</span>
        </span>
      )
    case 'url':
      return (
        <span className="row" style={{ flexWrap: 'nowrap' }}>
          <input type="url" value={s} onChange={(e) => onChange(e.target.value)} placeholder="https://… ou caminho do arquivo" />
          {s && (
            <a className="btn sm" href={s} target="_blank" rel="noreferrer">
              <Icon name="link" size={14} />
            </a>
          )}
        </span>
      )
    case 'rating':
      return (
        <span className="row" style={{ gap: 2 }}>
          {[1, 2, 3, 4, 5].map((k) => (
            <button key={k} type="button" className="btn ghost sm" style={{ color: Number(value) >= k ? 'var(--accent)' : 'var(--muted)', fontSize: 18, padding: '0 4px' }} onClick={() => onChange(Number(value) === k ? null : k)}>
              {Number(value) >= k ? '★' : '☆'}
            </button>
          ))}
        </span>
      )
    case 'select':
      return (
        <select value={s} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {f.options!.map((o) => (
            <option key={o} value={o}>
              {f.key === 'mes' ? `${o.padStart(2, '0')}` : o}
            </option>
          ))}
        </select>
      )
    case 'ref': {
      const opts = list(f.ref!).filter((i) => i.id !== selfId)
      return (
        <select value={s} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {opts
            .map((i) => ({ id: i.id, l: label(f.ref!, i) + (f.ref === 'incentivos' ? ` (${i.colaborador ? label('pessoas', get('pessoas', i.colaborador as string)) : 'minhas'}, peso ${pct(i.peso)})` : '') }))
            .sort((a, b) => a.l.localeCompare(b.l))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.l}
              </option>
            ))}
        </select>
      )
    }
    case 'multiref': {
      if (f.ref === 'etiquetas') return <SeletorEtiquetas value={(value as string[]) ?? []} onChange={onChange} />
      const sel = new Set((value as string[]) ?? [])
      return (
        <div className="row" style={{ gap: 6 }}>
          {list(f.ref!).map((i) => (
            <label key={i.id} className={`chip ${sel.has(i.id) ? 'info' : ''}`} style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                style={{ width: 13, height: 13 }}
                checked={sel.has(i.id)}
                onChange={(e) => {
                  const n = new Set(sel)
                  if (e.target.checked) n.add(i.id)
                  else n.delete(i.id)
                  onChange([...n])
                }}
              />
              {label(f.ref!, i)}
            </label>
          ))}
        </div>
      )
    }
    default:
      return <input value={s} onChange={(e) => onChange(e.target.value)} />
  }
}


/** Escolha de etiquetas, com criação rápida de uma nova. */
function SeletorEtiquetas({ value, onChange }: { value: string[]; onChange: (v: unknown) => void }) {
  const [nova, setNova] = useState('')
  const sel = new Set(value)
  const todas = list('etiquetas').filter((t) => !t.arquivada || sel.has(t.id))
  function alternar(id: string) {
    const n = new Set(sel)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    onChange([...n])
  }
  function criar() {
    const nome = nova.trim()
    if (!nome) return
    const existe = list('etiquetas').find((t) => String(t.nome).toLowerCase() === nome.toLowerCase())
    const t = existe ?? upsert('etiquetas', { nome, cor: Object.keys(CORES_ETIQUETA)[list('etiquetas').length % 10] })
    if (t) onChange([...new Set([...value, t.id])])
    setNova('')
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 6 }}>
        {todas.map((t) => (
          <span key={t.id} className={`tag ${sel.has(t.id) ? '' : 'off'}`} style={{ ['--tag' as string]: corEtiqueta(t.id), cursor: 'pointer' }} onClick={() => alternar(t.id)}>
            {sel.has(t.id) ? '✓ ' : ''}
            {String(t.nome)}
          </span>
        ))}
        {!todas.length && <span className="small muted" style={{ fontWeight: 400 }}>Nenhuma etiqueta criada ainda.</span>}
      </div>
      <div className="row" style={{ flexWrap: 'nowrap', maxWidth: 360 }}>
        <input
          placeholder="Nova etiqueta…"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              criar()
            }
          }}
        />
        <button type="button" className="btn sm" onClick={criar} disabled={!nova.trim()}>
          Criar
        </button>
      </div>
    </div>
  )
}
