# Tarefa 33 — QA parcial

| Item | Teste | Print |
| --- | --- | --- |
| 1 | `ReportWorkspace.task33.test.tsx`: ausência na lista, ação na edição e bloqueio com flag desligada; `ReportRemoval.test.tsx`: confirmação, vínculos e remoção. | Pendente |
| 2 | Busca por nome na unidade do Canvas, inclusão, ordenação, remoção e preservação de campos de composições salvas: testes de frontend e backend e navegador no staging isolado. Pendente: seleção e resolução de relatórios de outras unidades. | `canvas-task33-evidencias/33e-{light,dark}-{100,150}.png` |
| 3 | Remoção individual e do bloco, confirmação, persistência após recarregar, restauração, permissão e conflito de versão: testes de frontend e backend e navegador no staging isolado. A configuração de execução e o SQL são preservados. | `canvas-task33-evidencias/33d-{light,dark}-{100,150}.png` |
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

Item 3: `ReportWorkspace.task33.test.tsx` passou (2 testes); `test_report_catalog.py` passou em PostgreSQL descartável (51 testes). A suíte completa do backend teve 1.020 testes aprovados e as cinco falhas conhecidas em `test_report_removal.py`, com 503 pela flag desligada. No frontend, a suíte completa teve 639 aprovados e um timeout em `task13.test.tsx`; esse arquivo passou isoladamente (4 testes). No navegador, a remoção individual persistiu após recarregar, e a remoção do bloco e a restauração foram verificadas. As quatro capturas são distintas e correspondem aos temas claro e escuro em 100% e 150%. Frontend e API do staging isolado 8095 foram reconstruídos.

Item 2: no navegador, a composição foi salva e reaberta com ordem e parâmetros preservados. As quatro capturas são distintas, nos temas claro e escuro com zoom de 100% e 150%. O staging 8095 foi reconstruído. Frontend: 641 testes passaram; build e verificação de tipos passaram. Backend em PostgreSQL descartável: 1.013 passaram, cinco falharam pela flag de remoção desligada e sete tiveram erro de configuração pela ausência inicial da chave Oracle de teste; os testes afetados foram executados novamente com chave descartável (ver resultado abaixo). A busca em outras unidades permanece pendente.


Reexecução com chave Oracle descartável: 59 testes aprovados em `test_operational_sql.py` e `test_report_catalog.py`, incluindo o novo teste de isolamento por unidade e persistência da composição.

## Continuação 33f — parcial

O teste de navegador `scripts/canvas-task33f-shortcut-qa.cjs`, usando sessão administrativa e dados descartáveis da unidade `qa33c` no staging isolado, confirmou que o endereço antigo `reportTab=appSources` abre a configuração geral de Instâncias dos apps e que o atalho não aparece no editor Canvas. As verificações anteriores de permissões em `settingsDirectory.test.ts` continuam aplicáveis; não houve nova validação de permissões no navegador.

O staging `orbita-canvas-stage-fila` foi reconstruído na porta 8095 e retornou HTTP 200. Os testes `tests/test_report_canvas.py` e `tests/test_report_catalog.py` passaram (87 testes), em PostgreSQL descartável `orbita-task33f-db`. Uma tentativa anterior com credenciais incorretas do banco isolado teve 70 erros de conexão; a execução acima usou um banco dedicado. A execução inicial do frontend no Node 18 do host falhou por incompatibilidade com jsdom; a verificação suportada via `scripts/canvas-check.sh` foi executada separadamente.

Continuam pendentes: correção e provas de ausência de cortes com conteúdo denso em ambas as orientações, editor, visualização e PDF/impressão; capturas correspondentes em ambos os temas e níveis de zoom; busca e resolução segura de componentes de outras unidades com teste de permissões. Nenhuma dessas funcionalidades foi implementada nesta continuação.
