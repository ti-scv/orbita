# Tarefa 28 — QA8 (parcial)

## Alterações realizadas

- As linhas de colunas usam grade compacta, apresentam nome, tipo e exemplo, e limitam a origem com reticências e tooltip. O diálogo de origem apresenta nome amigável, tipo traduzido e grade de rótulos e valores.
- Rótulos de ações e parte das mensagens usam o nome amigável; a contagem do painel e da gaveta explica que usa os parâmetros atuais. A prévia do editor informa que usa parâmetros configurados e padrões omitidos. O tooltip do palco usa separador pt-BR.
- O formatador traduz estados adicionais encontrados nos modelos de operações e mensagens; identificadores desconhecidos com sublinhado são exibidos com espaços. O backend identifica parâmetros desconhecidos e lista os válidos.
- A prévia do editor recebeu marcas de desempenho e cancelamento de requisição anterior. O aviso de alteração tem espaçamento.

## Verificação

- `scripts/canvas-check.sh`: 522 testes, lint de hooks, TypeScript e build passaram, log `/tmp/canvas-task28-check-final3.log`.
- Backend com SQLite isolado: 34 testes em `test_report_pagination.py` e `test_report_canvas.py` passaram, log `/tmp/canvas-task28-backend.log`.
- API `orbita-canvas-task26-api` reiniciada e staging 8091 reconstruído. Curl retornou o bundle `ReportCanvas-9MN4mN4d.js` (292.893 bytes). A configuração da API usa um worker Gunicorn e timeout de 120 s; não há medição que demonstre que ele causou a latência relatada.
- A matriz foi ampliada para abrir as colunas no painel padrão, mas a execução falhou antes de abrir o navegador: Node não encontrou `playwright` (`/tmp/canvas-task28-matrix.log`). As capturas antigas não são evidência desta rodada.

## Pendências

A tarefa não está concluída. Falta validar visualmente a grade nas três larguras e dois temas, produzir novas capturas e avaliar se há sobreposição ou recorte. Falta completar a tradução de identificadores e erros em todos os pontos, a indicação exata de parâmetros efetivamente aplicados, a máscara e validação de data fixa, o cache/esqueleto de origem, o comportamento e rótulo do zoom, e a investigação dos erros de console. Não foi comprovida a lista completa de estados, nem a regra para todos os valores desconhecidos. Não há medições ponta a ponta reais para explicar os 6,2 s ou comprovar abertura em até 3 s. As marcas adicionadas não substituem essas medições. Não houve salvamento ou ativação no staging, push ou migração; Login.tsx e a auditoria preexistente foram preservados.

FIM-TAREFA-28 — execução parcial; pendências acima.


## Continuação 28b — andamento parcial

- Zoom inicial fixo em 85%; mudanças dos painéis não executam mais ajuste automático. O botão Ajustar recalcula a largura ao ser acionado.
- Origem mostra esqueleto e usa cache de 30 segundos, iniciado ao focar ou passar o ponteiro no botão. A pré-busca ao abrir a gaveta ainda não foi implementada.
- Removido o identificador técnico ao lado do nome na lista; o título usa o nome apresentado. A revisão completa de nomes e erros ainda falta.
- `scripts/canvas-check.sh`: 522 testes, lint, TypeScript e build passaram (`/tmp/canvas-task28b-check.log`). Backend SQLite isolado: 34 testes passaram (`/tmp/canvas-task28b-backend.log`). Staging reconstruído; curl identifica `ReportCanvas-BErVKTP0.js`.
- Logs disponíveis da API nas últimas 24 horas não mostraram as ocorrências de 502 ou 400; não é possível concluir a causa. Ainda falta investigar chamadas de validação.
- Matriz sintética: 12 cenários, quatro capturas por cenário, em `docs/canvas-qa-prints/t28b-*` e `/tmp/qa-prints/`. Nenhum erro de navegação ou rolagem horizontal do documento. O detector reportou uma sobreposição em cada cenário de 1280 e 1440 e 32 textos truncados em cada cenário; ainda precisam de inspeção e correção/justificativa. Não houve análise visual suficiente para declarar a matriz aprovada.

| Relatório | Largura | Temas | Abertura sintética (ms, claro/escuro) | Sobreposições por tema |
|---|---:|---|---|---:|
| 6 | 1440 | claro/escuro | 1156 / 965 | 1 |
| 6 | 1280 | claro/escuro | 988 / 955 | 1 |
| 6 | 1100 | claro/escuro | 1043 / 945 | 0 |
| 1 | 1440 | claro/escuro | 991 / 936 | 1 |
| 1 | 1280 | claro/escuro | 950 / 1216 | 1 |
| 1 | 1100 | claro/escuro | 993 / 1056 | 0 |

Esses tempos usam respostas sintéticas sem atrasos realistas e não medem a API real nem prévia com/sem cache. Permanecem pendentes máscara e validação da data, parâmetros efetivamente aplicados, tabela completa de estados e testes, cobertura completa de nomes, pré-busca ao abrir a gaveta, investigação de validação e desempenho, medições reais e revisão/correção visual. A tarefa não está concluída.

FIM-TAREFA-28 — continuação parcial; pendências acima.

## Continuação 28c — execução parcial

