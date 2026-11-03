# Auditoria Estática do Editor de Canvas (2026-10-28)

**Projeto:** `/opt/orbita` (Orbita / SCV Messenger)  
**Branch:** `feature/canvas-redesign`  
**Escopo auditado:**
- `frontend/src/components/ReportCanvas.tsx`
- `frontend/src/components/report-canvas/` (árvore completa de componentes, hooks, estado e testes)
- `frontend/src/components/report-canvas/*.css` (tokens, layout, shell, library, data, stage, dialogs, inspector)
- `backend/operations/report_canvas/` (api, engine, sources, blocks, schema, diagnostics, source_preview, parameter_editor, pdf, xlsx)
- *Nota sobre arquivos CSS legados:* Os arquivos `frontend/src/components/report-canvas.css` e `frontend/src/components/canvas-studio.css` citados no escopo original foram removidos e modularizados nos arquivos CSS acima citados durante a migração da branch (commit `a215956`).

---

## 1. Textos em inglês ou "técnicos" visíveis ao usuário

- **frontend/src/components/report-canvas/shell/TopBar.tsx:378**
  - **Gravidade:** importante
  - **O que está errado:** O botão na barra superior está rotulado com a sigla técnica "JSON", incompreensível para o usuário final de negócios.
  - **Correção sugerida:** Ocultar o botão para usuários comuns ou renomeá-lo para "Estrutura avançada" em menu secundário de administração.

- **frontend/src/components/report-canvas/dialogs/JsonEditorDialog.tsx:21**
  - **Gravidade:** importante
  - **O que está errado:** Título do diálogo e labels utilizam jargão técnico ("JSON do canvas").
  - **Correção sugerida:** Renomear para "Editor avançado de estrutura" e contextualizar que é restrito a administradores.

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:464**
  - **Gravidade:** menor
  - **O que está errado:** Botão com texto "Editar id" expõe jargão de banco/programação ("id").
  - **Correção sugerida:** Alterar o rótulo do botão para "Editar identificador" ou "Alterar código".

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:828**
  - **Gravidade:** menor
  - **O que está errado:** Texto explicativo cita colunas em inglês do modelo técnico: `<code>year</code>, <code>month</code> e <code>value</code>`.
  - **Correção sugerida:** Substituir por termos em português simples: `ano`, `mês` e `valor da meta`.

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:835-837**
  - **Gravidade:** menor
  - **O que está errado:** Cabeçalhos da tabela de metas exibem termos técnicos em inglês entre parênteses: `Ano (year)`, `Mês (month)`, `Valor (value)`.
  - **Correção sugerida:** Remover os termos em inglês entre parênteses, deixando apenas `Ano`, `Mês` e `Valor da meta`.

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:926**
  - **Gravidade:** menor
  - **O que está errado:** Sumário expansível exibe "Detalhes avançados (JSON da especificação)".
  - **Correção sugerida:** Renomear para "Especificação técnica da fonte" ou remover a visualização para perfis não técnicos.

- **frontend/src/components/report-canvas/dialogs/ShortcutsDialog.tsx:43**
  - **Gravidade:** menor
  - **O que está errado:** Exibe nomes de teclas em inglês cru ("Delete / Backspace") na listagem de atalhos.
  - **Correção sugerida:** Substituir por "Delete / Retrocesso" ou utilizar ícones/símbolos de teclado acompanhados de descrição em português.

- **frontend/src/components/report-canvas/inspector/fields/GeometryFields.tsx:235**
  - **Gravidade:** menor
  - **O que está errado:** Campo técnico de identificador exibe UUID/slug em campo de formulário com rótulo "Identificador do bloco".
  - **Correção sugerida:** Mover esse identificador interno para a área de depuração/inspeção avançada ou exibi-lo como texto de apoio discreto.

---

