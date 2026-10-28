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
