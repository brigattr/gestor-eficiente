// Manual do usuário do Gestor Eficiente: capa, como usar, primeiros passos, padrões das telas,
// uma seção por tela (na ordem do menu) e anexos (integrações, glossário, perguntas frequentes).
const fs = require('fs')
const path = require('path')
const { esc, slug, pagina, imprimir } = require('./comum.cjs')

const C = path.join(__dirname, 'conteudo')
const ler = (f) => JSON.parse(fs.readFileSync(path.join(C, f), 'utf8'))
const geral = ler('e-geral.json')
const telas = [...ler('a-visao-gestao.json'), ...ler('b-pessoas-desempenho.json'), ...ler('c-clima-cultura-comunicacao.json'), ...ler('d-desenv-sistema.json')]

const IMG = (n) => 'file://' + path.join(__dirname, 'jpg', n + '.jpg')
const existe = (n) => fs.existsSync(path.join(__dirname, 'jpg', n + '.jpg'))
const foto = (n, leg) => (existe(n) ? `<img class="foto" src="${IMG(n)}">${leg ? `<div class="legenda">${esc(leg)}</div>` : ''}` : '')
const imgDe = (p) => (p ? p.split('?')[0] : 'visao-geral')
const EXTRAS = {
  tarefas: [['det-tarefa', 'A tarefa aberta: campos, etapas e anexos'], ['det-kanban', 'Visão Kanban: arraste o cartão para mudar o status']],
  projetos: [['det-projeto', 'Dentro do projeto: as tarefas do projeto e o progresso'], ['det-projetos-tarefas', 'Visão “Com tarefas”: cada projeto com as tarefas em aberto'], ['det-gantt', 'Visão Gantt: a linha do tempo dos projetos']],
}
const PADRAO_IMG = [
  [/importar/i, 'det-importar', 'Importar planilha: modelo, conferência e desfazer'],
  [/busca global|ctrl\+k/i, 'det-busca', 'Busca global: digite e vá direto ao registro'],
]

const lista = (xs, tag = 'ul') => (xs?.length ? `<${tag}>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</${tag}>` : '')
const caixa = (tipo, titulo, html) => (html ? `<div class="caixa ${tipo}"><div class="sec">${esc(titulo)}</div>${html}</div>` : '')

// grupos na ordem do menu
const grupos = []
for (const t of telas) {
  let g = grupos.find((x) => x.nome === t.grupo)
  if (!g) grupos.push((g = { nome: t.grupo, telas: [] }))
  g.telas.push(t)
}
const DESCR_GRUPO = {
  Visão: 'O seu dia a dia: o que pede atenção, a agenda, a preparação da semana, as anotações e os arquivos da área.',
  Etiquetas: 'Temas que atravessam o sistema: tudo o que recebeu a mesma etiqueta, de qualquer tela, num só lugar.',
  'Gestão e Produtividade': 'Tarefas, projetos, metas, conversas 1:1, reuniões e indicadores de eficiência da área.',
  'Pessoas & DP': 'O cadastro do time e as rotinas de DP: vagas, ponto, férias, exames, cargos, organograma e benefícios.',
  'Clima e bem-estar': 'O pulso da equipe: clima, eNPS, humor, check-ins, relatos e a gestão de riscos psicossociais (NR-1).',
  Cultura: 'Cultura da área, políticas com registro de ciência e diversidade do time.',
  Comunicação: 'Mural, reconhecimentos, grupos de trabalho, ouvidoria e o Modo TV.',
  Desempenho: 'Avaliações, matriz 9-Box, competências e feedbacks.',
  Desenvolvimento: 'Onboarding, PDIs, treinamentos e o Incentive model (metas e bônus).',
  Controles: 'Orçamento × realizado, centros de custo e o fechamento mensal.',
  Processos: 'Obrigações, checklists, fluxogramas, aprovações, reembolsos, contratos, patrimônio e NPS interno.',
  Conhecimento: 'A biblioteca de gestão com referências e boas práticas.',
  Sistema: 'Anexos, usuários e perfis, configurações, backup e importação em massa.',
}

