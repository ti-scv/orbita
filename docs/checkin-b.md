# Check-in — parte B

A navegação em /check-in usa a permissão checkin do A0, restrita a sansaude; usuários com leitura veem a lista e detalhes, enquanto escrita habilita os modais de configuração e ação. As duas dimensões aparecem separadas e a etiqueta prioriza comparecimento conhecido. Filtros por período do atendimento, origem, resposta e comparecimento, paginação, erros e conflito 409 estão previstos. Ação manual envia versão, chave de idempotência e motivo; a mesma chave é conservada numa nova tentativa inalterada. Cancelamento é uma solicitação, não altera a reserva. A configuração salva explicitamente os campos do A0, com as origens e integração Oracle apresentadas separadamente. Não há migração.

## Integração com A1

A branch feature/checkin-a1 foi incorporada por merge local. A lista, detalhe, transição e configuração usam os endpoints A1 autenticados, com os filtros e paginação implementados pela API. A etiqueta no detalhe do Autoagendamento usa `booking.checkin` devolvido pela A1 somente quando o usuário tem leitura de check-in; comparecimento conhecido prevalece, sem confundir a confirmação da reserva com a resposta de check-in. A configuração grava apenas os campos do contrato A0, via PATCH explícito.

- Mensagem: o contrato A0 e a API A1 não definem campo de texto. O modal apresenta o campo desabilitado e as opções de resposta acordadas; não envia nem persiste texto fictício. A parte C deve formalizar campos, validação e API e conectar esse campo quando disponíveis.
- `App.tsx`, `routes.ts`, `types.ts` e `permissions.ts` contêm pontos de integração mínimos com menu, rota e permissão; `AutoAgendaWorkspace.tsx` consome o adapter A1. A1 registra endpoints em `backend/config/urls.py` e adapters em `backend/core/serializers.py` e `backend/autoagenda/api.py`; reconciliar com as demais partes.
- A configuração A0 não possui controle de versão, portanto gravações concorrentes podem sobrescrever os mesmos campos. Proposta de versionamento registrada em `docs/checkin-a1.md`.
- A ativação das origens exige política operacional conservadora para evitar duplicidade entre fontes independentes; Oracle exige chave validada e homologação. A configuração permanece desativada por padrão. Nenhuma migração foi acrescentada nesta parte.

## Testes da etapa anterior, antes do merge A1

Os testes de interface desta etapa usaram API simulada.

- Build frontend (Node 24): aprovado.
- Testes específicos com API mockada: 4 aprovados, incluindo nova execução após o último ajuste.
- Suíte frontend na branch: 669 aprovados e 6 falhas por limite de 5 segundos, em quatro arquivos existentes, sob carga; os quatro arquivos foram repetidos com limite de 30 segundos e passaram (16 testes). Na base cd495d5, 669 passaram e dois desses mesmos arquivos tiveram um timeout cada. A suíte completa não passou de uma vez no limite padrão.
- Backend em PostgreSQL isolado, rede sem acesso externo e chave Oracle fictícia: 1300 aprovados, 5 ignorados, 2 falhas conhecidas de ambiente: chave Meta de teste ausente em test_cross_meta_payload e layout.json ausente em test_medical_indicators. O backend desta branch é idêntico à base (git diff cd495d5 -- backend vazio), portanto não houve mudança de backend a comparar.
- Uma tentativa prévia em SQLite não é comparável: 1251 aprovados, 19 ignorados, 7 falhas e 30 erros; incluiu testes que exigem PostgreSQL e não tinha chave Oracle fictícia.
- À época, não havia teste visual nem integração ponta a ponta com A1/C; a continuação abaixo registra a integração A1 e o teste visual.

## Continuação 38-B: validação da integração

- Build frontend Node 24 e quatro testes específicos: aprovados. Testes A1 em PostgreSQL isolado: 5 aprovados.
- Staging 8116: PostgreSQL e Sansaúde fictícios, `SEND_MODE=simulated` (padrão), sem worker ou Oracle. Navegador headless verificou lista, modal e etiqueta da reserva em claro e escuro, além dos limites do modal. Também salvou e releu uma configuração e executou uma transição auditada pela interface usando a API real; capturas em `docs/checkin-b-capturas/`.
- A edição do texto da mensagem depende da definição e implementação da parte C; por isso permanece indisponível.
