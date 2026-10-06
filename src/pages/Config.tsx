import { avisar, confirmar } from '../components/Dialogs'
import { useEffect, useRef, useState } from 'react'
import { exportarZip, lerBackup, restaurar } from '../lib/backup'
import { fmtSize, restoreFiles, useFileIndex } from '../lib/files'
import { uso } from '../lib/idb'
import { isAdmin } from '../lib/session'
import { servidor } from '../lib/api'
import { Icon } from '../components/Icon'
import { PageHead } from '../components/ui'
import { buildSeed } from '../data/seed'
import { replaceAll, useDB } from '../data/store'

export function Configuracoes() {
  const db = useDB()
  const ref = useRef<HTMLInputElement>(null)
  const total = Object.values(db).reduce((a, r) => a + (r?.length ?? 0), 0)
  const fidx = useFileIndex()
  const [busy, setBusy] = useState(false)
  const [espaco, setEspaco] = useState({ usado: 0, cota: 0 })
  useEffect(() => {
    void uso().then(setEspaco)
  }, [fidx.length])

  return (
    <>
      <PageHead title="Configurações e dados" desc="Backup completo (dados e anexos), restauração e dados de exemplo." />
      <div className="grid g2">
        <div className="card stack">
          <h2>Backup</h2>
          <span className="muted small">
            {total} registros · {fidx.length} anexos ({fmtSize(fidx.reduce((a, f) => a + f.size, 0))}) · espaço usado no navegador {fmtSize(espaco.usado)}
            {espaco.cota ? ` de ${fmtSize(espaco.cota)}` : ''}
          </span>
          <div className="row">
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const r = await exportarZip()
                  avisar(`Backup gerado: ${r.registros} registros e ${r.anexos} anexos (${fmtSize(r.bytes)}).`)
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Icon name="download" size={15} /> {busy ? 'Gerando…' : 'Exportar backup completo (.zip)'}
            </button>
            {isAdmin() && (
              <button className="btn" onClick={() => ref.current?.click()}>
                <Icon name="upload" size={15} /> Restaurar backup
              </button>
            )}
            <input
              ref={ref}
              type="file"
              accept=".zip,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  const b = await lerBackup(f)
                  const msg = `Substituir TODOS os dados atuais pelo backup "${f.name}"?${b.files ? ` Inclui ${b.files.length} anexo(s).` : ' (backup sem anexos: os anexos atuais são mantidos)'}${b.data.usuarios?.length ? ' Os usuários e senhas também voltam aos do backup.' : ''}`
                  if (await confirmar(msg, { ok: 'Restaurar', danger: true })) {
                    await restaurar(b)
                    avisar('Backup restaurado.')
                  }
                } catch {
                  avisar('Arquivo de backup inválido.')
                }
              }}
            />
          </div>
          <span className="small muted">O .zip contém os dados e todos os anexos. Guarde no OneDrive/SharePoint corporativo, não em e-mail pessoal.</span>
        </div>
        {isAdmin() && <div className="card stack">
          <h2>Dados de exemplo</h2>
          <span className="muted small">Dados fictícios para explorar o sistema. Antes do uso real, apague tudo e comece o cadastro (centros de custo → cargos → time).</span>
          <div className="row">
            <button
              className="btn danger"
              onClick={async () => {
                if (await confirmar('Apagar TODOS os dados e anexos? Os usuários são mantidos. Exporte um backup antes, se precisar.', { ok: 'Apagar tudo', danger: true })) {
                  await replaceAll({})
                  await restoreFiles([])
                }
              }}
            >
              <Icon name="trash" size={15} /> Apagar todos os dados
            </button>
            <button
              className="btn"
              onClick={async () => {
                if (await confirmar('Substituir os dados atuais pelos dados de exemplo?', { ok: 'Recarregar', danger: true })) replaceAll(buildSeed())
              }}
            >
              Carregar dados de exemplo
            </button>
          </div>
        </div>}
        <div className="card stack">
          <h2>Privacidade</h2>
          <span className="small">
            {servidor()
              ? 'Dados no banco D1 e anexos no R2, na sua conta Cloudflare, acessados só por HTTPS e com login. O Cloudflare mantém cópias de recuperação do banco (Time Travel, 30 dias); mesmo assim exporte o backup .zip periodicamente.'
              : 'Modo local: dados e anexos ficam no armazenamento deste navegador (IndexedDB). Limpar os dados de navegação ou trocar de computador apaga esta base, por isso o backup .zip é importante.'}
          </span>
        </div>
        <div className="card stack">
          <h2>Identidade visual</h2>
          <span className="small">
            Paleta BP.CONN (azul-marinho, gradiente e amarelo), fontes Baloo 2 e Nunito embutidas. Tema claro/escuro/automático no topo da tela.
          </span>
        </div>
      </div>
    </>
  )
}
