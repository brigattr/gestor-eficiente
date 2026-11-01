const { chromium } = require('/opt/node-tools/node_modules/playwright');
const D = process.argv[2] + '/manual/img/';
const U = 'http://localhost:4192/#/';
const ROTAS = ['', 'calendario', 'semana', 'anotacoes?p=pg1', 'arquivos', 'etiquetas', 'tarefas', 'projetos', 'okr', 'one-on-one', 'reunioes', 'eficiencia', 'diagnostico', 'pessoas', 'vagas', 'ponto', 'ferias', 'ocorrencias', 'exames', 'cargos', 'organograma', 'cobertura', 'admissoes', 'beneficios', 'holerites', 'clima', 'humor', 'nr1-bem-estar', 'nr1-relatos', 'nr1', 'nr1-inventario', 'nr1-plano', 'nr1-pesquisa', 'nr1-indicadores', 'nr1-checklist', 'nr1-guia', 'cultura', 'politicas', 'diversidade', 'mural', 'reconhecimentos', 'grupos', 'ouvidoria', 'tv', 'avaliacoes', 'competencias', 'feedbacks', 'onboarding', 'pdis', 'treinamentos', 'treinamento-interno', 'incentive', 'despesas', 'centros-custo', 'fechamento', 'obrigacoes', 'checklists', 'fluxogramas', 'solicitacoes', 'reembolsos', 'contratos', 'patrimonio', 'nps-interno', 'biblioteca', 'anexos', 'usuarios', 'configuracoes'];
const nome = (r) => (r.split('?')[0] || 'visao-geral');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 }); const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/api/**', r => r.fulfill({ status: 404, body: '' }));
  await p.goto(U); await p.waitForTimeout(1500);
  for (const i of await p.locator('input').all()) { const t = await i.getAttribute('type'); if (t==='checkbox') continue; await i.fill(t==='password' ? 'Senha-teste-123!' : t === 'email' ? 'gestor@exemplo.com' : 'Gestor Exemplo'); }
  await p.locator('button', { hasText: 'Criar administrador' }).click(); await p.waitForTimeout(1500);
  const cont = p.locator('button', { hasText: /Continuar|Entrar|guardei/i }); if (await cont.count()) { await cont.first().click(); await p.waitForTimeout(1200); }
  for (const r of ROTAS) {
    await p.goto(U + r); await p.waitForTimeout(900);
    if (r === 'fluxogramas') { await p.locator('.fx-cartao').first().click(); await p.waitForTimeout(700); }
    await p.screenshot({ path: D + nome(r) + '.png' });
  }
  // detalhes: formulários e recursos especiais
  const det = async (rota, n, prep) => { await p.goto(U + rota); await p.waitForTimeout(800); await prep(); await p.waitForTimeout(500); await p.screenshot({ path: D + n + '.png' }); if (await p.locator('.modal').count()) { await p.keyboard.press('Escape'); const c = p.locator('.modal button', { hasText: /Cancelar|Concluir/ }); if (await c.count()) await c.first().click().catch(()=>{}); } };
  await det('tarefas', 'det-tarefa', async () => { await p.locator('.seg button', { hasText: 'Lista' }).first().click(); await p.locator('tbody tr').first().locator('td').first().click(); await p.waitForTimeout(400); await p.locator('.modal .et').scrollIntoViewIfNeeded(); });
  await det('projetos', 'det-projeto', async () => { await p.locator('.seg button', { hasText: 'Lista' }).first().click(); await p.locator('tbody tr').first().locator('td').first().click(); await p.waitForTimeout(400); await p.locator('.modal .et').scrollIntoViewIfNeeded(); });
  await det('projetos', 'det-projetos-tarefas', async () => { await p.locator('.seg button', { hasText: 'Com tarefas' }).click(); });
  await det('tarefas', 'det-importar', async () => { await p.locator('button', { hasText: /^\s*Importar$/ }).first().click(); });
  await det('tarefas', 'det-kanban', async () => { await p.locator('.seg button', { hasText: 'Kanban' }).first().click(); });
  await det('projetos', 'det-gantt', async () => { await p.locator('.seg button', { hasText: 'Gantt' }).first().click(); });
  await det('', 'det-busca', async () => { await p.locator('.busca-global input').fill('fech'); });
  console.log('fotos:', ROTAS.length, '| ERROS', erros.slice(0, 3));
  await b.close();
})();
