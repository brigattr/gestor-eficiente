import { useRef } from 'react'
import { Icon } from '../components/Icon'
import { PageHead } from '../components/ui'
import { buildSeed } from '../data/seed'
import { getDB, replaceAll, useDB, type DB } from '../data/store'
import { downloadFile, todayISO } from '../lib/format'

export function Configuracoes() {
  const db = useDB()
  const ref = useRef<HTMLInputElement>(null)
  const total = Object.values(db).reduce((a, r) => a + (r?.length ?? 0), 0)
  const kb = Math.round(JSON.stringify(db).length / 1024)

  return (
    <>
      <PageHead title="Configurações e dados" desc="Os dados ficam salvos apenas neste navegador, neste computador. Faça backups regulares e guarde no OneDrive/SharePoint da empresa." />
      <div className="grid g2">
        <div className="card stack">
          <h2>Backup</h2>
          <span className="muted small">
            {total} registros · {kb} KB armazenados localmente
          </span>
          <div className="row">
            <button className="btn primary" onClick={() => downloadFile(`gestor-eficiente_backup_${todayISO()}.json`, JSON.stringify({ app: 'gestor-eficiente', versao: 1, data: getDB() }, null, 1), 'application/json')}>
              <Icon name="download" size={15} /> Exportar backup (JSON)
            </button>
            <button className="btn" onClick={() => ref.current?.click()}>
              <Icon name="upload" size={15} /> Restaurar backup
            </button>
            <input
              ref={ref}
              type="file"
              accept=".json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  const j = JSON.parse(await f.text())
                  const data = (j.data ?? j) as DB
                  if (typeof data !== 'object' || Array.isArray(data)) throw new Error('formato')
                  if (confirm('Substituir TODOS os dados atuais pelo backup?')) replaceAll(data)
                } catch {
                  alert('Arquivo de backup inválido.')
                }
              }}
            />
          </div>
        </div>
        <div className="card stack">
          <h2>Dados de exemplo</h2>
          <span className="muted small">O sistema começou com dados fictícios para você explorar. Quando for usar de verdade, apague tudo e comece seu cadastro (centros de custo → cargos → time).</span>
          <div className="row">
            <button
              className="btn danger"
              onClick={() => {
                if (confirm('Apagar TODOS os dados? Exporte um backup antes, se precisar.')) replaceAll({})
              }}
            >
              <Icon name="trash" size={15} /> Apagar todos os dados
            </button>
            <button
              className="btn"
              onClick={() => {
                if (confirm('Substituir os dados atuais pelos dados de exemplo?')) replaceAll(buildSeed())
              }}
            >
              Recarregar exemplo
            </button>
          </div>
        </div>
        <div className="card stack">
          <h2>Privacidade</h2>
          <span className="small">
            Nenhum dado é enviado para servidores: salários, avaliações e ocorrências ficam no armazenamento local do navegador. Limpar os dados de navegação apaga também esta base, por isso o backup é importante.
          </span>
        </div>
        <div className="card stack">
          <h2>Identidade visual</h2>
          <span className="small">
            As cores ficam centralizadas em <code>src/theme.css</code>. Tema claro/escuro/automático no topo da tela.
          </span>
        </div>
      </div>
    </>
  )
}
