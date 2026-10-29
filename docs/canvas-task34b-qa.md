# Tarefa 34b — revisão e limites

## Unidade e estabelecimento

A URL seleciona a unidade administrativa, que limita o catálogo e a execução. No cadastro consultado em leitura, o relatório 57 pertence a `scv` e sua origem legada é ROB8 MENSAGENS CONFIRMACAO CONSULTAS E EXAMES. O relatório 81 também pertence a `scv`, mas sua origem é SANTA CASA VOTUPORANGA. O 57 tem no esquema apenas a opção de parâmetro `ame`: ela é usada porque `scv` não é permitida. Isto não prova que ROB8 seja sempre AME: a regra de classificação é uma inferência e requer validação dos responsáveis pelo legado. O filtro inicial agrupa pelo estabelecimento inferido do relatório aberto; os demais pertencem à mesma unidade administrativa autorizada. A tela informa a unidade selecionada e o estabelecimento do relatório.

## Item, teste e evidência

| Item | Teste | Print |
|---|---|---|
| 1 | `task34.test.tsx`: unidade permitida, alternativa permitida e opções repetidas por valor | Pendente de captura da versão 34b |
| 2 | `test_canvas_task34.py` e `task34.test.tsx`: classificação por metadados e filtro de estabelecimentos; leitura dos metadados dos IDs 57 e 81 | `canvas-task34b-evidencias/c57-lista.png` |
| 3 | `test_canvas_task34.py`: tipos fornecidos pelo driver PostgreSQL e tipo desconhecido; teste da prévia vazia no frontend e consulta PostgreSQL vazia com texto e data | `canvas-task34b-evidencias/c1-claro-100-previa.png` (fonte local) |
| 4 | `task34.test.tsx`: nomes com estabelecimento, ID e situação | Pendente de captura da versão 34b |
| 5 | `task34.test.tsx`: rascunho igual, diferente e com chaves reordenadas | Pendente de captura em navegador com rascunhos controlados |
| 6 | Evidências anteriores em `canvas-task34-evidencias/`: escala simulada em 150%; não são zoom nativo | Pendente zoom nativo e confirmação dos estabelecimentos legados |

Os tipos de SQL dependem das informações do driver. Códigos não reconhecidos continuam como tipo desconhecido; adaptadores sem esquema de tipos também podem permanecer desconhecidos. O rascunho do navegador da revisão não foi alterado nem classificado sem inspeção.

Frontend completo: 635 testes passaram em 69 arquivos, com Node 24. Backend direcionado: quatro testes passaram, incluindo a consulta PostgreSQL vazia.

Na tentativa de zoom nativo, o Chromium sem interface não alterou o zoom com o atalho; não foi gerada captura que se passasse por zoom 150%. A prévia e a gaveta foram exercitadas na porta isolada 8098.

Backend completo em PostgreSQL descartável, com chaves descartáveis e arquivos montados somente para leitura: **1.016 passaram e cinco falharam**. As cinco são as falhas conhecidas em `test_report_removal.py`, pois `REPORT_REMOVAL_ENABLED=0`: `test_report_remove_restore_and_permissions`, `test_connection_with_report_is_blocked_and_keeps_secret`, `test_report_with_schedules_and_canvas_references_cannot_be_removed`, `test_app_connection_restore_preserves_previous_inactive_state` e `test_other_unit_cannot_remove_report`. Todas receberam 503. Uma primeira execução sem as chaves e os arquivos também apresentou duas falhas e sete erros de ambiente; a execução acima foi repetida com a configuração completa.

Staging 8091 reconstruído com `API_UPSTREAM=orbita-canvas-task26-api:8000`, API de staging reiniciada; a rota HTML do relatório 57 respondeu HTTP 200. Isso não verifica a prévia com dados reais.
