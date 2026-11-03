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

## Correções 38K

Base: 38J `50ece45`. Filtros e parâmetros de data de geração usam `PtBrDateInput`; feriados são apresentados e validados em dd/mm/aaaa e convertidos para ISO na API. Horários comerciais usam entrada explícita HH:MM em 24 horas, com validação. Os formulários de check-in mostram erros em português; no formulário de geração, os campos obrigatórios usam mensagem personalizada em português. A configuração informa o limite à Sansaúde. Check-in, Relatórios e tema usam ícones distintos do conjunto do projeto; o tema usa a cor corrente.

A seleção do relatório mostra apenas o nome, os parâmetros inicial e final aparecem nessa ordem e o PDF formata a coluna Percentual com vírgula; a exportação de planilha mantém o valor numérico. Os dados do staging foram preservados. Foi gerada uma execução adicional de relatório para conferir o fluxo.

Capturas headless em `docs/checkin-38k/`: 01 filtros e ícones, 02 configuração e horários, 03 validação, 04 lista de relatórios, 05 geração e ordem de datas, 06 execução gerada, 07 validação de data obrigatória e 08 tema alternativo. A validação headless confirmou `Preencha este campo.`; o teste de formatação verifica 12,5 no PDF e 12.5 como número na planilha. A captura da execução não mostra o conteúdo interno do PDF.

### Medição de desempenho

Navegador Chromium headless na rede Docker do staging, antes da troca do painel: HTML em 243 ms; login POST em 1.541 ms; do clique até o menu em 2.690 ms. As chamadas iniciais observadas para regras, mensagens, pendências, respostas, agendamentos, modelos, importações, auditoria, controle e indicadores levaram individualmente 396–820 ms. A medição é interna, com cache frio e sem representar a rede do usuário. Não reproduziu os 15–20 s, e não permite determinar a causa dessa demora. Não houve chamada de check-in ou Oracle nas requisições iniciais observadas; não foi identificado gargalo do código novo de check-in. O frontend usa build Vite de produção servido pelo nginx com cache de assets, enquanto a API do staging usa Django `DEBUG=1` e `runserver --noreload`; essa configuração pode influenciar tempos, mas não prova a causa relatada. Recomenda-se medir a mesma navegação no cliente afetado, incluindo rede e tempos de cada requisição.

### Verificação 38K

- Frontend direcionado com Node 24: 11 passaram. A primeira tentativa no Node do host falhou ao iniciar jsdom por incompatibilidade ESM; repetição em Node 24 passou.
- Backend direcionado: 5 passaram. Primeira tentativa com a imagem de staging não tinha pytest-xdist; repetição serial passou.
- Suítes completas sob `flock /tmp/orbita-suite.lock`: backend em PostgreSQL isolado, `pytest -n 2`, 1.345 passaram e 1 ignorado; frontend Node 24, Vitest `--maxWorkers=2`, 78 arquivos e 678 testes passaram. Logs: `/tmp/checkin-38k-back-full.log` e `/tmp/checkin-38k-front-full.log`.
- Build do frontend em Docker passou; imagem `checkin-38k-panel` servida na porta 8117. API reiniciada para carregar a formatação do PDF; banco e configuração anteriores preservados. O painel anterior foi mantido parado como `checkin-38i-panel-previous`.

## Correção 38L

Base: `0d4b737` (38K). Removidas as exceções do tema escuro que substituíam o estado desabilitado de `.op-pager` e das ações de snapshots por cores fixas e, na paginação compartilhada, opacidade integral. Os botões usam as variáveis de tema existentes; desabilitados mantêm opacidade 0,55 e cursor `not-allowed` nos dois temas. Estado ativo e hover conservam as regras e variáveis do botão. `Login.tsx` não foi alterado.

- Testes direcionados de Relatórios: 2 arquivos, 11 testes passaram; suíte completa do frontend: 78 arquivos, 678 testes passaram. Ambos em Node 24 sob `flock /tmp/orbita-suite.lock`, Vitest `--maxWorkers=2`. Logs: `/tmp/checkin-38l-front-target.log` e `/tmp/checkin-38l-front-full.log`.
- Build do frontend em Docker passou (`/tmp/checkin-38l-build.log`); imagem `checkin-38l-panel` servida no staging 8117, com API e banco existentes. HTTP na porta respondeu 200.
- Chromium headless autenticado em Relatórios conferiu nos dois temas opacidade 0,55 e cursor `not-allowed` no botão desabilitado, opacidade 1 e cursor `pointer` no ativo, e mudança de cores no hover (`/tmp/checkin-38l-qa.log`). Capturas em `docs/checkin-38l/`: `light-pagina-1.png`, `light-pagina-2.png`, `dark-pagina-1.png`, `dark-pagina-2.png`. O staging tem somente um relatório e ambos os botões estavam realmente desabilitados; para mostrar os dois estados lado a lado, o atributo `disabled` foi alterado apenas no DOM do navegador para as capturas, sem mudar os dados ou simular navegação real. Os nomes dos arquivos indicam a disposição dos estados, não uma mudança de página.
- A primeira inspeção mediu a transição CSS antes de terminar e a segunda manteve o estado artificial entre temas; ambas foram corrigidas na verificação final acima.
