# Tarefa 16 — bugs visuais e detalhes do Canvas

27/10/2026. Trabalho feito exclusivamente via `ssh scv59`, em `/opt/orbita`,
branch `feature/canvas-redesign`. Base conferida: tarefa 15,
`3c5e30877ace0264615be8403ccf8b45e09abc8e`.
Somente commit local. Sem push, migrate, implantação em 8080, alteração do
login customizado ou reescrita de `4d039ac`. O checkout do servidor 82 em
`/home/danilo/vet-app` não foi acessado. O AGENTS.md remoto foi seguido.

## Causas e correções

1. **Colunas sem espaço para o caminho.** O checklist era uma lista flex;
   cada item também usava flex com quebra de linha, mas podia encolher dentro
   da lista com altura máxima de 220 px. O nome, badge, checkbox, caminho e
   ações disputavam o espaço. No browser, todas as 64 linhas inspecionadas
   tinham 28 px e conteúdo passando dos limites. Agora nome e caminho têm
   um contêiner próprio, com duas linhas de 16 px e intervalo de 2 px.
   Cada item reserva no mínimo 48 px, não encolhe e mantém os controles
   alinhados verticalmente, com intervalo de 8 px. O caminho fica em uma
   linha, com reticências e `title` completo. Os controles continuam compactos.
2. **Exemplos de data em ISO.** DataPanel e ColumnSelect exibiam `sample[0]`
   diretamente. Agora usam o formatador já compartilhado com a gaveta:
   `2026-09-21 00:00:00` → `21/09/2026`;
   `2026-09-21 14:35:10` → `21/09/2026 14:35`.
   Não há conversão de fuso; meia-noite fica sem hora. Valores zero são
   preservados e os tooltips mostram o valor formatado.
3. **Clique em Dados.** A aba chamava `selectLibrary`, que alterna a abertura
   quando a aba solicitada já é a selecionada. Reproduzido: clique em Dados
   aberto → painel fechado e nenhuma aba selecionada → clique seguinte reabre.
   As setas do teclado já usavam `openLeftPanel`, que sempre abre a aba.
   O clique agora segue a mesma ação de abertura. Repetir a seleção mantém
   o painel aberto; recolher continua disponível no controle do painel.
   A troca de outra aba para Dados passou no primeiro clique antes e depois;
   não foi reproduzida uma segunda causa independente desse fechamento.
4. **Outros achados da varredura:**
   - Ações da fonte apareciam sobre o nome no hover. Agora têm linha própria
     com botões de 24 px, sem encobrir título ou caminho.
   - Linhas das colunas da fonte tinham altura fixa de 28 px. Passaram a
     mínimo de 32 px, line-height de 16 px e sem compressão flex.
   - Opções do seletor de fonte tinham subtítulo sem limite de largura.
     Agora reservam 48 px, truncam título/subtítulo e preservam o texto
     completo no tooltip, inclusive com nomes longos.
   - Lista de blocos ganhou mínimo de 44 px, separação de 3 px entre nome e
     linhagem e line-height de 16 px. Tooltips existentes foram preservados.
   - Gaveta: cabeçalho não encolhe, título trunca com tooltip e células têm
     line-height de 18 px. Rolagem horizontal da tabela permanece disponível.

## QA visual e capturas

Playwright/Chromium no staging: relatórios **6 e 8**, temas **claro e escuro**,
larguras **1100 e 1440 px**, altura 1000 px. Oito combinações com os layouts
existentes e outras oito com rótulos longos equivalentes à descrição do bug
(`AME JALES - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP`).

As capturas usam os layouts reais, mas todos os valores de prévia são
substituídos **antes de renderizar** por `Exemplo QA`, números de teste e
`21/09/2026`. Nenhum nome de paciente, telefone ou valor operacional foi
incluído nas capturas. A imagem original mencionada na tarefa não estava
disponível; a comparação foi feita com a imagem do staging preservada antes
das alterações. As capturas completas e dos painéis foram inspecionadas.

Evidências somente no Orbita, em `.canvas-task16-shots/`, ignorado pelo Git:

| Área | Antes | Depois |
| --- | --- | --- |
| Colunas, 1100 claro | `before-6-1100-light-columns.png` | `after-6-1100-light-columns.png` |
| Colunas, 1440 escuro | `before-8-1440-dark-columns.png` | `after-8-1440-dark-columns.png` |
| Fontes, 1100 claro | `before-6-1100-light-sources.png` | `after-6-1100-light-sources.png` |
| Seletor, 1100 escuro | `before-8-1100-dark-picker.png` | `after-8-1100-dark-picker.png` |
| Blocos, 1100 claro | `before-6-1100-light-blocks.png` | `after-6-1100-light-blocks.png` |
| Gaveta, 1100 claro | `before-6-1100-light-drawer.png` | `after-6-1100-light-drawer.png` |
| Canvas completo | `before-6-1100-light-canvas.png` | `after-6-1100-light-canvas.png` |
| Caminho longo | `long-before-6-1100-light-columns.png` | `long-after-6-1100-light-columns.png` |

