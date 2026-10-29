# Tarefa 35 — levantamento inicial

Estado: **não implementada**. Este documento descreve o HEAD `f253842` e não certifica as permissões pedidas. Nenhuma migração foi aplicada.

## Modelo atual

Não há cadastro de papéis editáveis nem tela “Tipos de permissões” nesta revisão. `Membership` vincula usuário e unidade a um dos perfis fixos `admin`, `operator` e `viewer` e a um JSON de permissões por seção. `RemoteMembership` e `RemoteInstance.remote_permissions` também armazenam políticas. `core.access.role_permissions` combina os valores explícitos com padrões do perfil e limita edição para `viewer` e seções administrativas. O superusuário recebe a política administrativa. O formulário de usuários mostra as seções e seus níveis; não edita um papel compartilhado.

| Área atual | Seções atuais | Acesso no servidor nesta revisão |
| --- | --- | --- |
| Visão geral | `overview` | `indicators` |
| Mensagens | `messages` | `messages`, `replies` |
| Grupos | `groups` | `appointment-groups`; alguns recursos compartilhados de leitura |
| Pendências | `issues` | `issues`, recursos compartilhados com agendamentos |
| Configurações | `settings`, `operationsAdmin`, `users` | `rules`, `templates`, `imports`, `audit`, `logs`, `control`, integrações, cadastros e usuários, conforme recurso |
| Relatórios e Canvas | `reports`, em alguns recursos também `operationsAdmin` | `reports`, `report-*`; controles adicionais em views |
| WhatsApp de relatórios | `reports` e perfil `admin` | `report-whatsapp` usa `SectionPermission` e `get_unit(..., ["admin"])` |

Os níveis são `none`, `read` e `write`. `RESOURCES` pode aceitar qualquer uma das seções listadas para um recurso, e `required_sections` adiciona exceções de leitura. Os endpoints de callback `report-whatsapp/inbound/` e `report-whatsapp/authorize/` usam autenticação própria e não devem ser confundidos com a operação interativa do canal. O acesso federado intersecta políticas locais, remotas e o limite da chave. O menu usa `canAccess`; a aba WhatsApp também depende do perfil administrativo em `ReportWorkspace`.

## Migração e verificações pendentes

A migração deve preservar os níveis efetivos individuais, inclusive vínculos remotos e limites de instância: agrupar quatro seções diferentes sem guardar o estado anterior pode ampliar ou retirar acesso. Para WhatsApp, o acesso anterior depende tanto do nível de `reports` quanto do perfil `admin`; novos acessos a relatórios não devem receber essa subpermissão automaticamente. O retorno da migração precisa restaurar os valores anteriores sem apagar edições posteriores inadvertidamente. A solução precisa tratar também URLs diretas, mudanças de unidade, controles específicos das views, callbacks e federação.

Ainda faltam implementação, migração reversível, testes positivos e negativos de frontend e backend, tabela permissão → aba → endpoint → teste, suítes completas, prints dos dois temas e staging isolado na porta 8096 com banco descartável.

## Implementação parcial: WhatsApp dos relatórios

A seção `reportWhatsApp` é independente de `reports`: sem valor explícito, seu padrão é `none`. O superusuário possui edição. Em vínculos locais, remotos e limites das conexões existentes, a migração `core.0008_report_whatsapp_permission` grava o nível efetivo anterior de `reports` apenas para o perfil administrador; nos demais perfis grava `none`. Valores explícitos já presentes são preservados. A interseção federada continua exigida. O estado precisa de `read`; conectar e desconectar precisam de `write`. A configuração também exige edição em `reportWhatsApp`, sem exigência adicional de perfil. A sessão já publica as permissões efetivas por unidade.

