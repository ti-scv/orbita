# Check-in A1 — API e operador

Base: A0 cd495d5. As origens permanecem independentes. Não há criação automática de check-ins, envio, Oracle ou alteração de Booking/Appointment nesta parte; configurações e origens continuam desligadas por padrão.

## API

A autenticação, unidade selecionada por `?unit=sansaude` e permissão `checkin` são verificadas pelo servidor. Outras unidades são negadas inclusive a administradores. GET lista paginada e detalhe em `/api/v1/checkins/`; filtros `source=appointment|booking`, `response`, `attendance`, `start` e `end` (datas ISO inclusivas no fuso configurado). O detalhe inclui histórico; `label` usa comparecimento quando conhecido, senão resposta. Sem data normalizada, o registro não aparece no filtro de período.

POST `/api/v1/checkins/{id}/transition/` exige `version`, `idempotency_key`, `reason` e `response` e/ou `attendance`; usuário e unidade vêm da autenticação/escopo. Retorna `checkin` e `event_id`. Erros de validação retornam 400, conflitos de versão, revisão ou chave 409. Repetição idêntica retorna o evento anterior. A evidência do evento do operador registra quais dimensões foram enviadas, permitindo identificar reutilização da chave com conteúdo diferente.

GET/PATCH `/api/v1/checkin-configuration/` lê defaults sem criar registro; PATCH valida e salva explicitamente. A configuração do contrato A0 não possui versão, portanto gravações concorrentes podem sobrescrever campos em comum; propõe-se adicionar controle de versão à configuração em revisão futura do contrato, sem alterá-lo nesta branch.

## Pontos de integração

- `backend/config/urls.py`: registro do router de check-ins e endpoint de configuração; reconciliar com as demais branches.
- `backend/core/serializers.py`: no detalhe de Appointment, campo `checkin` com ciclo mais recente da revisão atual, condicionado à permissão de leitura; em lista retorna null. Não altera o estado do agendamento.
- `backend/autoagenda/api.py`: detalhe da conversa inclui `booking.checkin`, condicionado à mesma permissão; reserva continua independente.
- `backend/checkin/api.py`: consumidores B/C/D/E devem respeitar nomes e duas dimensões do contrato A0. Origens/ciclos devem ser criados pelas partes responsáveis, sem conciliação por nome ou telefone.
- Não há migrações novas. A0 documenta o procedimento de reversão estrutural e operacional.

## Testes

- Testes específicos A0/A1 em PostgreSQL isolado: 10 aprovados, incluindo duas requisições concorrentes de operador com a mesma chave.
- Suíte backend completa no PostgreSQL de teste, com chave Oracle fictícia: A1 1.305 aprovados, 5 ignorados e 2 falhas; base cd495d5 1.300 aprovados, 5 ignorados e as mesmas 2 falhas. São `test_cross_meta_payload.py::test_cross_body_parameters_are_in_meta_request` (chave Meta de teste) e `test_medical_indicators.py::test_all_sections_share_readonly_session_and_dates` (layout do relatório).
- Suíte frontend: 76 arquivos e 671 testes aprovados; frontend idêntico a cd495d5, cujo resultado de referência também foi 76/671. Primeira tentativa interrompida após tempos limite sob carga; repetida com `--maxWorkers=2 --testTimeout=60000 --hookTimeout=60000`.
- Logs no servidor: `/tmp/checkin-a1-pg-focused.log`, `/tmp/checkin-a1-back-final.log`, `/tmp/checkin-a1-base-final.log`, `/tmp/checkin-a1-front-retry.log` e `/tmp/checkin-baseline-front-retry.log`. Nenhum serviço de produção ou Oracle foi usado.
