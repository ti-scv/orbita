# Check-in da agenda do dia

Publicado em 03/11/2026. Rota `/check-in?unit=sansaude`.

## Configuração
O acompanhamento da Sansaúde usa a origem Agendamentos. Antecedência inicial: 3 horas; janela: 07:00–18:00; dias e feriados são editáveis no modal. Fora da janela, o horário recua para o último fechamento permitido. 08:00 e 09:30 saem no fechamento anterior; 10:00 sai às 07:00. Não dispara retroativamente uma janela já vencida.

O envio inicia desligado. Selecione um template Meta validado e mapeie cada parâmetro para paciente, hoje/amanhã, data, hora, procedimento ou profissional. Exige os botões SIM, NÃO e REMARCAR. Hoje/amanhã é calculado em relação ao dia do envio; para datas mais distantes usa dd/mm/aaaa. Preserva a política de números autorizados e o teto diário do transporte Meta. Nenhum template é criado ou aprovado automaticamente.

## Origem e conclusão
Os agendamentos importados consultam a conexão Oracle da unidade; as reservas do autoagendamento usam a própria conexão validada do autoagendamento. Nunca correlacionar dados entre produção e homologação. Chave: IT_AGENDA_CENTRAL.CD_IT_AGENDA_CENTRAL. Só conclui quando há CD_ATENDIMENTO em ATENDIME com o mesmo paciente e a data do item corresponde ao agendamento. Guarda o número do atendimento no evento auditado. Atualiza o status local para completed e cancela notificações pendentes da mesma revisão. Oracle recebe apenas SELECT em transação somente de leitura. Atendimento aberto é o critério operacional solicitado; não implica procedimento clínico terminado. Sem vínculo não significa falta.

## Execução
Celery checkin.tick: 60 segundos; checkin.reconcile_oracle: 300 segundos. Coleta local independente do envio, permitindo acompanhamento sem template. SIM confirma; NÃO solicita cancelamento; REMARCAR solicita reagendamento. Pedidos geram pendências, sem alterar agenda hospitalar. Sem contexto de provedor, não vincula uma resposta arbitrariamente. A lista abre hoje e filtra período, paciente/código, origem, resposta e comparecimento. Uma linha por agendamento, com última mensagem enviada e última resposta.

## Publicação e reversão
Código integrado em `/opt/orbita/deploy/checkin-day`, frontend e backend preservados nessa pasta. Compose adicional `/opt/orbita/compose.checkin-day.yaml` após os overrides existentes. Imagens orbita-api:checkin-day e orbita-panel:checkin-day. Migração checkin.0016 aditiva. Backup anterior em /root/scv-before-checkin-day-20261103.dump. Para reverter a aplicação, retirar somente o override de checkin do comando de implantação; preservar o banco e os eventos, sem reversão destrutiva das migrações.

## Verificação
Migrações aplicadas em PostgreSQL isolado. Validados janela, fim de semana/feriado, salvamento, listagem, isolamento entre unidades, conclusão por fonte Oracle injetada, parâmetros de template e respostas SIM/NÃO/REMARCAR. Testes com dados fictícios e sem transporte externo. Build TypeScript/Vite concluído. No ambiente publicado: endpoints autenticados responderam 200 e a conciliação de leitura Oracle respondeu ok.
