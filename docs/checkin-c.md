# Check-in C — implementação parcial

Base: cd495d5. A entrega não está pronta para ativação. Não há criação de intenções, fila, tarefa, transporte ou tratamento de respostas nesta branch. Os defaults do A0 permanecem desligados; nenhum envio real foi feito.

## Implementado

`checkin.programming.calculate_schedule` calcula em UTC a antecedência em horas ou dias de duração, convertendo a janela comercial pelo fuso configurado. O fechamento é exclusivo, com precisão de microssegundo: 18:00 não é permitido e o último instante é 17:59:59.999999. Dias bloqueados e feriados antecipam para a janela anterior. Limites de janela ambíguos ou inexistentes por mudança de fuso exigem revisão. Horário de envio que já passou exige revisão; o prazo é o horário do atendimento. O cálculo valida unidade e configuração e não persiste nem agenda nada. `checkin.message.message_text` produz o texto curto sem informações clínicas; ainda não é template Meta aprovado.

## Integração pendente obrigatória

- Criar intenção idempotente por ciclo/destinatário, com isolamento de Sansaúde e opção específica de cada origem; definir política conservadora entre origens antes de habilitar. Persistir pendências para horário ausente ou vencido e definir criação explícita de ciclos.
- Integrar tarefa/beat e fila `messaging`, validando novamente origem, revisão, cancelamento, reagendamento, destinatário, unidade, configuração e janela imediatamente antes de enviar. Definir template Meta aprovado com opções; usar transporte de lembretes e guardar identificadores, com controle concorrente e resultado incerto sem reenvio cego. Só aceite confirmado transiciona para `sent` pelo serviço A0. Testes devem usar transporte simulado exclusivamente.
- Integrar webhook `responses.services.apply_reply`: correlação segura por contexto, canal, destinatário, mensagem, ciclo e revisão, e encaminhamento de respostas ambíguas, sem contexto, fora de ordem ou antigas para pendência. Tratar duplicatas idempotentemente. Solicitação de cancelamento cria pendência sem escrever na agenda nem no Oracle. Integrar prazo e `no_response` sem confundir com comparecimento.
- Integrar configuração com A1/B e estabelecer forma operacional de revisão. Não mudar os nomes ou estados do contrato A0. Nenhuma migração foi criada nesta entrega; eventual persistência de intenção deve ser aditiva e reversível e reconciliada na integração.
- Testar concorrência, falhas, reinício, resultado incerto, respostas e invalidação de origem antes de ativar.

## Testes

Os testes específicos em `backend/tests/test_checkin_programming.py` cobrem janela, abertura/fechamento, feriado, horas/dias, atraso, fuso ambíguo e texto. As suítes completas são executadas isoladamente com SQLite de teste e transporte simulado; consultar os resultados registrados no commit de documentação. Não se acessou Oracle nem se enviou WhatsApp.

Primeira execução específica: 5 passaram (antes da inclusão do teste do texto e da troca de validação por `clean`). Repetição com 6 casos e suítes completas da base e da branch foram iniciadas, ainda sem resultado no momento deste registro; portanto não há comprovação de ausência de regressão. A preparação das dependências frontend também foi iniciada. Os comandos usam contêineres separados; backend sem rede e banco SQLite temporário.

## Continuação 38-C-2 — ciclos

`checkin.intents.create_intent` cria um ciclo explícito por origem e revisão, serializado pela configuração e pela origem, e retorna o ciclo já existente em chamadas repetidas. Exige Sansaúde, configuração habilitada e exatamente uma das origens habilitada; Appointment precisa estar agendado e Booking confirmado. Um ciclo pendente ou enviado impede outro ciclo da mesma origem até revisão ou conclusão. Esta política conservadora também bloqueia ciclo novo após revisão da origem enquanto o anterior continuar ativo; a invalidação automática permanece pendente. Horário inválido ou janela vencida mantém o ciclo sem data de envio e cria uma pendência de revisão. Não há migração nova. Essa função ainda não é chamada automaticamente, não identifica destinatário e não cria Message; não habilita envio.

A integração com fila Meta, validação na expedição, correlação de respostas, prazo, invalidação e a política para destinatários continuam pendentes. A pendência de programação usa Issue existente e identifica o ciclo na descrição; não existe ainda interface específica de revisão. Não ativar em produção antes de integrar e validar esses pontos, inclusive o template Meta aprovado.