## 2. Botões/ícones sem rótulo acessível e campos sem label

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:550**
  - **Gravidade:** importante
  - **O que está errado:** O campo `<input type="search">` de busca no catálogo não possui `aria-label` nem `<label>` dedicado, e está contido indevidamente dentro do `<label>` do `<Select>` subsequente.
  - **Correção sugerida:** Adicionar `aria-label="Buscar relatório por nome ou código"` ao input e retirá-lo de dentro do `<label>` do seletor de relatórios.

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:623**
  - **Gravidade:** importante
  - **O que está errado:** O campo de texto `<input>` para o nome do parâmetro da fonte (`param.key`) não possui `<label>` associado nem `aria-label`.
  - **Correção sugerida:** Adicionar `aria-label={`Nome do parâmetro ${idx + 1}`}` ao campo de texto.

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:646**
  - **Gravidade:** importante
  - **O que está errado:** O campo de texto `<input>` para valor fixo do parâmetro (`param.fixedValue`) não possui `<label>` associado nem `aria-label`.
  - **Correção sugerida:** Adicionar `aria-label={`Valor fixo do parâmetro ${param.key || idx + 1}`}` ao input.

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:792**
  - **Gravidade:** importante
  - **O que está errado:** Os inputs das células da tabela de dados manuais (`gridRows`) não têm `aria-label`, `<label>` nem `title`.
  - **Correção sugerida:** Adicionar `aria-label={`Linha ${rIdx + 1}, Coluna ${gridColumns[cIdx]}`}` em cada input de célula.

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:749**
  - **Gravidade:** menor
  - **O que está errado:** O input de renomeação de coluna possui apenas `title="Nome da coluna"`, sem `aria-label` específico por coluna.
  - **Correção sugerida:** Incluir `aria-label={`Nome da coluna ${cIdx + 1}`}` no input do cabeçalho.

- **frontend/src/components/ReportCanvas.tsx:413**
  - **Gravidade:** menor
  - **O que está errado:** O `<input type="file" hidden>` de upload de imagem não tem `aria-label`.
  - **Correção sugerida:** Adicionar `aria-label="Upload de arquivo de imagem para o canvas"`.

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:699**
  - **Gravidade:** menor
  - **O que está errado:** O `<input type="file" hidden>` para upload de arquivo CSV manual não possui `aria-label`.
  - **Correção sugerida:** Adicionar `aria-label="Selecionar arquivo CSV para importar tabela"`.

---

## 3. Estados sem tratamento: carregando, vazio, erro

- **frontend/src/components/report-canvas/data/DataPanel.tsx:94**
  - **Gravidade:** bloqueia produção
  - **O que está errado:** Chamada `await onLoadStagePreview(src.id)` em `handleLoadPreview` não é envolvida por `try...catch`, permitindo que falhas assíncronas gerem exceções não tratadas na interface.
  - **Correção sugerida:** Envolver a chamada em bloco `try...catch`, registrando o erro no estado `previews` da fonte correspondente.

- **frontend/src/components/report-canvas/api/useSourcePreview.ts:275**
  - **Gravidade:** importante
  - **O que está errado:** Tratamento de erro faz fallback para mensagem genérica ("Erro ao carregar prévia.") quando a resposta não detalha a causa raiz.
  - **Correção sugerida:** Discriminar se o erro foi de indisponibilidade de rede, timeout na query SQL ou formato incompatível antes de adotar o fallback.

- **frontend/src/components/report-canvas/dialogs/usePreviewDialog.ts:103**
  - **Gravidade:** importante
  - **O que está errado:** Fallback genérico "Falha ao gerar prévia." oculta se o problema ocorreu por tempo limite, erro nos binds de SQL ou falha na renderização de PDF/XLSX.
  - **Correção sugerida:** Extrair códigos de erro estruturados retornados pela API (como `source_query_timeout` ou `column_not_found`) para exibir instruções corretivas ao usuário.

- **frontend/src/components/report-canvas/data/ColumnOrigin.tsx:23**
  - **Gravidade:** menor
  - **O que está errado:** O erro capturado na consulta de origem é exibido diretamente via `(exc as Error).message`, podendo expor mensagens técnicas internas da rede/fetch.
  - **Correção sugerida:** Tratar a mensagem de erro com um conversor amigável em português simples antes de exibi-la no estado `error`.

