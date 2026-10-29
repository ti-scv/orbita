# 35h — inventário inicial de autorização

Base auditada: f89c7c9. As seções são alternativas (OU); GET/HEAD/OPTIONS exigem leitura, demais métodos escrita. O proxy aplica a mesma tabela à interseção do vínculo, perfil e teto da conexão; a origem também autoriza a chave. Os endpoints abaixo podem ter restrições adicionais de papel, escopo, validação e idempotência. Os nomes `overview`, `messages`, `groups` e `issues` correspondem às quatro subáreas de Mensagens.

| Recurso/ações | Hoje: leitura / escrita | Uso esperado e pontos a verificar |
| --- | --- | --- |
| cases: lista, detalhe, operators, metrics, export, timeline, communications; act | messages, appointments, issues ou campaigns / mesmos, no nível do método | O filtro de finalidade agora usa o nível do método e o teto efetivo federado. Ainda falta definir e aplicar o contexto de Grupos e confirmar a matriz de finalidades e subáreas. |
| cases/health | messages E issues E reports E (settings OU operationsAdmin) / não aplicável | Agregado da unidade inteira; cada área dos dados deve autorizar a leitura. |
| contacts: lista, detalhe; review | messages, appointments, issues ou campaigns / mesmos | Atendimento em Pendências/Agendamentos; revisão altera também PatientPhone e mensagens. Filtro de eventos adicional usa permissions locais. |
| movements: lista, detalhe; criar, confirm | messages, appointments ou issues / mesmos | Atendimento em Pendências/Agendamentos; confirmar altera agendamento. Revisar acesso genérico por messages. |
| agenda-items: lista, detalhe, types, filter_options, export, communications | appointments; com group também groups; com operational_pending=true também issues / appointments | Grupos/Pendências precisam de consultas filtradas; types e detalhe chamados sem filtro na tela de Pendências. Verificar se filtros são aplicados por cada ação antes de autorizar. |
| appointments: lista, detalhe, export, communications | appointments; com group também groups; com operational_pending=true também issues / appointments | Compartilhado entre Agendamentos, Grupos e Pendências; conferir filtros em cada ação. |
| indicators | overview / overview | Visão geral. |
| messages: lista, detalhe; retry, simulate | messages / messages | Mensagens; conferir ações compartilhadas com outras telas. |
| replies: lista, detalhe | messages / messages | Mensagens; comunicações também estão embutidas em cases e appointments. |
| appointment-groups: lista, detalhe; schedule, dispatch-now | groups / groups | Grupos. |
| issues: lista, detalhe; resolve | issues / issues | Pendências; também usado em Agendamentos. |
| campaigns, sheet-imports | campaigns / campaigns | Importa CROSS; schema de sheet-imports também permite operationsAdmin em leitura. |
| preparations, policies, sources, flow-rules, flow-runs | settings ou operationsAdmin / mesmos | Configurações; verificar compatibilidade dos acessos legados. |
| layouts, templates | settings, operationsAdmin ou campaigns / mesmos | Configurações e CROSS; distinguir leitura compartilhada de escrita de configuração. |
| rules, imports, audit, logs, control, meta-configuration, oracle-agendas, oracle-configuration, instance-keys, remote-instances, members, units, users, permission-roles | settings / settings | Configurações; verificar restrições adicionais e disponibilidade federada. |
| reports, report-requests, report-access, report-connections, report-app-connections, report-recipients, report-grants, report-automations, report-executions, report-snapshots, report-snapshot-runs, report-schedules | reports / reports | Relatórios; conferir filtros e restrições próprias. |
| report-whatsapp | reportWhatsApp / reportWhatsApp | WhatsApp independente de Relatórios. |
| meta-costs | costs / costs | Custos Meta. |
| workspace | qualquer seção não none / qualquer seção não none | Contexto compartilhado; conferir métodos efetivamente oferecidos. |
| tests | appointments ou overview / mesmos | Testes operacionais; conferir operação e escopo. |

