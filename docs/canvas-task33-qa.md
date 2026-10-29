# Tarefa 33 — QA parcial

| Item | Teste | Print |
| --- | --- | --- |
| 1 | `ReportWorkspace.task33.test.tsx`: ausência na lista, ação na edição e bloqueio com flag desligada; `ReportRemoval.test.tsx`: confirmação, vínculos e remoção. | Pendente |
| 2 | Pendente: seleção, ordenação, outras unidades e compatibilidade. | Pendente |
| 3 | Pendente: remoção persistente e restauração da detecção. | Pendente |
| 4 | Parcial: `orientation.test.tsx`, navegador (troca e gravação nos dois sentidos) e `test_page_orientation_persists_and_controls_pdf` (dimensões e texto no PDF); falta garantir ausência de corte em blocos com conteúdo denso após reduzir suas dimensões. | `canvas-task33-evidencias/`: claro e escuro, 100% e 150%. |
| 5 | `settingsDirectory.test.ts` e `ReportWorkspace.task33.test.tsx`: entrada de configuração e ausência da aba. Falta validar atalho antigo no navegador e permissões. | Pendente |

Os prints do item 4 estão em `canvas-task33-evidencias`; os demais itens ainda aguardam evidências visuais.

A suíte completa do frontend passou (70 arquivos). O staging isolado responde em `127.0.0.1:8095`, usando `orbita-api-fila` e `orbita-db-fila`.

Pontos para continuação: a execução de composições procura componentes por código na própria unidade; a opção de outras unidades exige adequação da resolução e das permissões no backend. A auditoria é calculada a partir do legado e da consulta, sem armazenamento de exclusões. A alteração de tamanho atual ajusta os blocos aos limites da página, o que requer validação cuidadosa para evitar perda de conteúdo.

Suíte completa de backend em PostgreSQL descartável: 1.017 passaram e cinco falharam em `tests/test_report_removal.py`, com resposta 503 porque a flag de remoção permanece desligada:

- `test_report_remove_restore_and_permissions`
- `test_connection_with_report_is_blocked_and_keeps_secret`
- `test_report_with_schedules_and_canvas_references_cannot_be_removed`
- `test_app_connection_restore_preserves_previous_inactive_state`
- `test_other_unit_cannot_remove_report`

A primeira execução tinha também falhas por falta de chaves descartáveis e montagem dos arquivos de teste; a segunda usou chaves de teste e montou `files` somente para leitura.


Item 4: frontend 639 testes passaram; backend PostgreSQL descartável: 1.019 passaram e as cinco falhas conhecidas de `test_report_removal.py` retornaram 503 com a flag desligada. O PDF usa as dimensões gravadas; a impressão do visualizador usa esse PDF. O ajuste proporcional preserva a posição relativa dos blocos, mas fontes e conteúdo interno não são escalados, portanto ainda é possível cortar conteúdo denso. A ausência de cortes não está comprovada. O staging 8095 foi reconstruído. `FILA-REGRAS.md` não estava presente neste checkout.