O mesmo padrão de nomes cobre todos os relatórios, temas e larguras.
Resumos: `before-browser.json`, `after-browser.json`, `long-before-browser.json`
e `long-after-browser.json`. Em cada conjunto, 64 linhas de colunas:

| Medida | Antes | Depois |
| --- | --- | --- |
| Altura de cada linha | 28 px | 48 px |
| Linhas com overflow vertical | 64 | 0 |
| Caminhos fora dos limites do item | 64 | 0 |

Após a correção: caminho em uma linha com tooltip em todas as linhas,
exemplos de datas localizados, sem sobreposição das ações da fonte sobre o
nome, sem overflow horizontal da página. Zero erros de JavaScript.
Nenhuma outra sobreposição foi observada nas capturas completas revisadas.
A tabela mantém rolagem horizontal e o checklist mantém rolagem vertical;
reticências e recorte na borda da área rolável são comportamentos esperados.

O QA bloqueia escritas, permitindo apenas GET e o POST de consulta
`canvas-source-preview`. Configurações GET antes/depois idênticas em todos
os cenários. Nenhum salvamento de relatório foi feito.

Reprodução: `scripts/canvas-task16-qa.cjs` com a imagem
`orbita-canvas-stage-qa09-tools:latest`, rede host, scripts em `/work`,
saída em `/evidence`, sessão existente em `/private/session.json`.
`PHASE=before`/`QA_BASE` permitem comparar a versão anterior;
`LONG_LABELS=1` ativa o cenário de texto longo. O arquivo de sessão fica em
mount privado, nunca no Git ou no relatório.

## Tempo de abertura do relatório 6

Três contextos Chromium novos por versão, sem cache de navegador, em 1440 px,
com API real. Tempos desde a navegação até o primeiro bloco e até terminar a
consulta dos dados reais. Sem reiniciar workers, banco ou limpar caches do
servidor. Não mede acesso externo nem a primeira consulta de um worker novo.

| Medida (ms) | Tarefa 15 | Tarefa 16 |
| --- | --- | --- |
| Editor | 1265 / 1320 / 1245 | 1380 / 1378 / 1328 |
| Dados reais | 1786 / 1645 / 1584 | 1765 / 1781 / 1705 |
| Mediana editor | 1265 | 1378 |
| Mediana dados reais | 1645 | 1765 |

Não foi reproduzida abertura acima de 10 s. As diferenças pequenas destas
amostras não demonstram uma regressão causal. Dados brutos sem conteúdo de
relatório em `timing-task15.json` e `timing-task16.json`; roteiro
`scripts/canvas-task16-timing.cjs`. A medição não usa as respostas sintéticas
empregadas nas capturas.

## Verificações

- `scripts/canvas-check.sh`: hooks, TypeScript, **488 testes Vitest** e build
  verdes. Cinco testes novos: primeiro clique/reseleção/reabertura, setas +
  clique, preferência recolhida, exemplos no painel e no seletor.
- Pytest: **144 passaram**, em banco de testes isolado. Antes de cada execução
  foi verificada a ausência de container `orbita-tests-run` rodando.
  Executados os seis arquivos: `test_report_canvas.py`,
  `test_report_canvas_ports.py`, `test_canvas_preview_columns.py`,
  `test_canvas_chart_grouping.py`, `test_canvas_source_preview.py` e
  `test_canvas_task08.py`. Logs `pytest.log` (74) e `pytest-extra.log` (70).
- Staging reconstruído por `scripts/canvas-stage.sh up`, porta **8091**,
  HTTP **200**. A versão anterior foi preservada para comparação em staging
  separado, também criado pelo script, sem alterar serviços de produção.
- Logs finais: `check-final-tree.log`, `stage-final-tree.log`. O aviso já
  existente de bundle acima de 500 kB permanece.
- `git diff --check`, revisão do diff e seleção interativa por arquivo/hunk
  antes do commit. Nenhuma credencial ou captura incluída no commit.

## Preservação da árvore compartilhada

Hashes dos 14 arquivos alheios foram registrados antes das edições e
comparados ao final: nenhum mudou. Não houve revert, stash ou inclusão
desses arquivos no commit. O staging e os testes usam a árvore compartilhada,
incluindo as mudanças da outra sessão, como solicitado.

Preservados: os sete arquivos Python de `backend/operations` indicados na
tarefa, `BlockPreview.tsx`, `AppearanceFields.tsx`, `model.ts`, `stage.css`,
`geometry.ts`, `pageOps.ts` e `backend/tests/test_report_neutral_style.py`.
Nenhum arquivo de backend foi modificado por esta tarefa.

O commit local pode ser identificado com
`git log -1 --oneline -- docs/canvas-task16-qa.md`.
