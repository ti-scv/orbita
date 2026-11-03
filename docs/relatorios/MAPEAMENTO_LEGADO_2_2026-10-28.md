# Mapeamento legado 2 — 28/10/2026

## Resultado

Os 15 procedimentos foram avaliados e permanecem PENDENTES. Nenhuma conversão foi aplicada, nenhum ID foi criado e nenhum cadastro foi alterado. A autorização permite converter, mas a instrução de não inventar regras e exigir amostra aceita impede promover estes candidatos. Os rascunhos que já existiam foram preservados.

Auditoria do PostgreSQL em transação READ ONLY, reforçada por PGOPTIONS default_transaction_read_only=on; sem execução de procedures, sincronizadores, consultas clínicas, programação ou mensagens. Duas execuções produziram inventário idêntico, exceto duração global. Não houve dados clínicos em layouts ou evidências.

## Inventário

Fonte cadastrada em todos: conexão 10, placeholder do cache Firebird; não habilitada como Oracle. Destino candidato: Oracle 1/prdvotu, com capacidade histórica PostgreSQL para ocupação. Identificação administrativa SCV (2), sem troca de unidade. Parâmetros abaixo são argumentos internos recuperados, não novos filtros aprovados.

| Procedimento / legado | ID Orbita / nome | Fonte candidata | Parâmetros internos | Estado e motivo | Canvas | Leitura Oracle |
|---|---|---|---|---|---|---|
| PROC_RESUMO_ATENDIMENTOS / 18 | 31 — TAXA DE OCUPAÇÃO POR SETOR | Oracle + capacidade histórica/G4 | TIPO RELATORIO=2; CONVENIO=TODOS; ID RELATORIO=18; SERIES=SERIES1 | PENDENTE: Faltam rateio G4, capacidade histórica/vigências aceitas, janelas e amostra aceita. | [31](/relatorios/31/canvas?unit=scv) | Não executada |
| PROC_RESUMO_ATENDIMENTOS / 19 | 32 — PACIENTE DIA E TAXA DE OCUPAÇÃO - GERAL | Oracle + capacidade histórica/G4 | TIPO RELATORIOS=1; CONVENIO=TODOS; ID RELATORIO=19; SERIES=SERIES1 | PENDENTE: Faltam rateio G4, capacidade histórica/vigências aceitas, janelas e amostra aceita. | [32](/relatorios/32/canvas?unit=scv) | Não executada |
| PROC_LEITOS_DISPONIVEIS / 23 | 35 — GERAR_LEITOS_DISPONIVEIS | Oracle + capacidade histórica/G4 | DATA INICIAL=; DATA FINAL= | PENDENTE: Faltam rateio G4, capacidade histórica/vigências aceitas, janelas e amostra aceita. | [35](/relatorios/35/canvas?unit=scv) | Não executada |
| PROC_RESUMO_ATENDIMENTOS / 24 | 36 — PACIENTE DIA E TAXA DE OCUPAÇÃO - SUS | Oracle + capacidade histórica/G4 | TIPO RELATORIO=1; CONVENIO=SUS; ID RELATORIO=24; SERIES=SERIES1 | PENDENTE: Faltam rateio G4, capacidade histórica/vigências aceitas, janelas e amostra aceita. | [36](/relatorios/36/canvas?unit=scv) | Não executada |
| PROC_RESUMO_ATENDIMENTOS / 25 | 37 — PACIENTE DIA E TAXA DE OCUPAÇÃO - CONVENIO | Oracle + capacidade histórica/G4 | TIPO RELATORIO=1; CONVENIO=CONVENIO; ID RELATORIO=25; SERIES=SERIES1 | PENDENTE: Faltam rateio G4, capacidade histórica/vigências aceitas, janelas e amostra aceita. | [37](/relatorios/37/canvas?unit=scv) | Não executada |
| proc_exames_por_atendimento / 42 | 52 — EXAMES POR ATENDIMENTO - GERAL | Oracle; ramo calculado pendente | TIPO RELATORIO=1 | PENDENTE: Substituição no Canvas 63 existente; falta aceite da separação dos ramos 1/4/2 e amostra aceita por saída. | [52](/relatorios/52/canvas?unit=scv) | Não executada |
| proc_exames_por_atendimento / 51 | 61 — EXAMES POR ATENDIMENTO - TABELA | Oracle; ramo calculado pendente | TIPO RELATORIO=4 | PENDENTE: Substituição no Canvas 63 existente; falta aceite da separação dos ramos 1/4/2 e amostra aceita por saída. | [61](/relatorios/61/canvas?unit=scv) | Não executada |
| proc_exames_por_atendimento / 52 | 62 — EXAMES POR ATENDIMENTO - DESEMPENHO INDIVIDUAL | Oracle; ramo calculado pendente | TIPO RELATORIO=2 | PENDENTE: Substituição no Canvas 63 existente; falta aceite da separação dos ramos 1/4/2 e amostra aceita por saída. | [62](/relatorios/62/canvas?unit=scv) | Não executada |
| PROC_ALTAS_ATE_AS_10 / 54 | 64 — TEMPO MEDIO PERMANENCIA - GERAL | Oracle; ramo calculado pendente | TIPO RELATORIO=4; ID RELATORIO=54; SERIES=X | PENDENTE: Faltam ramo por especialidade, seleção/ordem, nulos e amostra aceita; aceite médico só em homologação. | [64](/relatorios/64/canvas?unit=scv) | Não executada |
| PROC_ALTAS_ATE_AS_10 / 58 | 68 — MEDIA DE CIRURGIAS - TOTAL | Oracle; ramo calculado pendente | TIPO RELATORIO=6; ID RELATORIO=58; SERIES=SERIES1 | PENDENTE: Faltam reconciliação de janelas, denominadores, arredondamentos e amostra aceita. | [68](/relatorios/68/canvas?unit=scv) | Não executada |
| PROC_ALTAS_ATE_AS_10 / 62 | 72 — MEDIA ATENDIMENTOS | Oracle; ramo calculado pendente | TIPO RELATORIO=7; ID RELATORIO=62; SERIES=SERIES1 | PENDENTE: Faltam reconciliação de janelas, denominadores, arredondamentos e amostra aceita. | [72](/relatorios/72/canvas?unit=scv) | Não executada |
| PROC_ALTAS_ATE_AS_10 / 63 | 73 — TEMPO MEDIO PERMANENCIA - ESPECIALIDADES SUS | Oracle; ramo calculado pendente | TIPO RELATORIO=5; ID RELATORIO=63; SERIES=SERIES1 | PENDENTE: Faltam ramo por especialidade, seleção/ordem, nulos e amostra aceita; aceite médico só em homologação. | [73](/relatorios/73/canvas?unit=scv) | Não executada |
| PROC_ALTAS_ATE_AS_10 / 64 | 74 — MEDIA DE CIRURGIAS - ELETIVAS | Oracle; ramo calculado pendente | TIPO RELATORIO=20; ID RELATORIO=64; SERIES=SERIES1 | PENDENTE: Faltam reconciliação de janelas, denominadores, arredondamentos e amostra aceita. | [74](/relatorios/74/canvas?unit=scv) | Não executada |
| PROC_ALTAS_ATE_AS_10 / 65 | 75 — MEDIA DE CIRURGIAS - URGENCIA E EMERGENCIA | Oracle; ramo calculado pendente | TIPO RELATORIO=21; ID RELATORIO=65; SERIES=SERIES1 | PENDENTE: Faltam reconciliação de janelas, denominadores, arredondamentos e amostra aceita. | [75](/relatorios/75/canvas?unit=scv) | Não executada |
| PROC_ALTAS_ATE_AS_10 / 68 | 78 — PARECER MEDICO POR ESPECIALIDADE | Oracle; ramo calculado pendente | TIPO RELATORIO=22; ID RELATORIO=68; SERIES=SERIES1 | PENDENTE: Faltam ramo por especialidade, seleção/ordem, nulos e amostra aceita; aceite médico só em homologação. | [78](/relatorios/78/canvas?unit=scv) | Não executada |

