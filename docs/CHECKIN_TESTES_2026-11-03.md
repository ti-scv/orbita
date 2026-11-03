# Verificação do check-in — 03/11/2026

Backend testado: sha256:852199ee10c0c77b76a8bcd42eda3a048c8af88374ca7e0ac7e8f0fa51470fb1. Frontend testado: sha256:a632854460fe44074c2858548f751481e27758f3f09c5d2794c5b9eb7f43d145. São as imagens publicadas.

Ambiente temporário: PostgreSQL em tmpfs, rede Docker interna, API sem acesso externo, SEND_MODE simulated e META_REAL_ENABLED 0. Nenhuma mensagem real; sem alterações nos dados Oracle.

Resultados aprovados:
- Migrações completas em base vazia.
- Antecedência de 3h: consultas 08h/09h30 antecipadas para 18h do dia anterior; 10h enviada às 07h; 15h às 12h. Feriado recua para o dia anterior permitido.
- Salvamento de configuração, bloqueio de ativação sem template e isolamento entre unidades.
- Conclusão local com fonte Oracle simulada positiva e cancelamento da notificação pendente.
- Mapeamento de parâmetros e tratamento de SIM, NÃO e REMARCAR.
- Fila com SimulatedTransport: aceitação registrada; segunda tentativa não duplica o envio; hoje/amanhã calculado corretamente.
- Resposta pela função de entrada responses.services.apply_reply; webhook duplicado não duplica resposta; contexto desconhecido preserva decisão anterior.
- Navegador com as imagens publicadas: login e abertura da rota /check-in, três registros de hoje com última resposta visível. Filtros por busca (1), confirmação (2), concluído (1), autoagendamento (0), período hoje+amanhã (4); resposta inválida retorna 400.
- Navegador: editar antecedência para 4 horas, fechamento 17:30 e feriado 20/11/2026; salvar e reabrir preserva todos os valores, template e mapa.
- Oracle de produção: leitura de 10 itens vinculados ao acompanhamento sem erro. O cenário de atendimento positivo foi exercitado com fonte simulada, sem forçar estados de pacientes reais.

Os testes HTTP de navegador foram em base fictícia, não na base de produção. Em produção, envios continuam desligados. Scripts de regressão em deploy/checkin-day/tests. Ambiente temporário removido ao final.
