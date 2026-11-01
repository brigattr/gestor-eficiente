# Manual do usuário (PDF)

Gera o "Manual do Usuário" do Gestor Eficiente: uma seção por tela (objetivo, passo a passo,
imagem, recursos, impactos em outros módulos, cuidados e dica), com marcadores navegáveis.

- `conteudo/*.json` — textos de cada tela (ordem do menu) e capítulos gerais (primeiros passos,
  padrões, integrações, glossário, perguntas frequentes). **Atualize aqui quando uma tela mudar.**
- `fotos.cjs` — tira as fotos das telas com os dados de exemplo (fictícios), com o sistema
  rodando em `vite preview` na porta 4192 (salva em `img/`; converter para `jpg/` em 1600 px).
- `usuario.cjs` — monta o HTML e imprime o PDF pelo Chromium (Playwright), com marcadores.
- `marcadores.py` — corrige títulos duplicados nos marcadores e grava o título do documento.

O manual comercial (estratégia de venda) **não** fica neste repositório público.