---

## 4. Lugares onde JSON cru aparece para o usuário comum

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:927**
  - **Gravidade:** bloqueia produção
  - **O que está errado:** A especificação da fonte é impressa na íntegra como JSON serializado dentro de um elemento `<pre className="cv-json-preview">` no modal de edição de fontes.
  - **Correção sugerida:** Remover a exibição do bloco `<pre>` com JSON cru ou restringi-lo exclusivamente a ambiente de desenvolvimento sob feature flag de depuração.

- **frontend/src/components/report-canvas/dialogs/JsonEditorDialog.tsx:27**
  - **Gravidade:** importante
  - **O que está errado:** O diálogo expõe um `<textarea>` com o JSON cru de todo o layout do relatório e permite edição direta do payload sem interface gráfica.
  - **Correção sugerida:** Restringir o acesso a esse diálogo a administradores ou transferi-lo para ferramenta externa de diagnóstico.

- **frontend/src/components/report-canvas/dialogs/PreviewDialog.tsx:112**
  - **Gravidade:** menor
  - **O que está errado:** Ao reportar falhas de blocos na prévia, o identificador técnico interno do bloco (`err.blockId`) é exibido dentro de `<code>`.
  - **Correção sugerida:** Exibir o título legível do bloco em vez do seu identificador técnico interno.

- **frontend/src/components/report-canvas/data/ColumnOrigin.tsx:35**
  - **Gravidade:** menor
  - **O que está errado:** A consulta SQL bruta gerada pelo banco de dados é exibida em `<pre>` formatado para o usuário comum.
  - **Correção sugerida:** Exibir um resumo funcional amigável da linhagem dos dados (tabela de origem, filtros e coluna mapeada) em vez do código SQL cru.

---

## 5. Cores/valores fixos que quebram no tema escuro; larguras fixas que quebram a 1100 px

- **frontend/src/components/report-canvas/layout.css:260, 269**
  - **Gravidade:** bloqueia produção
  - **O que está errado:** O skeleton de carregamento usa cores fixas (`background: #ffffff` e `background: #e2e8f0`), causando clarão branco cegante no tema escuro.
  - **Correção sugerida:** Substituir os valores hexadecimais fixos pelos tokens CSS de superfície e linha (`var(--cv-surface)` e `var(--cv-line)`).

- **frontend/src/components/report-canvas/stage.css:351, 376-377, 389, 401**
  - **Gravidade:** bloqueia produção
  - **O que está errado:** Título do bloco (`color: #262626`), cabeçalhos de tabela (`background: #ededed`, `color: #262626`), células (`color: #262626`) e zebrado (`background: #f5f5f5`) usam cores fixas claras/escuras que perdem contraste em folhas com fundo escuro.
  - **Correção sugerida:** Utilizar tokens que reajam à propriedade `data-page-tone="dark"` na folha, ajustando cor do texto para claro e cabeçalhos para tons translúcidos.

- **frontend/src/components/report-canvas/stage.css:417**
  - **Gravidade:** importante
  - **O que está errado:** O placeholder de bloco de dados (`.cv-sql-placeholder`) possui fundo fixo `#f5f5f5`, que se destaca negativamente quando a página tem fundo escuro.
  - **Correção sugerida:** Definir fundo adaptativo dependente de `data-page-tone` ou usar cor neutra translúcida.

- **frontend/src/components/report-canvas/data/DataPanel.tsx:678**
  - **Gravidade:** menor
  - **O que está errado:** Botão de confirmação de exclusão utiliza `color: "#fff"` hardcoded no estilo inline.
  - **Correção sugerida:** Substituir a cor fixa por `var(--cv-on-accent)` ou classe CSS padronizada.

