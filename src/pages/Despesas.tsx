import { useRef, useState } from 'react'
import { BudgetChart } from '../components/Charts'
import { Icon } from '../components/Icon'
import { ModulePage } from '../components/ModulePage'
import { Kpi, Modal, PageHead, useLocalState } from '../components/ui'
import { CONTAS } from '../data/schema'
import { bulk, getDB, remove, uid, useDB, type Item } from '../data/store'
import { budgetVsReal, ytd, type BvR } from '../lib/calc'
import { MES_CURTO, downloadFile, label, money, parseCSV, pct, toCSV, toNumber } from '../lib/format'

function VarCells({ b, r }: { b: number; r: number }) {
  const v = r - b
  return (
    <>
      <td className="num">{money(b)}</td>
      <td className="num">{money(r)}</td>
      <td className={`num ${v > 0 ? 'neg' : v < 0 ? 'pos' : ''}`}>{r || b ? money(v) : '—'}</td>
      <td className={`num ${v > 0 ? 'neg' : ''}`}>{b ? pct(Math.round((r / b) * 1000) / 10) : '—'}</td>
    </>
  )
}
const vc = (x: BvR) => <VarCells b={x.budget} r={x.real} />

export function Despesas() {
  const db = useDB()
  const anos = [...new Set([...(db.budget ?? []), ...(db.despesas ?? [])].map((i) => Number(i.ano)).filter(Boolean))].sort()
  const [ano, setAno] = useLocalState('desp:ano', new Date().getFullYear())
  const [ccs, setCcs] = useLocalState<string[]>('desp:cc', [])
  const [aba, setAba] = useLocalState('desp:aba', 'bvr')
  const [dist, setDist] = useState(false)
  const centros = (db.centrosCusto ?? []).filter((c) => c.ativo !== false)
  const { months, byConta, byCC } = budgetVsReal(db, ano, ccs)
  const y = ytd(months)
  const acc = months.map((_, i) => months.slice(0, i + 1).reduce((a, m) => ({ budget: a.budget + m.budget, real: a.real + m.real }), { budget: 0, real: 0 }))
  const inFilter = (i: Item) => Number(i.ano) === ano && (!ccs.length || ccs.includes(i.centroCusto as string))
  const forecast = y.real + months.slice(y.last + 1).reduce((a, m) => a + m.budget, 0)

  return (
    <>
      <PageHead title="Despesas do departamento" desc="Budget × realizado por centro de custo, conta, mês e ano. Um gestor pode ter vários centros de custo: selecione um ou mais para consolidar.">
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} style={{ width: 100 }}>
          {[...new Set([...anos, new Date().getFullYear(), new Date().getFullYear() + 1])].sort().map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </PageHead>
      <div className="row">
        <span className="small muted">Centros de custo:</span>
        <button className={`chip ${!ccs.length ? 'gold' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setCcs([])}>
          Todos (consolidado)
        </button>
        {centros.map((c) => (
          <button key={c.id} className={`chip ${ccs.includes(c.id) ? 'gold' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setCcs(ccs.includes(c.id) ? ccs.filter((x) => x !== c.id) : [...ccs, c.id])}>
            {label('centrosCusto', c)}
          </button>
        ))}
      </div>
      <div className="grid g4">
        <Kpi l={`Budget FY ${ano}`} v={money(y.fy)} />
        <Kpi l={`YTD até ${y.last >= 0 ? MES_CURTO[y.last] : '—'}`} v={money(y.real)} d={`budget YTD ${money(y.budget)}`} />
        <Kpi l="Variação YTD" v={money(y.real - y.budget)} t={y.real > y.budget ? 'bad' : 'ok'} d={y.budget ? `${pct(Math.round((y.real / y.budget) * 1000) / 10)} do budget` : ''} />
        <Kpi l="Forecast (real + budget restante)" v={money(forecast)} t={forecast > y.fy ? 'bad' : undefined} d={`${money(forecast - y.fy)} vs FY`} />
      </div>
      <div className="tabs">
        {[
          ['bvr', 'Budget × realizado'],
          ['lanc', 'Lançamentos realizados'],
          ['bud', 'Linhas de budget'],
        ].map(([k, l]) => (
          <button key={k} className={aba === k ? 'on' : ''} onClick={() => setAba(k)}>
            {l}
          </button>
        ))}
      </div>

      {aba === 'bvr' && (
        <>
          <div className="card">
            <BudgetChart months={months} />
          </div>
          <div className="grid g2">
            <div className="card flush">
              <h2 style={{ padding: '14px 16px 8px' }}>Por mês</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th className="num">Budget</th>
                      <th className="num">Real</th>
                      <th className="num">Var.</th>
                      <th className="num">% uso</th>
                      <th className="num">Acum. var.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m, i) => (
                      <tr key={i}>
                        <td>{MES_CURTO[i]}</td>
                        {vc(m)}
                        <td className={`num ${i <= y.last && acc[i].real > acc[i].budget ? 'neg' : ''}`}>{i <= y.last ? money(acc[i].real - acc[i].budget) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      {vc({ budget: y.fy, real: months.reduce((a, m) => a + m.real, 0) })}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="stack">
              <div className="card flush">
                <h2 style={{ padding: '14px 16px 8px' }}>Por conta (ano)</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Conta</th>
                        <th className="num">Budget</th>
                        <th className="num">Real</th>
                        <th className="num">Var.</th>
                        <th className="num">% uso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byConta)
                        .sort((a, b) => b[1].budget - a[1].budget)
                        .map(([c, v]) => (
                          <tr key={c}>
                            <td>{c}</td>
                            {vc(v)}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card flush">
                <h2 style={{ padding: '14px 16px 8px' }}>Por centro de custo (YTD)</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Centro de custo</th>
                        <th className="num">Budget YTD</th>
                        <th className="num">Real YTD</th>
                        <th className="num">Var.</th>
                        <th className="num">% uso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byCC).map(([cc, ms]) => {
                        const s = ms.slice(0, y.last + 1).reduce((a, m) => ({ budget: a.budget + m.budget, real: a.real + m.real }), { budget: 0, real: 0 })
                        return (
                          <tr key={cc}>
                            <td>{label('centrosCusto', getDB().centrosCusto?.find((c) => c.id === cc))}</td>
                            {vc(s)}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {aba === 'lanc' && <ModulePage col="despesas" embedded where={inFilter} preset={{ ano, centroCusto: ccs[0] }} />}
      {aba === 'bud' && (
        <>
          <div className="row">
            <button className="btn gold" onClick={() => setDist(true)}>
              <Icon name="pie" size={15} /> Distribuir budget anual por mês
            </button>
          </div>
          <ModulePage col="budget" embedded where={inFilter} preset={{ ano, centroCusto: ccs[0] }} />
        </>
      )}
      <ImportCSV />
      {dist && <Distribuir ano={ano} onClose={() => setDist(false)} />}
    </>
  )
}

/** Lança o valor anual em 12 linhas mensais (igual ou por sazonalidade). */
function Distribuir({ ano, onClose }: { ano: number; onClose: () => void }) {
  const db = getDB()
  const [cc, setCc] = useState(db.centrosCusto?.[0]?.id ?? '')
  const [conta, setConta] = useState(CONTAS[0])
  const [valor, setValor] = useState<number>(0)
  const [modo, setModo] = useState<'anual' | 'mensal'>('anual')
  const [subst, setSubst] = useState(true)
  function aplicar() {
    const mensal = modo === 'anual' ? valor / 12 : valor
    const velhas = subst ? (db.budget ?? []).filter((b) => b.centroCusto === cc && Number(b.ano) === ano && b.conta === conta) : []
    const novas = Array.from({ length: 12 }, (_, i) => ({ id: uid(), centroCusto: cc, ano, mes: String(i + 1), conta, valor: Math.round(mensal * 100) / 100 }))
    velhas.forEach((v) => remove('budget', v.id))
    void bulk('budget', novas)
    onClose()
  }
  return (
    <Modal
      title={`Distribuir budget ${ano}`}
      onClose={onClose}
      foot={
        <>
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={aplicar} disabled={!cc || !valor}>
            Gerar 12 meses
          </button>
        </>
      }
    >
      <div className="modal-body">
        <label className="field">
          <span>Centro de custo</span>
          <select value={cc} onChange={(e) => setCc(e.target.value)}>
            {(db.centrosCusto ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {label('centrosCusto', c)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Conta</span>
          <select value={conta} onChange={(e) => setConta(e.target.value)}>
            {CONTAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Valor</span>
          <input type="number" value={valor || ''} onChange={(e) => setValor(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>O valor informado é</span>
          <select value={modo} onChange={(e) => setModo(e.target.value as 'anual' | 'mensal')}>
            <option value="anual">Anual (divide por 12)</option>
            <option value="mensal">Mensal (repete 12×)</option>
          </select>
        </label>
        <label className="field wide row">
          <input type="checkbox" checked={subst} onChange={(e) => setSubst(e.target.checked)} />
          <span>Substituir linhas existentes desta conta/centro/ano</span>
        </label>
      </div>
    </Modal>
  )
}

// Importação de realizado/budget exportado do ERP (CSV)
const HEAD = ['tipo', 'centro_custo', 'ano', 'mes', 'conta', 'descricao', 'fornecedor', 'valor', 'documento', 'po']
function ImportCSV() {
  const ref = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  async function go(f: File) {
    const rows = parseCSV(await f.text())
    const h = rows[0]?.map((x) => x.trim().toLowerCase()) ?? []
    const ix = (k: string) => h.indexOf(k)
    if (ix('centro_custo') < 0 || ix('valor') < 0) return setMsg('Cabeçalho inválido. Baixe o modelo.')
    const db = getDB()
    const ccs = db.centrosCusto ?? []
    const add: Record<'budget' | 'despesas', Item[]> = { budget: [], despesas: [] }
    const erros: string[] = []
    rows.slice(1).forEach((r, n) => {
      const g = (k: string) => (ix(k) >= 0 ? r[ix(k)]?.trim() : '')
      const cc = ccs.find((c) => String(c.codigo) === g('centro_custo') || String(c.nome) === g('centro_custo'))
      if (!cc) return erros.push(`linha ${n + 2}: centro de custo "${g('centro_custo')}" não cadastrado`)
      const it: Item = { id: uid(), centroCusto: cc.id, ano: Number(g('ano')), mes: String(Number(g('mes'))), conta: CONTAS.includes(g('conta')) ? g('conta') : 'Outros', descricao: g('descricao') || 'Importado', fornecedor: g('fornecedor'), valor: toNumber(g('valor')) ?? 0, documento: g('documento'), po: g('po') }
      add[/^b/i.test(g('tipo')) ? 'budget' : 'despesas'].push(it)
    })
    if (add.budget.length) await bulk('budget', add.budget)
    if (add.despesas.length) await bulk('despesas', add.despesas)
    setMsg(`Importado: ${add.despesas.length} realizado(s), ${add.budget.length} linha(s) de budget.${erros.length ? ' Ignoradas: ' + erros.slice(0, 5).join('; ') + (erros.length > 5 ? '…' : '') : ''}`)
  }
  return (
    <div className="card row">
      <Icon name="upload" />
      <span className="grow small">
        <b>Importar do ERP (CSV)</b> — colunas: {HEAD.join(', ')}. Em <code>tipo</code> use “real” ou “budget”; <code>centro_custo</code> = código cadastrado.
        {msg && <div style={{ color: 'var(--info)' }}>{msg}</div>}
      </span>
      <button className="btn sm" onClick={() => downloadFile('modelo_despesas.csv', toCSV([HEAD, ['real', 'BR10-4100', new Date().getFullYear(), 1, 'Viagens', 'Passagem SP-Frankfurt', 'Agência X', '4.250,00', 'NF 123', '4500001234']]), 'text/csv')}>
        Modelo
      </button>
      <button className="btn sm primary" onClick={() => ref.current?.click()}>
        Importar
      </button>
      <input
        ref={ref}
        type="file"
        accept=".csv,.txt"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) go(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