| Permissão | Aba | Endpoint | Teste |
| --- | --- | --- | --- |
| `reportWhatsApp` | WhatsApp dos relatórios | `GET /api/v1/report-whatsapp/` | `test_whatsapp_status_is_independent_of_reports` |
| `reportWhatsApp` | WhatsApp dos relatórios | `POST /api/v1/report-whatsapp/` | `test_whatsapp_connection_requires_write` |

A migração guarda os valores inseridos em `PermissionMigration35Backup`. Ao reverter para `core 0007`, remove apenas valores ainda iguais aos gravados pela migração; valores editados depois são mantidos. Essa operação deve ser ensaiada exclusivamente em banco descartável; a versão anterior não aplica a nova seção, mesmo quando uma edição posterior fica preservada no JSON. `test_migration_preserves_existing_access_and_later_edits` exercita a ida e a volta. As demais partes da tarefa 35a continuam pendentes.

Em um ambiente descartável com as variáveis de conexão apontando para esse banco, o comando de reversão é `python manage.py migrate core 0007_unit_logo`; para reaplicar, `python manage.py migrate core 0008_report_whatsapp_permission`. Não execute esses comandos no banco real ou de produção.

## Continuação 35a2: cadastro de tipos (parcial)

A API `/api/v1/permission-roles/` lista modelos da unidade e permite criar ou editar somente com perfil administrador e permissão de edição de usuários. Cada modelo tem exatamente `messages`, `settings`, `reports` e `reportWhatsApp`, com níveis `none`, `read` ou `write`. O WhatsApp é independente. A chave opcional `permission_role` em um acesso da API de usuários copia os níveis para o JSON do vínculo local: `messages` preenche `overview`, `messages`, `groups` e `issues`; os outros três preenchem as seções homônimas. As seções restantes recebem `none`. Aplicam-se as restrições de perfil existentes. Alterar um modelo não altera acessos já concedidos; é necessário reaplicá-lo. A aplicação em vínculos remotos ainda não está disponível.

| Permissão | Aba | Endpoint | Teste |
| --- | --- | --- | --- |
| Usuários | Tipos de acesso | `GET/POST/PATCH /api/v1/permission-roles/` | `test_permission_roles_admin_and_scope` |

A migração `core.0009_permission_roles` cria apenas a tabela de modelos e sua reversão a remove; não modifica vínculos existentes. Ela não substitui a migração pendente dos níveis antigos para os quatro tipos. Os endpoints antigos ainda não foram todos consolidados e não há certificação de que o novo tipo Mensagens controle todos os recursos compartilhados. Não executar migrações no banco real.

Verificação da continuação: em PostgreSQL descartável, a suíte completa terminou com 1029 testes aprovados e as 5 falhas conhecidas de `test_report_removal.py` (resposta 503 pela flag de remoção). O teste adicional de reversão de `0009`, acrescentado depois do início dessa execução, passou na execução específica de `test_task35a2_roles.py` (3 testes). `test_task35a_whatsapp_permissions.py` passou com 10 testes. Foram usadas chaves fictícias e nenhum banco real.

## Continuação 35a3 (parcial)

As rotas principais `indicators`, `messages`, `replies`, `appointment-groups` e `issues` exigem `messages`. `reports`, `report-access`, `report-schedules` e as ações Canvas do catálogo exigem `reports` na verificação comum; a consulta ao Canvas não exige mais perfil administrador. Os testes específicos são `test_task35a3_messages.py` e `test_task35a3_reports.py`. Persistem verificações adicionais de perfil e recursos compartilhados a revisar; esta etapa não certifica todos os endpoints.

A migração `core.0010_preserve_task35_access` preserva os acessos associados às alterações acima em vínculos locais, vínculos remotos e limites das conexões. Em cada política, `messages` passa ao maior nível efetivo anterior entre `overview`, `messages`, `groups`, `issues` e `appointments`; `reports` passa ao maior nível anterior entre `reports` e `operationsAdmin`. A inclusão de `appointments` preserva o antigo acesso às pendências. A consolidação pode ampliar o acesso dentro de cada grupo; `reportWhatsApp` não é alterado. A reversão restaura cada chave somente se ainda tiver o valor gravado pela migração, preservando alterações posteriores. Em banco **descartável**, reverta com `python manage.py migrate core 0009_permission_roles`; reaplique com `python manage.py migrate core 0010_preserve_task35_access`. O teste de ida e volta é `test_task35a3_migration.py`. A migração não foi aplicada em produção.

