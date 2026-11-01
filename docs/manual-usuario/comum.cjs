// Base visual e impressão em PDF dos manuais (HTML → PDF pelo Chromium, com marcadores navegáveis).
const fs = require('fs')
const path = require('path')
const { chromium } = require('/opt/node-tools/node_modules/playwright')

const FONTES = '/home/user/gestor-eficiente/node_modules/@fontsource'
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const slug = (s) =>
  String(s || 'inicio')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const CSS = `
@font-face { font-family: Nunito; font-weight: 400; src: url(file://${FONTES}/nunito/files/nunito-latin-400-normal.woff2); }
@font-face { font-family: Nunito; font-weight: 600; src: url(file://${FONTES}/nunito/files/nunito-latin-600-normal.woff2); }
@font-face { font-family: Nunito; font-weight: 700; src: url(file://${FONTES}/nunito/files/nunito-latin-700-normal.woff2); }
@font-face { font-family: Nunito; font-weight: 800; src: url(file://${FONTES}/nunito/files/nunito-latin-800-normal.woff2); }
@font-face { font-family: Baloo; font-weight: 700; src: url(file://${FONTES}/baloo-2/files/baloo-2-latin-700-normal.woff2); }
@font-face { font-family: Baloo; font-weight: 800; src: url(file://${FONTES}/baloo-2/files/baloo-2-latin-800-normal.woff2); }
@page { size: A4; margin: 16mm 15mm 18mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font: 10.4pt/1.5 Nunito, sans-serif; color: #1f2a44; margin: 0; }
h1, h2, .display { font-family: Baloo, Nunito, sans-serif; color: #14254a; line-height: 1.15; }
h1 { font-size: 26pt; margin: 0 0 6pt; }
h2 { font-size: 17pt; margin: 0 0 4pt; }
.quebra { break-before: page; }
.capa { height: 258mm; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(140deg, #0b1f4d, #1d3b8a); color: #fff; padding: 18mm 16mm; border-radius: 10px; }
.capa .marca { font: 800 12pt Nunito; letter-spacing: .14em; color: #f5c542; text-transform: uppercase; }
.capa h1 { color: #fff; font-size: 40pt; margin: 8mm 0 4mm; }
.capa p { font-size: 13pt; color: #cadcfc; max-width: 135mm; }
.capa .rodape { font-size: 9.5pt; color: #cadcfc; }
.capa img { width: 100%; border-radius: 8px; box-shadow: 0 12px 40px rgb(0 0 0 / .4); margin-top: 8mm; }
.parte { height: 250mm; display: flex; flex-direction: column; justify-content: center; }
.parte .num { font: 800 12pt Nunito; letter-spacing: .14em; color: #c9962a; text-transform: uppercase; }
.parte h1 { font-size: 34pt; }
.parte p { font-size: 12pt; color: #5b6b8c; max-width: 150mm; }
.grupo-lista { columns: 2; column-gap: 10mm; margin-top: 6mm; padding: 0; list-style: none; }
.grupo-lista li { break-inside: avoid; padding: 2pt 0; border-bottom: 1px solid #e4e9f2; }
.grupo-lista a { color: #14254a; text-decoration: none; font-weight: 700; }
.etiqueta { display: inline-block; font: 800 8pt Nunito; letter-spacing: .1em; text-transform: uppercase; color: #8a6514; background: #fdf3d6; padding: 2pt 7pt; border-radius: 99px; }
.objetivo { font-size: 11.5pt; color: #2a3a5c; margin: 4pt 0 8pt; }
.foto { width: 100%; border: 1px solid #d5ddea; border-radius: 6px; margin: 4pt 0 8pt; display: block; }
.foto.meia { width: 78%; margin-left: auto; margin-right: auto; }
.legenda { font-size: 8.5pt; color: #6b7a99; margin: -5pt 0 8pt; text-align: center; }
.sec { break-inside: avoid; margin: 7pt 0 3pt; font: 800 9pt Nunito; letter-spacing: .08em; text-transform: uppercase; color: #2a5caa; }
ol, ul { margin: 2pt 0 6pt; padding-left: 15pt; }
li { margin: 1.5pt 0; }
.grade { display: grid; grid-template-columns: 1fr 1fr; gap: 3pt 12pt; margin: 2pt 0 6pt; }
.recurso b { color: #14254a; }
.caixa { break-inside: avoid; border-radius: 8px; padding: 7pt 10pt; margin: 6pt 0; }
.caixa.impacto { background: #eef4ff; border-left: 4px solid #2a5caa; }
.caixa.cuidado { background: #fff5f5; border-left: 4px solid #c93c3c; }
.caixa.dica { background: #fdf6e3; border-left: 4px solid #f5c542; }
.caixa.neutra { background: #f3f6fb; border-left: 4px solid #5b6b8c; }
.caixa .sec { margin-top: 0; }
table { width: 100%; border-collapse: collapse; font-size: 9.2pt; margin: 4pt 0 8pt; }
th { text-align: left; background: #14254a; color: #fff; padding: 4pt 6pt; font-weight: 700; }
td { border-bottom: 1px solid #e4e9f2; padding: 4pt 6pt; vertical-align: top; }
tr { break-inside: avoid; }
.sumario a { color: #14254a; text-decoration: none; }
.sumario .g { font-weight: 800; margin-top: 6pt; }
.sumario .t { padding-left: 12pt; font-size: 9.6pt; }
.muted { color: #6b7a99; }
.kpi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8pt; margin: 6pt 0; }
.kpi div { background: #f3f6fb; border-radius: 8px; padding: 8pt; }
.kpi b { display: block; font: 800 18pt Baloo, Nunito; color: #14254a; }
`

const pagina = (titulo, corpo) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head><body>${corpo}</body></html>`

async function imprimir(html, saida, rodape) {
  const tmp = saida.replace(/\.pdf$/, '.html')
  fs.writeFileSync(tmp, html)
  const b = await chromium.launch()
  const p = await b.newPage()
  await p.goto('file://' + tmp, { waitUntil: 'load' })
  await p.evaluate(() => document.fonts.ready)
  await p.pdf({
    path: saida,
    format: 'A4',
    printBackground: true,
    outline: true, // marcadores (menu lateral do leitor de PDF) a partir dos títulos
    tagged: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font:7.5pt Helvetica,Arial,sans-serif;color:#8a97b0;padding:0 15mm;display:flex;justify-content:space-between"><span>${esc(rodape)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' },
  })
  await b.close()
}

module.exports = { esc, slug, pagina, imprimir }