SQL vazio em todos os 15. Em particular, legacy.original_sql do ID 64 contém o marcador textual <NULL>: não é consulta Oracle utilizável, apesar do “sim” no inventário histórico. A existência de Canvas representa só layout e não valida a fonte.

## O que falta para liberar cada família

- Ocupação e geração de leitos: recuperar/aceitar CADASTRO_LEITOS e CADASTRO_SETORES com vigências e snapshots. Preservar arredondamentos intermediários, nulos e lacunas; capacidade atual não reconstrói o passado. PROC_LEITOS_DISPONIVEIS grava cache e PROC_RESUMO modifica auxiliares: não executar para descobrir resultados.
- Exames 42/51/52: a documentação de 26/10 supera o bloqueio antigo de meta desconhecida. Meta 2,50 e regra por prestador estão recuperadas; Canvas 63 já substitui 42/52. Não duplicar a composição ou trocar os três componentes pelo documento completo. Falta aceitar a separação de overview/chart/providers e o ramo 4, com amostra correspondente. Não se afirma que as regras de exames estejam desconhecidas.
- Cirurgias e atendimentos: transcrever/reconciliar todos os ramos anuais/mensais/diários, séries e precisão. Anos anteriores usam 365 em trechos do BLR; não corrigir ano bissexto implicitamente. Total cirúrgico não é necessariamente soma dos tipos E e U/M. Atendimentos têm cinco origens textuais específicas.
- Permanência e parecer: homologação técnica do relatório médico 50 não é aceite de produção para 64/73/78. Confirmar seleção de especialidades, nulos, ponderação, unidades de tempo e mesmo recorte. Danilo valida amostra/decisões; TI confirma fonte/objetos quando necessário.