A sessão `GET /api/v1/auth/session/` acrescenta `permission_types`, sem remover `permissions`. O mapa é indexado pelo slug retornado em `units`, inclusive `remote:<id>`; seus valores resultam das restrições aplicadas ao vínculo e, para unidades remotas, da interseção federada:

```json
{"permission_types":{"ame":{"messages":"read","settings":"none","reports":"write","reportWhatsApp":"none"}}}
```

As quatro chaves são estáveis e seus níveis são `none`, `read` e `write`. `reportWhatsApp` é independente de `reports`. Uma unidade ausente não está disponível na sessão. A política exposta não elimina as restrições adicionais de perfil ainda existentes nas views, que continuam pendentes de revisão nesta tarefa; não usar este resultado como certificação de que todas as operações já estão disponíveis. Teste: `test_session_exposes_four_types_by_unit_and_superuser`.

| Permissão | Aba | Endpoint principal | Teste |
| --- | --- | --- | --- |
| `messages` | Visão geral | `GET /api/v1/indicators/` | `test_message_tabs_require_messages_permission` |
| `messages` | Mensagens | `GET /api/v1/messages/`, `/api/v1/replies/` | `test_message_tabs_require_messages_permission` |
| `messages` | Grupos | `GET /api/v1/appointment-groups/` | `test_message_tabs_require_messages_permission` |
| `messages` | Pendências | `GET /api/v1/issues/` | `test_message_tabs_require_messages_permission` |
| `reports` | Relatórios | `GET /api/v1/reports/`, `/api/v1/report-access/`, `/api/v1/report-schedules/` | `test_report_resources_require_reports_permission` |
| `reports` | Canvas | `GET /api/v1/reports/{id}/canvas/` | `test_canvas_read_uses_reports_permission_for_operator` |
| `reportWhatsApp` | WhatsApp dos relatórios | `GET/POST /api/v1/report-whatsapp/` | `test_whatsapp_status_is_independent_of_reports`, `test_whatsapp_connection_requires_write` |

Esta tabela cobre apenas os casos exercitados; faltam testes de escrita e dos demais endpoints, inclusive Configurações e recursos compartilhados.

## Continuação 35a4: Configurações (parcial)

A verificação comum de `members`, `units`, `users` e `permission-roles` usa `settings`, assim como `rules`, `imports`, `audit`, `logs`, `control`, `meta-configuration`, `oracle-agendas`, `oracle-configuration`, `instance-keys` e `remote-instances`. A administração de usuários e tipos também usa `settings` no escopo interno. As exigências de perfil ainda existentes nas views e os recursos compartilhados continuam pendentes; esta etapa não certifica todas as operações.

A migração `core.0011_preserve_settings_access` grava em `settings` o maior nível efetivo anterior entre `settings`, `users` e `operationsAdmin`, em vínculos locais, remotos e limites de conexão. Isso pode ampliar acesso dentro de Configurações para evitar redução. A reversão restaura o valor anterior apenas se ainda for igual ao migrado, preservando edições posteriores. Em banco descartável, reverta para `core 0010_preserve_task35_access` e reaplique `core 0011_preserve_settings_access`.

