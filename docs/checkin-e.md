# Check-in — parte E

## Implementado

Fonte local `checkin_summary_v1`, agregada sobre `CheckIn`, um registro por ciclo, sem ler eventos nem dados pessoais ou Oracle. O intervalo inclusivo usa `scheduled_at` e fuso da unidade; horários nulos ficam fora de qualquer período. Fontes Booking e Appointment permanecem independentes. Enviados são os ciclos com `sent_at` preenchido; confirmados, sem resposta e comparecimento usam as dimensões atuais. Confirmação / enviados e falta de confirmados / confirmados com comparecimento conhecido mostram numerador, denominador e percentual; zero produz valor vazio. Confirmações manuais podem existir sem envio, portanto a primeira taxa pode superar 100%. Comparecimento desconhecido, inclusive entre confirmados, aparece separado.

O comando `configure_checkin_report` cria uma definição e layout tabular ReportCanvas na unidade `sansaude`, desativados, sem concessões, envios, migrações ou modificações em registros existentes. Não foi executado contra nenhum banco persistente. A fonte recusa outra unidade no servidor. O relatório só aparece depois de integração e ativação deliberada.

## Integração e pendências

- `operations/report_canvas/native.py`: registro mínimo da fonte; reconciliar no merge com registros de outras partes.
- O mecanismo atual de Canvas autoriza pela seção de relatórios e permite usar um relatório como fonte de outro. Ainda é necessário impor também `checkin: read` em **todos** os caminhos de prévia, execução, exportação, composição e trabalhos assíncronos antes da ativação. A configuração desativada não é uma substituição para essa verificação. Não ativar até concluir e testar essa integração.
- O layout é tabular e ainda não contém os ícones estilo lâmpada solicitados. Ajustar usando o padrão visual existente na integração.
- Integrar permissões e catálogo com A1/B; não criar nova rota central nesta branch. Confirmar em homologação as regras de publicação e o comportamento de confirmação manual sem envio.
- Registros sem `scheduled_at` não entram nos totais do período; criar indicador separado de pendências de horário se necessário, sem atribuir data inferida.
- Nenhuma alteração de contrato ou migração foi feita.

## Testes

Teste dedicado `backend/tests/test_checkin_report.py` passou (1 teste, SQLite isolado): vazio, limite de período no fuso, confirmação e falta, desconhecidos, denominador zero, outra unidade e exportação PDF. A comparação de frontend no Node do host terminou com 527 testes aprovados, 2 falhos e 30 erros em ambas as versões, incluindo incompatibilidade de módulos; não valida regressão. A repetição com Node 24 foi interrompida sob carga alta, após um timeout. As suítes completas de backend em SQLite foram interrompidas sob forte pressão de memória e swap, com erros em ambas as versões; não houve comparação completa. SQLite não valida concorrência PostgreSQL. Logs em `/tmp/checkin-e-*`; repetir suítes em ambiente isolado adequado antes de integrar.