Testes específicos em contêiner sem rede e banco SQLite: `pytest tests/test_checkin_intents.py tests/test_checkin_programming.py -q -p no:cacheprovider`, 10 passaram. As suítes completas foram enfileiradas com `flock /tmp/orbita-suite.lock`, backend com transporte simulado e frontend com `--maxWorkers=2`, caches desativados e `VITE_CACHE` em `/tmp`; resultados precisam ser conferidos antes de afirmar ausência de regressões.

## Continuação 38-C-3 — manutenção periódica parcial

O beat chama `checkin.tick` a cada minuto; a tarefa só atua quando `CHECKIN_SCHEDULER_ENABLED=1` e a configuração Sansaúde está habilitada. Processa prazos vencidos de ciclos já enviados pela transição auditada A0, idempotentemente, sem inferir comparecimento; revisão antiga gera pendência. O interruptor adicional começa desligado. **Não habilitar:** esta etapa não cria ciclos automaticamente, mensagens ou envios; o restante da integração descrita acima continua obrigatório.

### Proposta para integração por destinatário (não implementada)

O contrato A0 tem um único `message_id`, `provider_message_id` e estado de resposta por ciclo, enquanto Appointment pode ter vários telefones. Antes de habilitar envios a múltiplos destinatários, propor uma tabela aditiva de entregas por check-in e telefone, com chave única, vínculo de Message e IDs do provedor, e definir como respostas divergentes e aceites parciais se refletem no estado único do ciclo. Não alterar os campos ou estados congelados sem reconciliar essa política. Para Booking é necessário validar o telefone da conversa e mudanças no horário, pois a revisão da origem ainda é fixa em 1. Até a solução e os testes de concorrência e de invalidação estarem integrados, não ligar o agendador nem a fila.

Verificação específica em contêiner sem rede, SQLite temporário e `SEND_MODE=simulated`: `pytest tests/test_checkin_tasks.py tests/test_checkin_intents.py tests/test_checkin_programming.py -q -p no:cacheprovider`, 12 passaram. Suítes completas desta continuação foram colocadas na fila de `/tmp/orbita-suite.lock`; consultar `/tmp/38c3-back.log`, `/tmp/38c3-back.exit`, `/tmp/38c3-front.log` e `/tmp/38c3-front.exit` para os resultados, sem presumir sucesso. As execuções 38-C-2 registraram frontend 671 testes aprovados; backend da branch teve 6 falhas e 30 erros, e a base teve 8 falhas e 30 erros. Há falhas de concorrência e configuração no ambiente SQLite além das exceções aceitas originalmente, portanto não se demonstrou ausência de regressão.

## Continuação 38-C-4 — descoberta automática

Com `CHECKIN_SCHEDULER_ENABLED` e configuração habilitados, o tick descobre até 100 Appointment futuros agendados ou Booking confirmados por execução, conforme a única origem habilitada. A criação usa o serviço idempotente existente, que revalida origem e configuração sob bloqueio; ciclos existentes e ciclos ativos são excluídos da descoberta. Horários inválidos ou vencidos geram revisão. Booking usa revisão 1 do contrato e requer revalidação do horário antes de qualquer envio. A descoberta e o envio continuam desligados por padrão.

Verificação específica, em contêiner sem rede, SQLite temporário e transporte simulado: 13 testes passaram (`test_checkin_tasks`, `test_checkin_intents`, `test_checkin_programming`).

### Mensagem por ciclo

`checkin.deliveries.create_message` cria uma prévia idempotente para um único contato: o primeiro `phone_numbers` do Appointment (com fallback para `phone`), como nos lembretes, ou o telefone da conversa do Booking. Normaliza o telefone e registra pendência se inválido. Exige template local `checkin_agendamento`, `pt_BR`, finalidade `checkin`, habilitado para teste, com campos `date` e `time` e texto exatamente correspondente ao conteúdo curto de check-in; a ausência gera pendência. Isso não comprova aprovação no catálogo Meta: aprovação, opções, mapeamento e validação do catálogo precisam ser integrados antes de qualquer envio. A função ainda não é chamada pelo tick nem coloca mensagens na fila. Nenhum envio foi realizado. A proposta de múltiplos destinatários permanece acima, sem alteração do contrato.