const idTela = (t) => 'tela-' + slug(t.titulo)
const secaoTela = (t) => {
  const extras = (EXTRAS[t.path] ?? []).map(([n, l]) => foto(n, l)).join('')
  const recursos = t.recursos?.length ? `<div class="grade">${t.recursos.map((r) => `<div class="recurso"><b>${esc(r.nome)}</b> — ${esc(r.descricao)}</div>`).join('')}</div>` : ''
  return `<section class="quebra" id="${idTela(t)}">
    <span class="etiqueta">${esc(t.grupo)}</span>
    <h2>${esc(t.titulo)}</h2>
    <p class="objetivo"><b>Objetivo.</b> ${esc(t.objetivo)}</p>
    ${foto(imgDe(t.path), 'Tela ' + t.titulo + ' (dados fictícios de demonstração)')}
    ${t.quando_usar ? `<div class="sec">Quando usar</div><p>${esc(t.quando_usar)}</p>` : ''}
    <div class="sec">Passo a passo</div>${lista(t.passo_a_passo, 'ol')}
    ${recursos ? `<div class="sec">Recursos da tela</div>${recursos}` : ''}
    ${extras}
    ${caixa('impacto', 'Impactos em outros módulos', lista(t.impactos))}
    ${caixa('cuidado', 'Cuidados e consequências', lista(t.cuidados))}
    ${t.dica ? caixa('dica', 'Dica', `<p>${esc(t.dica)}</p>`) : ''}
  </section>`
}

const blocoTexto = (b) => {
  const img = PADRAO_IMG.find(([re]) => re.test(b.titulo))
  return `<div style="break-inside: avoid-page"><h2 style="font-size:14pt;margin-top:10pt" id="${slug(b.titulo)}">${esc(b.titulo)}</h2>${b.texto ? `<p>${esc(b.texto)}</p>` : ''}${lista(b.passos, 'ol')}</div>${img ? foto(img[1], img[2]) : ''}`
}

// sumário clicável
const sumario = `<section class="quebra sumario"><h1>Sumário</h1>
  <div class="g"><a href="#como-usar">Como usar este manual</a></div>
  <div class="g"><a href="#primeiros-passos">Parte 1 — Primeiros passos</a></div>
  <div class="g"><a href="#padroes">Parte 2 — O que vale para todas as telas</a></div>
  <div class="g"><a href="#telas">Parte 3 — As telas, menu por menu</a></div>
  ${grupos.map((g) => `<div class="t"><b><a href="#grupo-${slug(g.nome)}">${esc(g.nome)}</a></b> — ${g.telas.map((t) => `<a href="#${idTela(t)}">${esc(t.titulo)}</a>`).join(' · ')}</div>`).join('')}
  <div class="g"><a href="#integracoes">Parte 4 — Como os módulos se conversam</a></div>
  <div class="g"><a href="#glossario">Glossário</a> · <a href="#faq">Perguntas frequentes</a></div>
</section>`

