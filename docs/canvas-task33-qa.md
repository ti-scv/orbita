# Tarefa 33 — QA parcial

| Item | Teste | Print |
| --- | --- | --- |
| 1 | `ReportWorkspace.task33.test.tsx`: ausência na lista, ação na edição e bloqueio com flag desligada; `ReportRemoval.test.tsx`: confirmação, vínculos e remoção. | Pendente |
| 2 | Pendente: seleção, ordenação, outras unidades e compatibilidade. | Pendente |
| 3 | Pendente: remoção persistente e restauração da detecção. | Pendente |
| 4 | Pendente: troca nos dois sentidos, persistência, visualização e PDF/impressão. | Pendente |
| 5 | `settingsDirectory.test.ts` e `ReportWorkspace.task33.test.tsx`: entrada de configuração e ausência da aba. Falta validar atalho antigo no navegador e permissões. | Pendente |

Os prints em claro e escuro, a 100% e 150%, ainda não foram produzidos. Não há evidências visuais para esses itens.

A suíte completa do frontend passou (70 arquivos). O staging isolado responde em `127.0.0.1:8095`, usando `orbita-api-fila` e `orbita-db-fila`.

Pontos para continuação: a execução de composições procura componentes por código na própria unidade; a opção de outras unidades exige adequação da resolução e das permissões no backend. A auditoria é calculada a partir do legado e da consulta, sem armazenamento de exclusões. A alteração de tamanho atual ajusta os blocos aos limites da página, o que requer validação cuidadosa para evitar perda de conteúdo.

Suíte completa de backend em PostgreSQL descartável: 1.017 passaram e cinco falharam em `tests/test_report_removal.py`, com resposta 503 porque a flag de remoção permanece desligada:

- `test_report_remove_restore_and_permissions`
- `test_connection_with_report_is_blocked_and_keeps_secret`
- `test_report_with_schedules_and_canvas_references_cannot_be_removed`
- `test_app_connection_restore_preserves_previous_inactive_state`
- `test_other_unit_cannot_remove_report`

A primeira execução tinha também falhas por falta de chaves descartáveis e montagem dos arquivos de teste; a segunda usou chaves de teste e montou `files` somente para leitura.
