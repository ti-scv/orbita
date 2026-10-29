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