| Permissão | Aba | Endpoint | Teste |
| --- | --- | --- | --- |
| `settings` | Configurações | `GET /api/v1/{rules,imports,audit,logs,control,meta-configuration,oracle-agendas,oracle-configuration,instance-keys,remote-instances,members,units,users,permission-roles}/` | `test_settings_resources_require_settings` |
| `settings` | Tipos de acesso | `POST /api/v1/permission-roles/` | `test_settings_write_requires_write`, `test_settings_controls_user_options_and_permission_role_write` |
| `settings` | Usuários | `GET /api/v1/users/options/` | `test_settings_controls_user_options_and_permission_role_write` |

A ida e volta da migração e a preservação de edição posterior são exercitadas por `test_settings_migration_preserves_and_reverses`.

A continuação incluiu `settings` para `preparations`, `layouts`, `policies`, `sources`, `flow-rules` e `flow-runs`. As permissões legadas já aceitas continuam válidas para preservar outros fluxos; `templates` já aceitava `settings`. A migração 0011 já inclui o antigo `operationsAdmin` na consolidação.

| Permissão | Aba | Endpoint | Teste |
| --- | --- | --- | --- |
| `settings` | Configurações | `GET /api/v1/{preparations,layouts,policies,sources,flow-rules,flow-runs,templates}/` | `test_configuration_resources_allow_settings_without_legacy_permissions` |
| `settings` | Configurações | `POST /api/v1/{preparations,layouts,policies,sources,flow-rules,templates}/` | `test_configuration_writes_require_settings_write` |

### Recursos compartilhados: atendimento

`cases`, `contacts` e `movements` atendem Pendências e também fluxos legados de Agendamentos ou Importa CROSS: aceitam `messages` ou as permissões anteriores. A leitura de `appointments` e `agenda-items` filtrada por grupo ou pendência atende Grupos/Pendências e aceita `messages`; a consulta geral continua vinculada a Agendamentos. Contatos continuam filtrados aos eventos de agendamento quando não há permissão de Agendamentos ou CROSS. A migração 0010 já consolidou os níveis antigos de grupos, pendências e agendamentos em `messages`. As restrições adicionais de perfil continuam pendentes de revisão.

| Permissão | Aba | Endpoint | Teste |
| --- | --- | --- | --- |
| `messages` | Grupos / Pendências | `GET /api/v1/{appointments,agenda-items}/` com filtro de grupo ou pendência | `test_shared_reads_allow_messages_permission` |
| `messages` | Pendências | `GET /api/v1/{cases,contacts,movements}/` | `test_shared_reads_allow_messages_permission` |
| `messages` | Pendências | `POST /api/v1/cases/{id}/act/`, `contacts/{id}/review/`, `movements/` | `test_shared_writes_require_messages_write` (validação ou objeto ausente após autorização) |

### Relatórios: consultas adicionais

A listagem de conexões, concessões, automações e coletas, o inventário e as opções de coleta não exigem mais perfil administrativo além da permissão `reports`. Destinatários, execuções e solicitações ainda podem ter filtros adicionais de escopo próprios; operações de edição e outras verificações de perfil permanecem pendentes.

| Permissão | Aba | Endpoint | Teste |
| --- | --- | --- | --- |
| `reports` | Relatórios | `GET /api/v1/{report-connections,report-app-connections,report-recipients,report-grants,report-automations,report-executions,report-snapshots,report-snapshot-runs,report-requests}/` | `test_report_reads_use_reports_permission` |
| `reports` | Relatórios | `GET /api/v1/reports/inventory/`, `report-snapshots/options/` | `test_report_reads_use_reports_permission` |

| Permissão | Aba | Endpoint | Teste |
| --- | --- | --- | --- |
| `reportWhatsApp` | WhatsApp dos relatórios | `POST /api/v1/report-whatsapp/` com ação `configure` | `test_whatsapp_configuration_uses_independent_write_permission` |

| Permissão | Aba | Endpoint | Teste |
| --- | --- | --- | --- |
| `reportWhatsApp` | WhatsApp dos relatórios | `POST /api/v1/report-whatsapp/` com ação `configure` | `test_whatsapp_configuration_uses_independent_write_permission` |
