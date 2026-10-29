# Contrato de check-in A0 — v1

Escopo exclusivo da unidade `sansaude`, também imposto no servidor. Booking e Appointment são fontes independentes; não reconciliar nem deduplicar entre fontes sem identificador Oracle validado. Antes de habilitar uma origem, definir política operacional conservadora para evitar envio duplicado entre fontes. A configuração e cada origem, bem como Oracle, começam desligados. Canal previsto: Meta dos lembretes; Baileys não participa. Não há envio, consulta Oracle, API ou interface nesta etapa.

## Dados

`CheckIn`: `id`, `unit`, exatamente um de `appointment` ou `booking`, `source_revision`, `cycle`, `scheduled_at` (UTC, anulável), `planned_send_at`, `sent_at`, `response_deadline`, `responded_at`, `attendance_checked_at`, `message_id`, `provider_message_id`, `response`, `attendance`, `version`, `created_at`, `updated_at`. A identidade é origem + revisão + ciclo; Appointment usa sua revisão, Booking usa 1 até haver mecanismo explícito de revisão. O texto original de Booking permanece intacto: horário normalizado nulo requer revisão, sem inferência. Novos ciclos são explícitos e não sobrepõem ciclos anteriores. `checkin.sources.source_snapshot` adapta cada origem separadamente; aceita horários ISO ou `dd/mm/aaaa HH:MM:SS` de Booking e retorna UTC, deixando nulos os valores inválidos, inexistentes ou ambíguos no fuso.

`response`: `pending`, `sent`, `confirmed`, `cancelled`, `no_response`. `cancelled` é solicitação de cancelamento para a equipe: não altera reserva nem agenda e não escreve no Oracle. `attendance`: `unknown`, `attended`, `absent`. Dimensões independentes; para apresentação, comparecimento conhecido prevalece. Sem resposta não significa falta. Após o prazo, resposta tardia ainda pode ser registrada. Correções de operador exigem motivo; registre conflitos e revisão humana sem apagar histórico.

`Event`: `checkin`, `idempotency_key`, `origin` (`automatic`, `operator`, `oracle`), `actor`, `reason`, `previous_response`, `response`, `previous_attendance`, `attendance`, `evidence`, `occurred_at`, `recorded_at`, `version`. Chave única por check-in; versão crescente. A operação `checkin.services.transition` bloqueia a linha, exige versão e chave, retorna o evento anterior em repetição idêntica e rejeita chave reutilizada com outro conteúdo. Origem Oracle só registra `attended` com evidência `cd_atendimento_present: true`; chave de junção exige validação em homologação, sem correspondência permanece desconhecido. A falta depende de regra e evidência aprovadas, ou correção manual auditada.

`Configuration`: `unit`, `enabled`, `booking_enabled`, `appointment_enabled`, `oracle_enabled`, `channel=meta`, `timezone=America/Sao_Paulo`, `weekdays=[0,1,2,3,4]` (segunda = 0), `business_start=08:00`, `business_end=18:00`, `holidays=[]` (datas ISO locais), `lead_value=24`, `lead_unit=hours` (ou `days`). A futura programação antecipa o horário calculado para o último instante comercial permitido; definir precisão do limite de fechamento na implementação C. Prazo padrão previsto: horário do atendimento. Criação tardia vira revisão, sem envio após atendimento ou fora da janela.

## API prevista para A1/B (não implementada)

- `GET /api/v1/checkins/` e `GET /api/v1/checkins/{id}/`: lista e detalhe segregados por unidade, incluindo dimensões e versão; filtros por data do atendimento, origem e estados.
- `POST /api/v1/checkins/{id}/transition/`: `version`, `idempotency_key`, `response` e/ou `attendance`, `reason`; ator e unidade vêm da autenticação. Conflito de versão/chave ou revisão antiga retorna 409; validação retorna 400; acesso negado 403.
- `GET` e `PATCH /api/v1/checkin-configuration/`: configuração da unidade autenticada, validação explícita e salvamento por ação. Leitura exige `checkin: read`, mutação `checkin: write`. Não administradores começam sem concessão; unidade diferente de Sansaúde é negada mesmo para administradores.

## Interfaces de integração previstas

C recebe identidade da origem, revisão/ciclo, horário e configuração; retorna intenção idempotente e resultado `accepted`, `uncertain` ou `failed`, com ID do provedor quando confirmado. Apenas aceite confirmado marca `sent`; resultado incerto não é reenviado cegamente. Respostas “Confirmar” e “Solicitar cancelamento” exigem correlação com mensagem/ciclo; ambiguidades ou revisão antiga vão à equipe.

D recebe identificador validado e retorna correspondência única com `cd_atendimento_present`; é somente leitura, desligado e sem consulta em tempo de relatório. Correspondência ausente ou ambígua não implica falta. E consome registros locais por data do atendimento e unidade, sem contar eventos como agendamentos; mantém desconhecidos e denominadores explícitos. Exemplos compartilhados: `backend/checkin/fixtures/contracts.json`.

## Migração e reversão

A migração é aditiva, não infere check-ins para dados antigos. Para reversão operacional sem perda, desligue as funcionalidades e mantenha tabelas. O rollback físico remove as tabelas novas e seus dados: antes, exporte e verifique backup recuperável dos registros de check-in e eventos. Não reescreva migrações antigas.
