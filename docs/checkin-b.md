# Check-in — parte B

A navegação em /check-in usa a permissão checkin do A0, restrita a sansaude; usuários com leitura veem a lista e detalhes, enquanto escrita habilita os modais de configuração e ação. As duas dimensões aparecem separadas e a etiqueta prioriza comparecimento conhecido. Filtros por período do atendimento, origem, resposta e comparecimento, paginação, erros e conflito 409 estão previstos. Ação manual envia versão, chave de idempotência e motivo; a mesma chave é conservada numa nova tentativa inalterada. Cancelamento é uma solicitação, não altera a reserva. A configuração salva explicitamente os campos do A0, com as origens e integração Oracle apresentadas separadamente. Não há migração.

## Integração necessária

- A0 não implementa APIs. Integrar A1/C aos endpoints GET /api/v1/checkins/, GET /api/v1/checkins/{id}/, POST /api/v1/checkins/{id}/transition/ e GET/PATCH /api/v1/checkin-configuration/; exigir no servidor unidade sansaude e permissões checkin:read/write em todas as operações. Até então a tela mostra erro de acesso à API e não deve ser considerada funcional em produção.
- A lista assume resposta paginada DRF {results,count,next} e filtros start, end, source, response, attendance e page. O contrato não especifica o formato da paginação nem nomes dos filtros; alinhar com A1 antes da integração. Detalhe assume campos do CheckIn diretamente, com IDs de appointment/booking. Os estados e campos do A0 não foram alterados.
- O contrato não define mensagem configurável: propor campo e validação à parte C, com interface de edição em modal após formalização. Não inventar campo no PATCH do A0.
- O contrato ainda não define representação do check-in no detalhe da reserva Autoagendamento. Integrar a etiqueta nesse detalhe após A1 definir o adapter e autorização, sem tratar confirmação da reserva como resposta de check-in.
- App.tsx, routes.ts, types.ts e permissions.ts têm alterações pequenas de integração e precisam ser reconciliadas com as outras branches; não há mudança de URL backend, settings ou beat.
- A ativação das origens exige política operacional conservadora para evitar duplicidade entre fontes independentes; Oracle exige chave validada e homologação. A configuração permanece desativada por padrão no A0.

## Testes

Os testes de interface usam API simulada conforme as hipóteses acima. Resultados concretos das suítes são registrados abaixo após execução.

- Build frontend (Node 24): aprovado.
- Testes específicos com API mockada: 4 aprovados, incluindo nova execução após o último ajuste.
- Suíte frontend na branch: 669 aprovados e 6 falhas por limite de 5 segundos, em quatro arquivos existentes, sob carga; os quatro arquivos foram repetidos com limite de 30 segundos e passaram (16 testes). Na base cd495d5, 669 passaram e dois desses mesmos arquivos tiveram um timeout cada. A suíte completa não passou de uma vez no limite padrão.
- Backend em PostgreSQL isolado, rede sem acesso externo e chave Oracle fictícia: 1300 aprovados, 5 ignorados, 2 falhas conhecidas de ambiente: chave Meta de teste ausente em test_cross_meta_payload e layout.json ausente em test_medical_indicators. O backend desta branch é idêntico à base (git diff cd495d5 -- backend vazio), portanto não houve mudança de backend a comparar.
- Uma tentativa prévia em SQLite não é comparável: 1251 aprovados, 19 ignorados, 7 falhas e 30 erros; incluiu testes que exigem PostgreSQL e não tinha chave Oracle fictícia.
- Não foi realizado teste visual em staging nem integração ponta a ponta com A1/C. Mensagem configurável e etiqueta no detalhe Autoagendamento permanecem pendentes da definição de contrato/adapter.