Este inventário é inicial: não certifica que todas as ações, suas consultas internas e os caminhos federados estejam corretos. `SectionPermission` aplica a tabela localmente; `RemoteProxyView` a aplica antes de encaminhar; a autenticação por chave limita o papel na origem. A lista de recursos federáveis é separada em `core/federation_auth.py` e não inclui todos os recursos locais.

## Correção parcial de agenda

A autorização de `filter_options` agora exige Agendamentos, pois essa ação consulta a unidade inteira sem aplicar os filtros de grupo ou pendência. Em `types`, quando esses filtros autorizam a consulta, as finalidades CROSS e os tipos Oracle vêm dos casos filtrados; os tipos fixos de agendamento continuam disponíveis. A tela envia o filtro na consulta de tipos e no detalhe inicial. O teste local cobre leitura permitida e negada e isolamento das finalidades; o teste do proxy verifica que pedidos negados não são encaminhados.

A auditoria continua incompleta: Grupos usa o detalhe de atendimento, mas `cases`, `contacts` e `movements` ainda não limitam objetos ao grupo, e as demais ações e seus efeitos precisam de cobertura local e federada. Não há certificação da separação de permissões.


## Continuação 35h2 — achados ainda não corrigidos

- `CaseViewSet.health` não usa `get_queryset`: retorna contagens de mensagens,
  pendências, importações e relatórios da unidade inteira. A autorização genérica
  de `cases` precisa ser revista para essa ação separadamente.
- `CaseViewSet.get_queryset` e `ContactViewSet.get_queryset` consultam
  `local_permissions` do usuário da origem. No proxy, `remote_access` calcula a
  interseção de seções, mas `remote_http` encaminha apenas o limite de papel.
  Assim, permitir uma requisição na borda não assegura que o filtro da origem
  respeite as seções efetivas do usuário remoto. Testar a resposta real da
  origem, além de verificar que o proxy não encaminha requisições negadas.
- `required_sections` trata as seções como alternativas: em consultas de
  `appointments` e `agenda-items` com `group`, Agendamentos ainda autoriza a
  requisição mesmo sem Grupos. O queryset valida a unidade do grupo, mas o
  requisito de acesso à subárea e o escopo dos objetos associados precisam ser
  verificados em todas as ações e também na federação.
- `AppointmentDetail` e `CaseDetail` consultam casos, histórico, comunicações,
  contatos e movimentações sem informar o contexto do grupo. A correção de
  escopo deve acompanhar essas chamadas e as ações correspondentes; simplesmente
  autorizar `groups` no recurso genérico permitiria acesso fora do grupo.

Estes achados são diagnóstico, não certificação nem correção dos passos 1–4.


## Continuação 35h3 — correção parcial de cases

O filtro de finalidade de casos usa leitura ou escrita conforme o método, inclusive
para detalhe, timeline, comunicações, métricas, exportação e ação. Assim, leitura
de CROSS combinada com escrita de Mensagens não autoriza alterar um caso CROSS.
A saúde operacional exige leitura de Mensagens, Pendências, Relatórios e
Configurações ou Administração, pois agrega dados de todas essas áreas.

O proxy envia a interseção de seções à origem; a autenticação por chave valida
o teto e a origem o intersecta com o emissor e o papel da chave. Antes de
encaminhar cases, o proxy exige suporte declarado no manifesto, bloqueando
origens antigas que ignorariam o teto. O teste exercita a resposta da origem
com o teto do proxy, além de autorizações e recusas locais e na borda.

Ainda não há certificação de todas as subáreas: Grupos continua sem contexto
de grupo em cases, e a matriz genérica de mensagens/agendamentos/pendências
para finalidades básicas permanece a ser confirmada. A correção de Grupos
exige limitar os objetos e acompanhar as chamadas de detalhe da interface.
O problema análogo em contacts permanece fora deste escopo.