- A comparação de sobreposições agora considera a parte das caixas visível após o recorte por ancestrais roláveis: a ocorrência anterior era entre um botão de origem recortado e a barra de status, não entre partes visíveis. O truncamento encontrado é o texto longo da origem, intencional, com reticências e tooltip com o nome completo. A matriz sintética final não detectou sobreposições visíveis, cortes sem tooltip/reticências, erros ou rolagem horizontal do documento. O detector não substitui inspeção humana exaustiva nem cobre todos os textos possíveis.
- Datas fixas: máscara DD/MM/AAAA, conversão para ISO, validação de datas inexistentes e bloqueio da confirmação/prévia enquanto inválidas. Testes unitários cobrem ano bissexto e valores inválidos.
- Nomes amigáveis foram ampliados para ações, confirmação de exclusão, prévia de tabela, KPI, gráficos, variáveis e erros de prévia. A auditoria completa de todas as mensagens e pontos ainda não foi concluída; os testes verificam o mapeamento de erro.
- A segunda execução de `scripts/canvas-check.sh` passou em hooks, TypeScript, testes e build (`/tmp/canvas-task28c-check-final.log`). Backend: 34 testes passaram em SQLite isolado (`/tmp/canvas-task28c-backend.log`).
- Staging reconstruído sem alteração do backend; curl identificou `ReportCanvas-CmlVPY5g.js`. Nenhum salvamento ou ativação de relatório foi feito.
- `JsonEditorDialog` chama canvas-validate ao clicar em “Validar e aplicar”; não há validação ao digitar. Os logs disponíveis não permitem atribuir os 400 anteriores a uma causa. Curl sem autenticação para session e as quatro rotas GET de relatórios 1 e 6 retornou 401 (0,486 s para session, 0,0036–0,0055 s para as demais); não são medidas de respostas autenticadas. Não se reproduziu nem explicou o 502.
- Pendentes: indicar valores efetivamente aplicados e padrões na prévia; verificar toda a formatação numérica e todos os nomes/erros; comprovar e testar todos os estados; pré-buscar origens ao abrir colunas; reproduzir e explicar os erros de staging; medir a cadeia autenticada e prévia com e sem cache e com atrasos realistas. Não foi demonstrada a meta de abertura. Os testes de data não cobrem ainda interação no navegador. As capturas a seguir são sintéticas, não evidência dos dados reais.

| Relatório | Largura | Tema | Abertura sintética (ms) | Sobreposições visíveis | Cortes não intencionais |
|---|---:|---|---:|---:|---:|
| 6 | 1440 | light | 1186 | 0 | 0 |
| 6 | 1440 | dark | 1219 | 0 | 0 |
| 6 | 1280 | light | 1097 | 0 | 0 |
| 6 | 1280 | dark | 1019 | 0 | 0 |
| 6 | 1100 | light | 1002 | 0 | 0 |
| 6 | 1100 | dark | 1033 | 0 | 0 |
| 1 | 1440 | light | 984 | 0 | 0 |
| 1 | 1440 | dark | 956 | 0 | 0 |
| 1 | 1280 | light | 962 | 0 | 0 |
| 1 | 1280 | dark | 957 | 0 | 0 |
| 1 | 1100 | light | 1018 | 0 | 0 |
| 1 | 1100 | dark | 1022 | 0 | 0 |

FIM-TAREFA-28 — execução parcial; pendências acima.

## Continuação 28d — execução parcial

- Prévia de fonte SQL retorna os parâmetros realmente resolvidos pelo motor, seus valores convertidos e indicação de padrão; relatórios operacionais do app mostram o período calculado pelo mesmo código da consulta. Fontes nativas de outros tipos informam que os valores efetivos não estão disponíveis; não foram inventados padrões. A paginação reutiliza os valores efetivos quando presentes e não envia bindings da fonte como parâmetros do relatório.
- Ao abrir a gaveta de dados, as origens das colunas são pré-buscadas sequencialmente e compartilhadas com o cache de 30 segundos. O cancelamento da prévia agora chega ao fetch. Nome técnico do catálogo foi retirado do resumo da origem e erros do diálogo de origem usam nome amigável; `not_requested` recebeu tradução.
- Investigação: o envio de parâmetros da fonte como parâmetros de execução na paginação era um caminho potencial para 400 e foi corrigido; não há evidência que relacione esse caminho às ocorrências antigas. O cancelamento anterior não interrompia o fetch; foi corrigido, mas não há evidência de que tenha causado 502. Os logs acessíveis não contêm as ocorrências nem permitem determinar suas causas. A API de staging usa um worker e timeout de 120 s; não há prova de esgotamento ou timeout. Não se reproduziu o 502.
- Backend: 41 testes de `test_canvas_source_preview.py`, `test_report_canvas.py` e `test_report_pagination.py` passaram em SQLite isolado; teste adicional confirma valores padrão, vínculo e linhas retornadas (1 passou). API isolada reiniciada para carregar o código. Logs: `/tmp/canvas-task28d-backend.log`.
- Pendências: completar valores efetivos para demais fontes nativas; concluir auditoria exaustiva de nomes, mensagens, aria e estados para relatórios 1 e 6; identificar e corrigir as causas efetivas dos 400/502 registrados; verificar a paginação com vínculos e demais fontes nativas. As medições com sessão autenticada, desempenho ponta a ponta e meta de abertura são fora do escopo desta continuação e permanecem não verificadas. Nenhum relatório foi salvo ou ativado. As alterações preexistentes em Login.tsx e na auditoria estática foram preservadas.
- Frontend final: 525 testes, lint de hooks, TypeScript e build passaram (`/tmp/canvas-task28d-recheck.log`). Uma rodada anterior identificou duas regressões de cancelamento e contexto ausente, corrigidas antes da rodada final. Staging 8091 reconstruído; `ReportCanvas-Cx0Ydhi6.js` respondeu HTTP 200 (294.791 bytes).

FIM-TAREFA-28 — continuação parcial; pendências acima.