- **frontend/src/components/report-canvas/dialogs.css:96, 246**
  - **Gravidade:** menor
  - **O que está errado:** Em telas de 1100px, o diálogo expandido de prévia (`width: min(1400px, calc(100vw - 48px))`) ocupa 1052px e comprime a coluna lateral de parâmetros (`flex-basis: 240px`), exigindo rolagem horizontal em nomes longos.
  - **Correção sugerida:** A 1100px ou menos, empilhar verticalmente os parâmetros acima da prévia ou permitir recolher o painel de filtros.

---

## 6. Código morto, TODOs, console.log esquecidos, dados de exemplo ligados por padrão

- **frontend/src/components/ReportCanvas.tsx:82**
  - **Gravidade:** bloqueia produção
  - **O que está errado:** `showSampleData` é inicializado como `true` por padrão para qualquer relatório que não possua a flag legada `preview` (`initialCanvas?.default_data_mode !== "preview"`), exibindo dados sintéticos de teste por padrão.
  - **Correção sugerida:** Inicializar `showSampleData` como `false` por padrão, priorizando a exibição dos dados reais da fonte.

- **backend/operations/report_canvas/api.py:147**
  - **Gravidade:** bloqueia produção
  - **O que está errado:** A API define `default_data_mode = "sample"` por padrão, forçando o editor a abrir em modo de amostra sintética para novos relatórios.
  - **Correção sugerida:** Definir `"preview"` como valor padrão de `default_data_mode`.

- **frontend/src/components/report-canvas/task18-loading.cjs:75, 101, 109**
  - **Gravidade:** importante
  - **O que está errado:** Script de automação Playwright (`task18-loading.cjs`) foi salvo dentro do diretório de componentes React de produção e contém chamadas a `console.log` e `console.error`.
  - **Correção sugerida:** Mover o arquivo para o diretório de scripts ou testes (`scripts/` ou `tests/`) e removê-lo do pacote do frontend.

- **frontend/src/components/report-canvas/BlockPreview.tsx:1-2**
  - **Gravidade:** menor
  - **O que está errado:** Arquivo shim redundante que apenas reexporta `./blocks/BlockPreview`.
  - **Correção sugerida:** Atualizar os imports antigos para apontar diretamente para `./blocks/BlockPreview` e excluir este arquivo.

- **frontend/src/components/report-canvas/sampleData.ts:1-2**
  - **Gravidade:** menor
  - **O que está errado:** Arquivo shim redundante que apenas reexporta `./placeholderData`.
  - **Correção sugerida:** Substituir os imports de `sampleData` por `placeholderData` e remover o arquivo wrapper.

- **frontend/src/components/report-canvas/problems.ts e shell/problems.ts**
  - **Gravidade:** importante
  - **O que está errado:** Duplicação estrutural de lógica de diagnóstico entre `problems.ts` (35 KB) e `shell/problems.ts` (8 KB), gerando dois motores de cálculo e tipagens concorrentes (`Problem` vs `CanvasProblemItem`).
  - **Correção sugerida:** Unificar os dois módulos em um único ponto canônico de validação de regras do Canvas.

---

## 7. Itens que contrariam o AGENTS.md

- **frontend/src/components/report-canvas/data/ParameterEditor.tsx:27-40**
  - **Gravidade:** bloqueia produção
  - **O que está errado:** Contraria a regra que proíbe formulários de edição abertos na tela principal ("Não deixar formulários de cadastro ou edição abertos nas telas principais. Cadastros e configurações começam por um botão Adicionar, Configurar ou Editar e abrem em modal ou formulário dedicado"). Ao clicar em "Editar parâmetros", o formulário expande controles inline dentro do `DataPanel`.
  - **Correção sugerida:** Abrir a edição e seleção de parâmetros em um modal `InlineDialog` dedicado, fechando-o apenas após confirmação.

- **frontend/src/components/report-canvas/data/ParameterEditor.tsx:24, 37**
  - **Gravidade:** importante
  - **O que está errado:** Utiliza `window.confirm()` nativo do navegador para confirmação de exclusão e renomeação de parâmetros, violando a exigência de usar `FormAction` ou `InlineDialog`.
  - **Correção sugerida:** Substituir as chamadas de `window.confirm` por diálogo de confirmação via `InlineDialog`.

