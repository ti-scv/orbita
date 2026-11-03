# Tarefa 34c — verificação

## Investigação

Consulta somente de leitura: os relatórios 57 e 81 pertencem à unidade administrativa `scv`. A fonte 81 está desativada e não revisada; seu esquema contém apenas datas, não uma opção de unidade. O catálogo a apresenta como contrato em revisão, e o resolvedor exige fonte ativa e revisada. O erro de unidade era enganoso; a interface agora explica a revisão e não solicita uma prévia impossível. Trocar a unidade não resolveria essa restrição.

A classificação de estabelecimento do 57 como AME Votuporanga é uma inferência de metadados legados, não uma equivalência comprovada entre SCV e AME. As opções do parâmetro do relatório 57 contêm `ame`, não `scv`. A interface explica a classificação e a alternativa usada. A confirmação com os responsáveis pelo legado continua pendente.

O nginx registrou HTTP 400 na prévia às 01:26:01 UTC e outras prévias e sessões HTTP 200. O resolvedor retorna 400 para fontes não disponíveis; não há corpo ou identificador no log que permita associar de forma conclusiva esse 400 à fonte 81. A API reiniciou às 01:11 UTC, antes dos acessos registrados às 01:23 UTC; os logs disponíveis não demonstram a causa da interrupção inicial do navegador. A abertura da sessão e do relatório agora tem limite de 20 segundos e opção de tentar novamente.

## Item → teste → print

| Item | Teste | Print |
|---|---|---|
| D1 | `task34.test.tsx`: fonte em revisão explica situação e não envia prévia; leitura de metadados 57/81 | Captura nova específica pendente; QA18 anterior: `qa18-c57-escuro100-fonte81-indisponivel.png` |
| D2 | `task34.test.tsx`: filtro e identificação por estabelecimento; classificação documentada acima | `canvas-task34c-evidencias/c57-lista.png` (banco descartável, 100%) |
| D3 | `task34.test.tsx`: nomes com ID e busca por ID | Captura específica pendente |
| D7 | `task34c-loading.test.tsx`: falha por tempo limite e nova tentativa; build TypeScript; logs nginx/API | Captura de falha simulada pendente; teste da falha de sessão pendente |
| D4 | `task34.test.tsx`: comparação, remoção de rascunho igual, retenção do diferente e data/hora; `canvasStageAndInteractions.test.ts` | Captura controlada pendente |
| D8 | Mensagem alterada no modal; build TypeScript | Captura nova pendente |
| D5 | `task34.test.tsx`: texto tipo estimado e detecção de data com valores | Captura nova pendente; sem valores, o tipo continua dependente do esquema da fonte |
| Unidade e badge | `task34.test.tsx`: `scv` é escolhido quando consta das opções; busca por `Pendente de aceite` no frontend sem ocorrências | Teste específico de badge e captura pendentes |
| 34b | `test_canvas_task34.py` e análise documentada em `canvas-task34b-qa.md` | QA18 anterior tem 150% claro e escuro; novas capturas em zoom nativo e confirmação da classificação legada pendentes |

Não foram feitos salvamentos ou alterações de dados no staging 8091. A captura nova usa a porta 8098 e o banco descartável. A suíte frontend em Node 24 passou: 640 testes em 70 arquivos com dois processos. Uma execução concorrente com mais processos teve quatro estouros de tempo e passou na repetição com menos processos. Build do staging concluído, rota 57 HTTP 200. Nenhum backend foi alterado.

A última suíte backend completa da 34b, no mesmo código de backend, registrou 1.016 aprovados e cinco falhas conhecidas de remoção (flag `REPORT_REMOVAL_ENABLED=0`): `test_report_remove_restore_and_permissions`, `test_connection_with_report_is_blocked_and_keeps_secret`, `test_report_with_schedules_and_canvas_references_cannot_be_removed`, `test_app_connection_restore_preserves_previous_inactive_state`, `test_other_unit_cannot_remove_report`. A execução 34c no PostgreSQL descartável terminou com 1.008 aprovados, sete falhas e sete erros. Além das cinco falhas conhecidas, `test_cross_body_parameters_are_in_meta_request` e os sete testes `test_operational_sql.py` falharam por ausência de chaves de teste; `test_all_sections_share_readonly_session_and_dates` falhou por ausência de `/report_files/reports/indicadores-medicos/v1/layout.json` no container. Essa execução não substitui a validação completa com configuração de teste corrigida.

A repetição completa do backend 34c com chaves descartáveis e arquivos montados em leitura terminou com **1.017 aprovados e as cinco falhas conhecidas** da flag de remoção listadas acima; não houve outros erros.
