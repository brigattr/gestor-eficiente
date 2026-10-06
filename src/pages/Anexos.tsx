import { useMemo } from 'react'
import { FileRow } from '../components/Attachments'
import { openEditor } from '../components/ItemForm'
import { Kpi, PageHead, useLocalState } from '../components/ui'
import { MOD } from '../data/schema'
import { get, useDB } from '../data/store'
import { fmtSize, useFileIndex } from '../lib/files'
import { label } from '../lib/format'

export function Anexos() {
  useDB()
  const idx = useFileIndex()
  const [q, setQ] = useLocalState('anx:q', '')
  const [mod, setMod] = useLocalState('anx:mod', '')
  const [soEmail, setSoEmail] = useLocalState('anx:mail', false)
  const mods = [...new Set(idx.map((f) => f.col))]
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return idx
      .filter((f) => (!mod || f.col === mod) && (!soEmail || f.meta?.assunto || f.meta?.de))
      .filter((f) => {
        if (!s) return true
        const reg = get(f.col, f.itemId)
        return [f.name, f.meta?.assunto, f.meta?.de, f.meta?.para, f.meta?.resumo, reg && MOD[f.col] ? label(f.col, reg) : ''].some((x) => String(x ?? '').toLowerCase().includes(s))
      })
      .sort((a, b) => (b.meta?.data ?? b.added).localeCompare(a.meta?.data ?? a.added))
  }, [idx, q, mod, soEmail])
  const total = idx.reduce((a, f) => a + f.size, 0)
  return (
    <>
      <PageHead title="Anexos" desc="Todos os arquivos e e-mails anexados no sistema, com busca por assunto, remetente, nome do arquivo ou registro. Clique no registro para abrir a tarefa, projeto ou reunião de origem." />
      <div className="grid g3">
        <Kpi l="Anexos" v={idx.length} d={fmtSize(total) + ' armazenados'} />
        <Kpi l="E-mails" v={idx.filter((f) => f.meta?.assunto || f.meta?.de).length} d=".msg e .eml com assunto e remetente" />
        <Kpi l="Registros com anexo" v={new Set(idx.map((f) => f.col + f.itemId)).size} />
      </div>
      <div className="card row">
        <input id="anx-q" style={{ maxWidth: 320 }} placeholder="Buscar assunto, remetente, arquivo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select id="anx-mod" style={{ maxWidth: 220 }} value={mod} onChange={(e) => setMod(e.target.value)}>
          <option value="">Módulo: todos</option>
          {mods.map((m) => (
            <option key={m} value={m}>
              {MOD[m]?.title ?? m}
            </option>
          ))}
        </select>
        <label className="row small" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={soEmail} onChange={(e) => setSoEmail(e.target.checked)} /> só e-mails
        </label>
        <span className="grow" />
        <span className="small muted">{rows.length} anexo(s)</span>
      </div>
      {rows.length === 0 ? (
        <div className="card empty">Nenhum anexo ainda. Abra qualquer tarefa, projeto, reunião ou registro e arraste arquivos ou e-mails para a área de anexos.</div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {rows.map((f) => {
            const reg = get(f.col, f.itemId)
            return (
              <FileRow
                key={f.id}
                f={f}
                context={
                  <>
                    {' · '}
                    {reg && MOD[f.col] ? (
                      <a style={{ cursor: 'pointer' }} onClick={() => openEditor(f.col, f.itemId)}>
                        {MOD[f.col].singular}: {label(f.col, reg)}
                      </a>
                    ) : (
                      <span>registro removido</span>
                    )}
                  </>
                }
              />
            )
          })}
        </div>
      )}
    </>
  )
}