- **frontend/src/components/report-canvas/dialogs/JsonEditorDialog.tsx:12, 17**
  - **Gravidade:** importante
  - **O que está errado:** Utiliza diálogos bloqueantes nativos `window.confirm()` para descarte e aplicação do JSON, violando o AGENTS.md.
  - **Correção sugerida:** Substituir os `window.confirm()` por estado de confirmação na própria barra de ações (`footer`) do modal.

- **frontend/src/components/report-canvas/data/DataPanel.tsx:619-685**
  - **Gravidade:** importante
  - **O que está errado:** Contraria a regra "Reutilizar FormAction e InlineDialog". O diálogo de confirmação de exclusão de fonte foi montado manualmente com tags `<div>` e `<header>` cruas em vez de instanciar o componente `<InlineDialog>`.
  - **Correção sugerida:** Refatorar a confirmação de exclusão de fonte para utilizar `<InlineDialog>` com o rodapé na prop `footer`.

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:400**
  - **Gravidade:** menor
  - **O que está errado:** Subtítulo longo e explicativo ("Confirmar aplica a fonte ao rascunho. Cancelar descarta esta edição. O relatório só é gravado ao salvar o Canvas.") viola a regra que proíbe avisos permanentes genéricos e explicações óbvias.
  - **Correção sugerida:** Deixar `subtitle=""` no modal `SourceDialog`, mantendo apenas o título conciso.

- **frontend/src/components/report-canvas/data/SourceDialog.tsx:537-578**
  - **Gravidade:** menor
  - **O que está errado:** O elemento `<label className="op-field">` envolve conjuntamente dois controles (campo de busca e `<Select>`), quebrando o isolamento de formulários recomendado.
  - **Correção sugerida:** Separar a barra de busca e o seletor em blocos de campos distintos com rótulos individuais.

---

## Veredito Final

**O código está apto para produção?**  
**NÃO.**

**Por quê:**  
1. **Dados de exemplo (sampleData) ativos por padrão (Bloqueia produção):** Tanto o backend (`api.py:147`) quanto o frontend (`ReportCanvas.tsx:82`) foram construídos para entregar e inicializar o editor em modo de dados sintéticos (`sample`), o que pode induzir gestores e usuários finais a tomarem decisões operacionais baseadas em dados fictícios ao invés de dados reais da unidade.  
2. **Falha de robustez assíncrona (Bloqueia produção):** A requisição de prévia de dados em `DataPanel.tsx:94` é executada sem tratamento de exceção (`try/catch`), podendo quebrar o fluxo de renderização da barra lateral diante de instabilidade no servidor.  
3. **Quebra visual no tema escuro (Bloqueia produção):** Cores hexadecimais fixas (`#ffffff`, `#e2e8f0`, `#262626`, `#ededed`, `#f5f5f5`) nos arquivos `layout.css` e `stage.css` causam clarões cegantes no skeleton de carregamento e tornam títulos e tabelas ilegíveis sobre folhas escuras.  
4. **Vazamento de JSON cru na interface (Bloqueia produção):** O diálogo de fontes expõe a especificação inteira serializada em tag `<pre>` diretamente para o usuário, e a barra superior expõe um botão de edição manual de JSON layout.  
5. **Violações expressas de diretrizes de design do AGENTS.md:** O `ParameterEditor.tsx` renderiza formulários e ações de edição diretamente na tela principal e recorre a popups nativos `window.confirm()`, enquanto o diálogo de exclusão de fontes em `DataPanel.tsx` reimplementa marcação HTML manual ao invés de reutilizar o componente oficial `InlineDialog`.  
6. **Código e artefatos de teste na árvore de produção:** Presença de scripts Node/Playwright com `console.log` e shims redundantes no pacote do frontend.

FIM-TAREFA-25
