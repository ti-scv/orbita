# Tarefa 22 — Correção de bugs visuais no editor Canvas e listas de relatórios

28/10/2026. Trabalho executado exclusivamente via SSH no servidor `root@172.16.0.59`, em `/opt/orbita`, branch `feature/canvas-redesign`.
Apenas commits locais, sem push. Sem alterações no backend (`backend/operations/`), sem alteração em arquivos de outras sessões (`Login.tsx`, `SourceDialog.tsx`, `stage/geometry.ts`, `stage/pageOps.ts`), e sem modificação do painel de produção ou criação/exclusão de relatórios reais.

---

## 1. Contexto e Objetivos

A Tarefa 22 teve como foco uma varredura fina de qualidade visual e de usabilidade em todo o editor Canvas e nas listas/tabelas de relatórios operacionais:
1. **Paginação sem respiro**: Controles de navegação de página ("Próximo", número da página, contadores) colados na borda inferior/lateral dos contêineres nas listagens de relatórios e prévias.
2. **Alturas descasadas de botões**: Botões de ação com alturas heterogêneas no mesmo alinhamento horizontal (ex.: botão "Salvar" de 32px ao lado de botões de 28px na TopBar do Canvas; botões de confirmação de 32px ao lado de "Cancelar" de 28px em rodapés de diálogos).
3. **Textos cortados sem elipse**: Rótulos e abas sofrendo truncamento abrupto no meio de caracteres (`text-overflow: clip`).
4. **Desalinhamentos e saltos de layout**: Cabeçalhos de painéis com alturas variáveis (ex.: painel de dados com ~52px vs 36px nos demais painéis).
5. **Espaçamentos e respiro em listas**: Itens de lista com margens laterais desiguais pressionando botões contra a borda.
6. **Acessibilidade e navegação por teclado**: Falta de anéis de foco (`:focus-visible`) em campos de entrada, busca e botões interativos após remoção de `outline`.
7. **Contraste e legibilidade em temas claro e escuro**: Estados desabilitados (`:disabled`) com opacidade acumulada tornando o texto e ícones ilegíveis (contraste inferior a 1.5:1 no tema escuro).

---

## 2. Relação de Bugs Identificados e Correções Aplicadas

### A. Paginação e Listas de Relatórios
- **`frontend/src/reports.css`**:
  - *Problema*: Na visualização do workspace de relatórios (`.report-workspace`) e prévias/snapshots (`.snapshot-workspace > .report-actions`), os controles de paginação ficavam colados nas bordas do contêiner e sem linha divisória superior.
  - *Correção*: Criada estilização dedicada para `.report-workspace .op-pager` e `.snapshot-workspace > .report-actions` com `padding: 14px 22px;`, `border-top: 1px solid var(--border-default)`, `display: flex`, `justify-content: space-between;` e `gap: 12px;`.
  - *Foco e tema escuro*: Adicionado anel visível `:focus-visible` (`outline: 2px solid var(--brand-cyan)`) e regra de contraste para botões desabilitados no tema escuro (`[data-theme="dark"] .report-workspace .op-pager .button:disabled`).
- **`frontend/src/operations.css`**:
  - *Problema*: A regra global `.op-pager` aplicava `padding: 12px 0;`, fazendo com que os botões "Anterior" e "Próximo" tocassem as extremidades esquerda e direita dos contêineres e cartões.
  - *Correção*: Ajustado para `padding: 12px 20px;`, adicionado foco com `:focus-visible` e cursor apropriado com `opacity: 0.55` para estados `:disabled`.
- **`frontend/src/components/recipient-manual-reports.css`**:
  - *Problema*: Na paginação da busca manual de relatórios (`.recipient-report-search-pages`), não havia margem vertical adequada nem padronização na altura dos botões de troca de página.
  - *Correção*: Adicionado `padding: 8px 0;` e botões padronizados em `min-height: 30px; padding: 5px 10px; font-size: 12px;`.

### B. Barra Superior do Canvas (TopBar)
- **`frontend/src/components/report-canvas/shell.css`**:
  - *Problema*: Na barra superior (`cv-topbar`), todos os controles (alternador de páginas, botões de ação rápida, zoom, botão de tema) possuem altura padronizada de 28px (`--cv-h-control`). No entanto, o botão principal "Salvar" (`.cv-btn-primary`) herdava 32px (`--cv-h-control-lg`), criando um desnível vertical perceptível.
  - *Correção*: Definida a regra `.cv-root .cv-topbar .cv-btn-primary { height: var(--cv-h-control); min-height: var(--cv-h-control); padding: 0 var(--cv-sp-2); font-size: var(--cv-fs-sm); }` (28px), alinhando toda a barra superior uniformemente.

### C. Abas do Rail Lateral (Navegação Esquerda)
- **`frontend/src/components/report-canvas/shell.css`**:
  - *Problema*: Os rótulos de texto das abas laterais (`.cv-rail-tab-label`) utilizavam `text-overflow: clip`, gerando corte feio de caracteres ao meio em telas ou zooms específicos.
  - *Correção*: Alterado para `text-overflow: ellipsis;`, garantindo reticências suaves quando o rótulo exceder a largura do botão de aba.

