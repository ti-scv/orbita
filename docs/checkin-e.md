# Check-in — parte E

## Implementado

Fonte local `checkin_summary_v1`, agregada sobre `CheckIn`, um registro por ciclo, sem ler eventos nem dados pessoais ou Oracle. O intervalo inclusivo usa `scheduled_at` e fuso da unidade; horários nulos ficam fora de qualquer período. Fontes Booking e Appointment permanecem independentes. Enviados são os ciclos com `sent_at` preenchido; confirmados, sem resposta e comparecimento usam as dimensões atuais. Confirmação / enviados e falta de confirmados / confirmados com comparecimento conhecido mostram numerador, denominador e percentual; zero produz valor vazio. Confirmações manuais podem existir sem envio, portanto a primeira taxa pode superar 100%. Comparecimento desconhecido, inclusive entre confirmados, aparece separado.

O comando `configure_checkin_report` cria uma definição e layout tabular ReportCanvas com ícone inspirado na lâmpada do sistema na unidade `sansaude`, desativados, sem concessões, envios, migrações ou modificações em registros existentes. Não foi executado contra nenhum banco persistente. A fonte recusa outra unidade no servidor. O relatório só aparece depois de integração e ativação deliberada.

## Integração e pendências

- `operations/report_canvas/native.py`: registro mínimo da fonte; reconciliar no merge com registros de outras partes.
- `operations/checkin_report_access.py`: exige `checkin: read` na unidade Sansaúde para o handler, inclusive ao ser fonte Canvas ou componente de composição. As prévias de layout e de fonte verificam a política efetiva da requisição antes de consultar ou servir cache; criação e download dos dois tipos de trabalho verificam a política efetiva. As tarefas e downloads revalidam a permissão local do solicitante; automações sem solicitante são recusadas para dados de check-in. Reconciliar com mudanças das partes A1/B e dos arquivos de APIs de relatórios no merge.
- Ícone em `operations/assets/checkin-lightbulb.png`, inserido no layout de novos relatórios pelo comando de configuração. Definições já existentes não são alteradas.
- Integrar permissões e catálogo com A1/B; não criar nova rota central nesta branch. Confirmar em homologação as regras de publicação e o comportamento de confirmação manual sem envio.
- Registros sem `scheduled_at` não entram nos totais do período; criar indicador separado de pendências de horário se necessário, sem atribuir data inferida.
- Nenhuma alteração de contrato ou migração foi feita.

## Testes

No PostgreSQL isolado, os quatro testes dedicados de `backend/tests/test_checkin_report.py` passaram: período/fuso, denominadores, unidade, PDF com ícone, prévia em cache, fonte composta, limite de chave e revogação de acesso em trabalho assíncrono. Oito testes existentes do Canvas para execução, fontes e prévia também passaram. Frontend completo com Node 24, dois workers e caches desativados: 76 arquivos e 671 testes aprovados tanto nesta branch quanto na base `cd495d5`. Backend completo em PostgreSQL isolado, sob o bloqueio compartilhado e com a mesma configuração: nesta branch, 1.304 passaram, 5 foram ignorados e 2 falharam; na base `cd495d5`, 1.300 passaram, 5 foram ignorados e as mesmas 2 falharam. As falhas conhecidas são `test_cross_meta_payload.py::test_cross_body_parameters_are_in_meta_request` (Meta) e `test_medical_indicators.py::test_all_sections_share_readonly_session_and_dates` (layout). Logs: `/tmp/checkin-e-pg-key-back.log`, `/tmp/checkin-e-pg-key-base-back.log`, `/tmp/checkin-e-suite-front.log` e `/tmp/checkin-e-suite-base-front.log`.
