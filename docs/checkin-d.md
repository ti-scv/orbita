# Check-in D — apuração Oracle

Esta entrega é um esqueleto isolado, sem consulta, conexão, credenciais, tarefa Celery ou ativação de Oracle. Não existe chave de junção homologada no A0; não se deve configurar nem invocar uma fonte real antes dessa homologação. Não houve acesso ao Oracle real e não há migração ou alteração do contrato.

`checkin.oracle_reconciliation.reconcile_batch` recebe uma fonte injetada e processa páginas de até 100 check-ins da Sansaúde, ordenados por ID local, somente com `enabled`, `oracle_enabled` e a origem correspondente habilitados. A fonte simulada devolve por ID local uma lista de indicadores booleanos de CD_ATENDIMENTO preenchido: uma única correspondência positiva registra `attended` via `transition`, com evidência mínima e chave idempotente. Nenhuma ou múltiplas correspondências são revisões; uma correspondência sem atendimento não estabelece falta. Divergências com estado conhecido são revisões, sem sobrescrever operador. Erros da fonte não expõem exceção ou credenciais, não avançam cursor e geram códigos genéricos de revisão. Eventos existentes impedem que reprocessamento silenciosamente desfaça correção manual.

O cursor retornado pertence ao chamador, que deve persistir o resultado apenas após tratar revisões; nenhuma persistência de cursor ou revisão é fornecida aqui. Recomeçar periodicamente no cursor zero é necessário para detectar atendimento tardio: um cursor crescente sozinho não detecta mudanças em registros antigos. O cursor não codifica dados Oracle. Interrupções podem reprocessar a página; a transição é idempotente. O resultado deve ser tratado como trabalho pendente, inclusive falhas e conflitos; não há fila de revisão nesta entrega.

## Integração pendente

- Homologar para cada origem uma chave Oracle exclusiva e estável, visão, janela e credencial de leitura, e testar cardinalidade; não unir Booking e Appointment. A interface simulada não comprova identidade. Definir política para resultados truncados, especialmente mais de uma linha.
- Implementar fonte real somente depois de aprovada: reutilizar `core.oracle_credentials` com configuração autorizada para Sansaúde, transação somente leitura, SQL parametrizado, limite por página e timeout de conexão/chamada; nunca registrar SQL sensível, credenciais ou dados clínicos. Essa fonte deve retornar no máximo dois resultados por registro para detectar ambiguidade. Não há SQL nem conector real nesta branch.
- Integrar tarefa e agendamento/beat centralmente após a fonte homologada; controlar concorrência, persistir cursor e revisões de forma durável e atômica, revalidar configuração no processamento e planejar varreduras para dados tardios. Não agendar a função isolada diretamente como tarefa de produção.
- A1 deve apresentar e resolver revisões de divergência, ausência, ambiguidade, conflito e indisponibilidade com autorização de unidade; revisar também revisão obsoleta da origem. Se necessário, propor extensão do contrato para fila de revisão e cursor, sem alterar campos A0 nesta branch.
- A ativação e configuração devem ser impostas no servidor. Revisar alteração de configuração durante execução, desativação, política de recuperação e operação antes de habilitar. Não há endpoint novo nem alterações em arquivos centrais.

## Testes

`backend/tests/test_checkin_oracle_d.py` usa apenas mocks: padrão desligado, restrição de unidade/origem e limites, correspondência única e ambígua, atendimento tardio, reprocessamento, timeout sem vazamento e divergência. A primeira execução específica apontou erro no mock que incluía registros fora da página; o teste foi corrigido. A nova execução específica passou: 4 testes, SQLite isolado, sem rede. Suítes completas foram iniciadas em contêineres isolados; com carga elevada e swap esgotada no servidor, as suítes completas foram interrompidas para reduzir pressão. A comparação com A0 permanece pendente; não há evidência de ausência de regressões. Reexecutar as suítes completas de frontend e backend da branch e A0 em ambiente isolado com recursos suficientes antes da integração.

## Continuação 38-D-2: análise das chaves

A leitura do código identifica `Booking.slot_id` como `CD_IT_AGENDA_CENTRAL` da visão `_003`; a consulta existente à visão `_006` usa paciente e data/hora e não demonstra que `_006` disponibilize aquele identificador ou que ele seja único. `Appointment.external_id` é alimentado por `CD_AGENDA` de conectores diferentes, sem demonstração de equivalência com um identificador de atendimento na `_006`. Esses nomes não comprovam uma junção entre visões nem entre origens. Um teste com mock valida apenas a lógica assumida, não a existência, cardinalidade ou significado da chave na fonte. A homologação da visão, chave por origem e credencial continua necessária antes de instalar consulta ou agendamento real; não foi feita conexão Oracle.

## Verificação 38-D-2

Em contêineres isolados e com o lock compartilhado, o frontend passou: 76 arquivos e 671 testes, Vitest com no máximo dois workers e caches desativados; a árvore `frontend` é idêntica à de `cd495d5`. Os quatro testes específicos D também passaram em PostgreSQL isolado, sem acesso ao Oracle.

A suíte completa em SQLite produziu 1.255 aprovados, 7 falhas e 30 erros na branch; A0 produziu 1.251 aprovados, 7 falhas e 30 erros. Os mesmos 30 erros e seis falhas coincidem; o teste de concorrência em falha variou entre execuções. A ausência da chave Oracle fictícia de teste gerou erros de setup e o SQLite não oferece as mesmas garantias de concorrência do PostgreSQL. Comparação em PostgreSQL, com chave fictícia de teste e banco isolado, está pendente de execução sob o lock.