### D. Cabeçalhos de Painéis Laterais
- **`frontend/src/components/report-canvas/data.css`**:
  - *Problema*: Enquanto os painéis de Biblioteca, Árvore de Páginas e Assets usavam cabeçalho com altura fixa de 36px (`flex: 0 0 36px`), o painel de dados (`.cv-data-head`) utilizava `padding: var(--cv-sp-3) var(--cv-sp-3)` resultando em altura total de ~52px. Ao alternar para a aba "Dados", a interface sofria um solavanco de altura perceptível.
  - *Correção*: Atualizado `.cv-data-head` para `flex: 0 0 36px; height: 36px; min-height: 36px; gap: 4px; padding: 0 6px 0 10px; min-width: 0;`, padronizando o cabeçalho em exatamente 36px em harmonia com todas as outras abas.

### E. Lista de Páginas no Painel
- **`frontend/src/components/report-canvas/library.css`**:
  - *Problema*: Na lista de páginas (`.cv-page-row`), o espaçamento interno era assimétrico (`padding: 2px 4px 2px var(--cv-sp-2);`), empurrando o botão de remover página contra o limite direito do item.
  - *Correção*: Padronizado para `padding: 2px var(--cv-sp-2);` (8px simétricos em ambos os lados), oferecendo respiro uniforme.

### F. Rodapés e Campos em Diálogos Modais
- **`frontend/src/components/report-canvas/dialogs.css`**:
  - *Problema*: Em subdiálogos modais (ex.: `PageConfigDialog`, `PreviewDialog`), o botão de ação principal (`.cv-btn-primary`) utilizava altura de 32px enquanto o botão "Cancelar" ou "Fechar" utilizava 28px (`var(--cv-h-control)`). Além disso, campos de entrada (`select` e `input`) não tinham anéis de foco consistentes.
  - *Correção*:
    1. Padronizados `.modal.inline-dialog.cv-subdialog .cv-btn` e `.cv-btn-primary` com `height: var(--cv-h-control); min-height: var(--cv-h-control); padding: 0 var(--cv-sp-3);`.
    2. Padronizados botões na barra de teste de fonte (`.cv-test-result-bar .cv-btn-primary`).
    3. Campos em `.modal.inline-dialog.cv-subdialog .op-field :is(select, input)` padronizados em 28px de altura com foco `:focus-visible` com `outline: 2px solid var(--cv-focus)`.

### G. Foco Visível para Navegação por Teclado e Acessibilidade
- **`frontend/src/components/report-canvas/data.css`**:
  - *Problema*: Campos de busca (`.cv-search-input`) e campos na grade de parâmetros (`.cv-grid-input`) definiam `outline: none;` sem anel substituto no `:focus`.
  - *Correção*: Adicionado `outline: 2px solid var(--cv-focus); outline-offset: 1px;` no `:focus-visible`.
  - *Ícones de ação*: Adicionado `:focus-visible` em `.cv-icon-btn`.
- **`frontend/src/components/report-canvas/inspector.css`**:
  - *Problema*: Botões de alinhamento (`.cv-align-btn`) não tinham anel de foco para teclado.
  - *Correção*: Adicionado `.cv-root .cv-align-btn:focus-visible { outline: 2px solid var(--cv-focus); outline-offset: 1px; }`.

### H. Legibilidade de Estados Desabilitados no Tema Escuro
- **`frontend/src/components/report-canvas/shell.css` e `inspector.css`**:
  - *Problema*: Em botões segmentados desabilitados no tema escuro, a regra `[data-theme="dark"] .cv-root .cv-seg-btn:disabled` acumulava `color: var(--cv-text-disabled)` (`#566273`) com `opacity: 0.45`, rebaixando o contraste contra o fundo escuro para valores abaixo de 1.5:1, tornando o rótulo ilegível.
  - *Correção*: Alterada opacidade para `opacity: 1`, mantendo a cor semafórica de texto desabilitado com contraste legível.
- **`frontend/src/components/report-canvas/library.css`**:
  - *Problema*: Botões de ícone de painel desabilitados (`.cv-panel-icon-btn:disabled`) possuíam `opacity: 0.55` empilhada sobre a cor desabilitada.
  - *Correção*: Ajustado para `opacity: 1;`.
- **`frontend/src/components/report-canvas/data.css` e `inspector.css`**:
  - *Problema*: Botões `.cv-icon-btn:disabled` e `.cv-align-btn:disabled` não tinham regras visuais completas de desabilitado.
  - *Correção*: Adicionada estilização explícita com `color: var(--cv-text-disabled); opacity: 0.6; cursor: not-allowed;`.

---

## 3. Testes Automatizados e Validação

1. **Novo arquivo de teste unitário**:
   - `frontend/src/components/report-canvas/task22.test.tsx`:
     - Validação das regras de paginação em `reports.css` e `operations.css` (padding, border-top, focus-visible).
     - Validação do alinhamento de altura do botão primário na TopBar (28px).
     - Validação do cabeçalho unificado de 36px no DataPanel.
     - Validação de foco visível em campos de busca e grade de parâmetros.
     - Validação de contraste desabilitado no tema escuro sem dupla opacidade.
     - Validação de padronização de botões nos modais e diálogos.

2. **Execução completa de verificação (`scripts/canvas-check.sh`)**:
   - `npm ci`: Concluído com sucesso (Node 24).
   - `canvas hooks`: Concluído com sucesso.
   - `tsc -b`: 0 erros de compilação TypeScript.
   - `vitest run`: Todos os testes unitários aprovados (508 testes no total).
   - `vite build`: Build de produção do frontend concluído com sucesso.
