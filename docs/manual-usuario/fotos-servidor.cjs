// Fotos das telas que só existem no modo servidor (contas e visão por usuário), com dados fictícios.
const { chromium } = require('/opt/node-tools/node_modules/playwright')
const D = process.argv[2] + '/manual/img/'
const B = 'http://localhost:8810/'
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 })
  const p = await ctx.newPage()
  const erros = []
  p.on('pageerror', (e) => erros.push(e.message))
  const api = (path, method, body) =>
    p.evaluate(
      async ([path, method, body]) => {
        const r = await fetch('api' + path, { method, headers: { 'x-chiefdeck': '1', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
        return r.json()
      },
      [path, method, body],
    )
  await p.goto(B)
  await p.waitForTimeout(1500)
  await p.evaluate(async () => {
    await fetch('api/setup', { method: 'POST', headers: { 'x-chiefdeck': '1', 'content-type': 'application/json' }, body: JSON.stringify({ chave: 'dev-local-123', nome: 'Gestor Exemplo', login: 'gestor', senha: 'Senha-teste-123!' }) })
  })
  await p.goto(B + '#/configuracoes')
  await p.reload()
  await p.waitForTimeout(1500)
  await p.locator('button', { hasText: 'Carregar dados de exemplo' }).click()
  await p.waitForTimeout(400)
  const ok = p.locator('.modal button.primary, .modal button', { hasText: /Carregar|Confirmar|Sim|OK/i })
  if (await ok.count()) await ok.last().click()
  await p.waitForTimeout(2500)
  const d = await api('/data', 'GET')
  const ana = d.db.pessoas.find((x) => /Ana Ribeiro/.test(x.nome)) ?? d.db.pessoas[0]
  await api('/users/' + d.user.id, 'PUT', { nome: 'Gestor Exemplo', login: 'gestor', papel: 'Administrador', pessoa: ana.id, ativo: true })
  await api('/plataforma/contas', 'POST', { nome: 'Demonstração Empresa', plano: 'empresa', modulos: null, admin: { nome: 'Admin Demonstração', login: 'demo.empresa', senha: 'Senha-teste-123!' } })
  await api('/plataforma/contas', 'POST', { nome: 'Consultoria Exemplo', plano: 'individual', modulos: ['tarefas', 'projetos', 'calendario', 'anotacoes', 'pendencias', 'okr'], admin: { nome: 'Consultor Exemplo', login: 'consultor', senha: 'Senha-teste-123!' } })
  await p.reload()
  await p.waitForTimeout(2000)
  const foto = async (rota, nome, prep) => {
    await p.goto(B + '#/' + rota)
    await p.waitForTimeout(1200)
    if (prep) await prep()
    await p.waitForTimeout(500)
    await p.screenshot({ path: D + nome + '.png' })
    await p.keyboard.press('Escape')
  }
  await foto('pendencias', 'pendencias')
  await foto('plataforma', 'plataforma')
  await foto('plataforma', 'det-nova-conta', async () => p.locator('button', { hasText: 'Nova conta' }).click())
  await foto('configuracoes', 'det-conta', async () => p.locator('h2', { hasText: /^Conta$/ }).scrollIntoViewIfNeeded())
  await foto('tarefas', 'det-compartilhar', async () => {
    await p.locator('.seg button', { hasText: 'Lista' }).first().click()
    await p.locator('tbody tr').first().locator('td').first().click()
    await p.waitForTimeout(500)
    await p.locator('.modal label', { hasText: 'Compartilhar com' }).scrollIntoViewIfNeeded()
  })
  await foto('manual', 'det-manual')
  console.log('ERROS', erros.slice(0, 3))
  await b.close()
})()
