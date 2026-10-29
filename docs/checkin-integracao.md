# Integração check-in 38I

Base de produção: `bf17af355191e3b02555921ec294f3e5e23bdead`. Worktree `feature/checkin-int` em repositório independente criado por bundle para não gravar em `/opt/orbita`.

## Commits e conflitos

Merges em ordem: A1 `3dfb949` → `01fc14e`, B `e2ab639` → `5ef6186`, C `d3b6233` → `2d4a053`, D `d492013` → `444abdf`, E `dab4a19` → `d699ac4`. Migrações: `1f7949c` e `72473e5`. Sem push; nenhum dos arquivos proibidos foi incluído na diferença com a base.

- B: `AutoAgendaWorkspace.tsx`: preservadas as importações de `PtBrDateInput`, da release, e `checkInLabel`, da parte B; mantém seletor de data e etiqueta independente da reserva.
- C: `settings.py`: preservados o intervalo de sincronização de usuários da release e o interruptor `CHECKIN_SCHEDULER_ENABLED`, desligado por padrão. Demais merges sem conflito textual.

## Migrações

`checkin/0015_initial` é inicial e aditiva, depende de `core/0014`, `operations/0031` (última da release), `scheduling/0013` e `autoagenda/0002`. Não reescreve migrações antigas. Plano, aplicação, reversão para zero e reaplicação passaram em PostgreSQL descartável: `/tmp/checkin-38i-migrate-reverse.log`. A reversão física remove os dados de check-in; em operação exigir backup recuperável, conforme contrato. `makemigrations --check --dry-run` passou com `REPORT_REMOVAL_ENABLED=1`, mesma configuração da release. Sem essa opção, a verificação inicialmente propôs remover os campos condicionais preexistentes de `operations`; nenhuma migração destrutiva foi gerada.

## Staging

Staging descartável na porta 8117, contêineres `checkin-38i-*`, PostgreSQL próprio e rede interna sem acesso externo no backend; painel conectado também à rede de publicação. Conta exclusiva de staging em `/workspace/orbita-canvas/teste117.txt` no workspace solicitante. `SEND_MODE=simulated`, Meta real desligado, nenhum Baileys; configuração ligada somente na Sansaúde, origem Appointment habilitada, Booking desabilitado para evitar duplicidade; Oracle simulado habilitado. Um processo periódico dedicado chama tick e despacho simulado. Os defaults do código continuam desligados.

- Navegador headless: autenticação, menu, tela e modal de configuração passaram (`/tmp/checkin-38i-browser2.log`). A API de detalhe de agendamento exibiu o estado de check-in.
- No banco do staging, com relógio de teste de segunda-feira às 10h e consulta na terça-feira às 10h, descoberta e planejamento de 24h, enfileiramento e aceite simulado passaram; resposta Confirmar e Solicitar cancelamento passaram, com pendência para equipe e agenda preservada. A execução com relógio simulado acionou diretamente os mesmos serviços do processo periódico, não esperou 24 horas reais (`/tmp/checkin-38i-stage-test2.log`).
- Ação manual com motivo e auditoria passou. Fonte Oracle injetada simulou `CD_ATENDIMENTO` preenchido e gerou presença auditada. A validação 38I usou uma fonte injetada; a integração periódica posterior está descrita abaixo.
- Relatório agregado retornou confirmados e faltas com denominadores, e prévia Canvas PDF autenticada passou (`/tmp/checkin-38i-report.log`). Relatório foi habilitado apenas no banco de staging.
- A primeira tentativa do cenário com data futura falhou na validação de timestamp; corrigido o relógio de teste e repetido com sucesso. Primeira verificação HTTP da porta falhou enquanto painel estava somente em rede interna; publicação corrigida e navegador validado.

## Pendências

Pendências externas: aprovação e mapeamento do template Meta de check-in, incluindo botões; homologação da view Oracle e da chave de junção. Os testes simulados não substituem essa homologação.

## Testes e build

- Backend completo em PostgreSQL isolado, serial sob `flock /tmp/orbita-suite.lock`, transporte simulado, com chave Oracle fictícia e `REPORT_REMOVAL_ENABLED=1`: **1.341 passaram, 1 ignorado, 1 falhou** (`/tmp/checkin-38i-back.log`). A falha `test_cross_body_parameters_are_in_meta_request` decorreu da ausência de `META_CREDENTIALS_KEY` no ambiente de teste. A repetição apenas desse teste com chave fictícia, rede isolada e lock passou (1/1; `/tmp/checkin-38i-meta-retry.log`). A suíte completa não foi repetida com essa chave; não afirmar que passou integralmente.
- Frontend completo sob o mesmo lock, Vitest `--maxWorkers=2`: **78 arquivos e 677 testes passaram**, `/tmp/checkin-38i-front.log`.
- Builds de backend e frontend em Docker passaram: `/tmp/checkin-38i-build-api.log` e `/tmp/checkin-38i-build-front.log`. O backend de staging monta o código do worktree em leitura; o build foi feito antes do último ajuste da dependência de migração, que foi validado com essa montagem.


## Reconciliação periódica 38J

O Celery Beat agenda `checkin.reconcile_oracle` a cada 300 segundos. A flag de ambiente `CHECKIN_ORACLE_SCHEDULER_ENABLED` começa em `0`; mesmo ligada, exige a configuração de check-in e Oracle habilitada para a unidade `sansaude`. A consulta usa a conexão Oracle da unidade, `SET TRANSACTION READ ONLY`, rollback e apenas SELECT com valor de chave parametrizado. A conta Oracle deve ter permissões somente de leitura.

Após homologação, configurar `CHECKIN_ORACLE_VIEW` (nome ou esquema.nome) e `CHECKIN_ORACLE_KEY_COLUMN` (coluna simples); ambos são validados como identificadores SQL. A chave associa a coluna da view ao `Appointment.external_id`. Essa associação e a cardinalidade devem ser homologadas antes de habilitar a flag. Booking não tem chave externa homologada e não produz correspondência. Até existir uma view e chave válidas, o job permanece inativo. Apenas uma linha com `CD_ATENDIMENTO` não nulo registra presença; linhas ausentes ou múltiplas não geram falta ou presença, e falhas da fonte interrompem a passagem sem alterar os registros restantes. Cada execução revisita as páginas para capturar presenças tardias, sem consultar Oracle ao gerar relatórios.

A chave Meta fictícia é gerada dentro do teste de payload, sem variável de ambiente. Os testes da rotina periódica usam Oracle simulado e verificam o bloqueio por flag, identificadores, transação somente leitura, correspondência única, ausência, ambiguidade e chegada tardia. Nenhuma migração foi alterada.


### Verificação 38J

Suíte completa do backend em PostgreSQL e rede descartáveis, sob `flock /tmp/orbita-suite.lock`, `pytest -n 2`, envio simulado, sem `META_CREDENTIALS_KEY` no ambiente: **1.344 passaram, 1 ignorado** (`/tmp/checkin-38j-back-final.log`). A primeira execução teve 1.343 aprovações, 1 teste ignorado e uma falha em indicador médico por não montar `/report_files`; a repetição completa acima montou os arquivos em leitura. O teste direcionado anterior também revelou um erro na montagem do mock de contexto Oracle, corrigido antes da suíte completa.