## Segurança, simulação e reversão

Backup novo: /root/backup-legado2-2026-10-28-auditoria.sql (0600), pg_dump concluído, marcador final conferido. SHA256: 2d370efeb279b6ce779575eef4952b184bdedad4b4fe7c9d827733d2f50d6aa5.

Evidências privadas: /opt/backups/orbita/legado2-20261028/{dry-run,repeated,verification}.json. A duração de leitura de metadados está nos dois inventários; não mede consulta Oracle ou abertura do editor. Não há tempo de leitura Oracle porque nenhuma fonte candidata foi executada neste lote.

Comando versionado: python manage.py audit_legacy_two --output /evidence/dry-run.json. O comando só oferece inventário; não possui --apply. Execução no container descartável com código deste worktree e ambiente existente, PGOPTIONS de somente leitura. Repetição usa --output /evidence/repeated.json.

Plano real: criar 0, alterar 0, ativar 0, enviar 0. Aplicação real dispensada: todos estão pendentes. Reversão simulada é operação vazia, inventários iguais confirmados em verification.json. Comando de reversão: nenhum SQL a executar. Não restaurar o dump sobre produção para desfazer uma auditoria. Quando houver candidato liberado, exige novo backup, plano completo, aplicação idempotente e teste de reversão próprios.

Nenhuma migração aplicada (incluindo 0031), deploy, rebuild, push ou exclusão. Login.tsx, teste.bin e documentos alheios preservados. Trabalho em /opt/orbita-legado2, feature/canvas-legado2.

## Fontes consultadas

- MAPEAMENTO_LEGADO_2026-10-28.md e FECHAMENTO_LEGADO_2026-10-28.csv.
- FONTES_EXTERNAS_CANVAS.md; INDICADORES_INFORMATIVOS_MAPEAMENTO.md; MAPEAMENTO_PORTABILIDADE_LOTE_2.md.
- EXAMES_POR_ATENDIMENTO_ORACLE.md; INDICADORES_MEDICOS_ORACLE.md; PROXIMOS_RELATORIOS_ORACLE.md.
- Código do lote cinco (4c545b6, 0fcc30b, 0447c53, 44b45ba), mapeador externo e cadastro vivo dos 15.

## Validação

Resultados finais registrados abaixo após execução dos testes.

- Backend focado/relevante: **36 testes passaram**, incluindo quatro casos do inventário (escopo, repetição sem escrita, lote incompleto, identidade divergente), lote cinco, exames/fontes e indicadores médicos.
- Frontend completo: **581 testes passaram em 56 arquivos**, hooks e TypeScript aprovados, Node 24, sem alteração de interface. Build pulado explicitamente (ONLY_TESTS=1); produção preservada.
- Primeiras tentativas tiveram problemas do ambiente descartável: permissão de evidências, montagem somente leitura e ausência de /report_files/.../layout.json. Corrigidas as montagens e repetida a suíte relevante; nenhuma falha restante nessa suíte. Não foi rodada a suíte backend inteira; as seis falhas históricas da entrega anterior não foram reavaliadas nem declaradas corrigidas.
- Logs privados: backend-final.log e frontend.log. diff --check aprovado.
- Marcador FIM-TAREFA-31 encontrado quatro vezes no log local antes da integração. Integração permitida por task-legado2.md, usando rebase e fast-forward, sem incluir alterações alheias.