const corpo = `
<section class="capa"><div><div class="marca">ChiefDesk · Manual do usuário</div><h1>Gestor Eficiente</h1><p>Guia completo do sistema: para que serve cada tela, passo a passo, imagens, cuidados e como uma tela afeta as outras.</p>${foto('visao-geral')}</div><div class="rodape">Versão de ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} · ${telas.length} telas · as imagens usam dados fictícios de demonstração</div></section>
${sumario}
<section class="quebra" id="como-usar"><h1>Como usar este manual</h1>
  <p class="objetivo">Este manual segue o <b>menu da esquerda</b> do sistema. Use os <b>marcadores</b> do seu leitor de PDF (o painel lateral, no Adobe, Edge ou Chrome: ícone de lista/marcadores) para pular direto para o grupo e a tela que você quer — ou clique nos itens do Sumário.</p>
  ${caixa('neutra', 'Cada tela traz', lista(['Objetivo — para que a tela serve e que problema resolve.', 'Imagem da tela (com dados de exemplo, fictícios).', 'Quando usar — situações do dia a dia.', 'Passo a passo — como fazer as tarefas principais.', 'Recursos da tela — campos, visões e botões importantes.', 'Impactos em outros módulos — o que muda em outras telas quando você altera algo aqui.', 'Cuidados e consequências — o que observar antes de alterar ou excluir.', 'Dica — o atalho para tirar o máximo da tela.']))}
  ${caixa('dica', 'Para começar', '<p>Leia a Parte 1 (entrar, instalar no celular, conhecer a tela e ativar os avisos) e a Parte 2 (o que funciona igual em todas as telas). Depois, consulte só as telas que a sua área usa — o administrador pode esconder do menu as que não forem usadas.</p>')}
</section>
<section class="quebra parte" id="primeiros-passos"><span class="num">Parte 1</span><h1>Primeiros passos</h1><p>Entrar no sistema, instalar no celular ou tablet, conhecer a tela, entender os perfis de acesso e ligar os avisos.</p></section>
<section class="quebra">${geral.primeiros_passos.map(blocoTexto).join('')}</section>
<section class="quebra parte" id="padroes"><span class="num">Parte 2</span><h1>O que vale para todas as telas</h1><p>Recursos que se repetem em todo o sistema. Aprenda uma vez e use em todas as telas.</p></section>
<section class="quebra">${geral.padroes.map(blocoTexto).join('')}</section>
<section class="quebra parte" id="telas"><span class="num">Parte 3</span><h1>As telas, menu por menu</h1><p>Uma seção para cada tela, na mesma ordem do menu da esquerda.</p>
  <ul class="grupo-lista">${grupos.map((g) => `<li><a href="#grupo-${slug(g.nome)}">${esc(g.nome)}</a> <span class="muted">(${g.telas.length})</span></li>`).join('')}</ul></section>
${grupos
  .map(
    (g) => `<section class="quebra parte" id="grupo-${slug(g.nome)}"><span class="num">Menu</span><h1>${esc(g.nome)}</h1><p>${esc(DESCR_GRUPO[g.nome] ?? '')}</p>
      <ul class="grupo-lista">${g.telas.map((t) => `<li><a href="#${idTela(t)}">${esc(t.titulo)}</a></li>`).join('')}</ul></section>
      ${g.telas.map(secaoTela).join('')}`,
  )
  .join('')}
<section class="quebra" id="integracoes"><span class="etiqueta">Parte 4</span><h1>Como os módulos se conversam</h1>
  <p class="objetivo">O que você faz numa tela pode aparecer em outras. Use este mapa antes de alterar ou excluir algo importante.</p>
  <table><tr><th style="width:24%">De</th><th style="width:24%">Para</th><th>Como</th></tr>${geral.integracoes.map((i) => `<tr><td><b>${esc(i.de)}</b></td><td>${esc(i.para)}</td><td>${esc(i.como)}</td></tr>`).join('')}</table></section>
<section class="quebra" id="glossario"><h1>Glossário</h1><table><tr><th style="width:24%">Termo</th><th>Significado</th></tr>${geral.glossario.map((g) => `<tr><td><b>${esc(g.termo)}</b></td><td>${esc(g.significado)}</td></tr>`).join('')}</table></section>
<section class="quebra" id="faq"><h1>Perguntas frequentes</h1>${geral.faq.map((f) => `<div style="break-inside:avoid;margin-bottom:8pt"><b>${esc(f.pergunta)}</b><p style="margin:2pt 0 0">${esc(f.resposta)}</p></div>`).join('')}</section>`

imprimir(pagina('Gestor Eficiente — Manual do usuário', corpo), path.join(__dirname, 'out', 'Manual-do-Usuario-Gestor-Eficiente.pdf'), 'Gestor Eficiente · uma plataforma ChiefDesk · Manual do usuário').then(() => console.log('ok', telas.length, 'telas'))
