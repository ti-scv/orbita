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

## Revisão 35c — frontend

O formulário apresenta os quatro níveis do tipo escolhido e permite passar para permissões individuais com “Personalizar”. A lista e a edição reconhecem um tipo quando todos os níveis armazenados coincidem com exatamente um tipo da unidade. O servidor grava uma cópia das permissões, não o identificador do tipo: não é possível distinguir tipos com níveis iguais, identificar um tipo que foi alterado ou removido depois da concessão, nem distinguir permissões individuais iguais a um tipo. Nesses casos a identificação é apenas uma inferência, não uma associação persistida; correspondências ambíguas continuam como permissões individuais. A seleção de um tipo respeita as validações do perfil e dos limites da unidade feitas pelo servidor. Nenhuma alteração de backend foi feita.

A tela de acesso negado tem título, orientação e botão de retorno. Endereços desconhecidos têm mensagem própria. O texto “Sem acesso” é usado na matriz e nos tipos, e os níveis do WhatsApp explicam as ações permitidas. Mensagens, Relatórios e Configurações receberam traço suave adicional; WhatsApp e usuário conservam suas cores. Foram ajustados o espaçamento dos campos e o contraste da paginação desabilitada no tema escuro.

Verificação em 29/10/2026: build de produção com Node 24 passou; Vitest dos arquivos `task35c.test.ts`, `icons.test.tsx` e `permissions.test.ts` passou (31 testes). O Node 18 do host não é compatível com as dependências atuais, por isso a verificação válida usou contêiner Node 24. No staging descartável 8100, login de teste, lista com tipo reconhecido, edição do usuário `qa20rel`, visualização do tipo e personalização foram conferidos no navegador; a rota inexistente também foi conferida. A tela de acesso negado foi verificada com a resposta de sessão interceptada no navegador para simular restrição, sem alterar o banco. As imagens estão em `docs/canvas-task35-evidencias/35c-*`. A imagem anterior do contêiner de painel foi preservada como `orbita-canvas-stage-fila35b-anterior35c`.

Os arquivos solicitados `qa20-result.md` e `shots/qa20-*` não foram encontrados nos locais pesquisados no servidor. A revisão foi guiada pelos problemas descritos na tarefa e pela inspeção do staging; não foi possível conferir essas evidências específicas.

Verificação adicional no banco descartável: o usuário `qa35cteste` foi criado com o tipo “QA Só Relatórios”; após salvar, a lista mostrou o tipo e a edição reabriu com o mesmo tipo e seus níveis. Evidência: `35c-salvo-reaberto.png`.
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

### Estado e validação da retomada 35a4

Resultado parcial: ainda há verificações de perfil nas views e serviços, inclusive criação/configuração de recursos, filtros de destinatários e relatórios, chaves e acesso federado. `role_permissions` ainda limita níveis por perfil e a aplicação de tipos a vínculos remotos continua indisponível. A tabela acima documenta apenas endpoints efetivamente testados; não certifica a cobertura integral dos recursos compartilhados nem das operações de escrita. É necessário concluir essas revisões e ampliar a tabela antes de declarar a tarefa concluída.

Em PostgreSQL descartável, com arquivos de teste montados somente para leitura e chaves fictícias, a suíte completa teve **1163 aprovados e 5 falhas** em `test_report_removal.py`, todas respostas 503 da flag de remoção já conhecidas. Após essa execução, o teste de limite de delegação foi refinado e passou isoladamente. Não foram usados staging nem banco real.

`makemigrations --check --dry-run` ainda propõe remover os campos `removed_at`, `removed_by` e `removed_was_enabled` de `ReportApplicationConnection`, `ReportConnection` e `ReportDefinition` em `operations`. Essa diferença já existia; não foi gerada nem aplicada migração para ela.

## Continuação 35a5: tipo escolhido no vínculo

`core.0012_membership_permission_role` adiciona ao vínculo local uma referência anulável ao tipo da mesma unidade, sem inferir tipos para vínculos antigos. A exclusão do tipo limpa a referência e preserva as permissões. Tipos não se aplicam a vínculos remotos; estes continuam individuais. A migração é aditiva e reversível: em banco **descartável**, reverta com `python manage.py migrate core 0011_preserve_settings_access` e reaplique com `python manage.py migrate core 0012_membership_permission_role`. A reversão perde as referências escolhidas, mas preserva os níveis e os tipos. Não executar no banco real.

### Contrato para o frontend

Cada item de `grants` na listagem `GET /api/v1/users/` e na resposta de criação/configuração contém, além de `unit`, `role` e `permissions`:

```json
{"unit":"ame","role":"viewer","permissions":{"messages":"read"},"permission_role":{"id":12,"name":"Atendimento"},"permission_role_outdated":false}
```

`permissions` no exemplo foi abreviado: a resposta contém todas as seções efetivas. `permission_role` é um objeto com `id` e nome atual, ou `null` para permissões individuais; `permission_role_outdated` é booleano e é `false` quando não há tipo. Ele indica diferença entre os níveis efetivos do vínculo e os níveis atuais do tipo, depois das restrições do perfil, incluindo as demais seções. Renomear um tipo atualiza o nome exibido; alterar seus níveis nunca modifica os acessos concedidos. Para vínculo remoto, inclusive acesso implícito, esses campos são sempre `null` e `false`.

Nos pedidos `POST /api/v1/users/` e `POST /api/v1/users/{id}/configure/`, `permission_role` é um **inteiro**, não o objeto da resposta:

- Enviar um ID válido da unidade local aplica os níveis atuais do tipo e substitui `permissions` enviado para esse acesso. Restrições de perfil e de delegação continuam válidas. Reenviar o ID reaplica o tipo, inclusive quando desatualizado.
- Enviar `null` limpa a referência e usa as `permissions` enviadas; assim o frontend seleciona “Permissões individuais”.
- Omitir o campo usa as `permissions` enviadas. Em um vínculo existente, preserva a referência somente se perfil e níveis efetivos permanecerem iguais aos já armazenados; alterações manuais tornam o vínculo individual (`null`). Para um vínculo novo, a omissão também resulta em individual. Para preservar um tipo desatualizado ao salvar outros dados, omita o campo e envie o perfil e os níveis recebidos, sem alterações.
- Um ID de outra unidade ou um ID em vínculo remoto é rejeitado. O acesso aos endpoints continua sujeito às permissões de Configurações e às regras de escopo existentes.

Edições por outros caminhos que alterem diretamente o JSON do vínculo sem limpar a referência aparecem como desatualizadas; a API de usuários limpa a referência quando recebe edição manual com o campo omitido. O frontend deve omitir o campo ou enviar `null` ao editar níveis individuais, pois um ID explícito sempre reaplica o tipo. A comparação não altera os níveis armazenados.

Os testes `test_task35a5_roles.py` cobrem seleção, alteração posterior do tipo, preservação, personalização, limpeza, escopo, autorização, vínculo remoto e ida e volta da migração em banco de testes.

## Revisão 35d — tipo guardado e QA21

O merge da 35a5 foi integrado sem inferir tipos para vínculos antigos. A lista usa o nome retornado em `permission_role`; a edição usa seu ID. Tipos com níveis iguais permanecem distintos. Um vínculo antigo ou remoto sem referência continua individual, mesmo que os níveis coincidam com algum tipo. Salvar outros dados de um vínculo desatualizado preserva os níveis recebidos; “Reaplicar tipo” envia o ID para copiar os níveis atuais. “Personalizar” informa que o vínculo deixará de seguir o tipo e conserva os níveis do acesso; ao selecionar um tipo sobre permissões individuais há confirmação. Cancelar descarta a edição do usuário.

O limite de espera inicial cobre CSRF e sessão em paralelo. Após oito segundos de espera a tela oferece “Tentar novamente”, sem tratar indisponibilidade como sessão encerrada. Na investigação, as consultas sem sessão no staging responderam em 7 ms e 4 ms antes da reconstrução; o atraso de QA21 não se repetiu. Em Vite ligado à API integrada, o primeiro acesso sem sessão levou 4,3 s com cache frio e 0,8 s em repetição; com autenticação intencionalmente bloqueada, a opção de tentar novamente apareceu em 8,9 s desde a navegação. Isso não identifica a causa da ocorrência original, que tinha sessão aberta.

A linha de pulso de Relatórios recebeu preenchimento suave; foram reforçados o contraste no tema escuro e o espaço entre perfil e tipo. O campo Usuário do login continua preenchido com “admin”: a correção exigiria alterar `frontend/src/components/Login.tsx`, arquivo vedado nesta tarefa, e ficou registrada para tratamento posterior.

Verificações em 29/10/2026: Vitest completo passou com 647 testes; após o ajuste de cancelamento, os testes relacionados foram repetidos. O build Node 24 passou, com aviso de bundle acima de 500 kB. Em PostgreSQL descartável, 70 testes de tipos, configurações e sessão passaram. No staging isolado 8100, a API executa o backend da branch unida e as migrações 0010–0012 foram aplicadas apenas ao banco descartável. No navegador, o usuário de teste foi salvo e reaberto com “QA Igual Relatórios” na presença de outro tipo com níveis iguais; um tipo alterado mostrou o aviso, personalização e cancelamento foram conferidos, e a reaplicação foi salva e conferida no banco. Evidências: `35d-tipo-duplicado.png`, `35d-desatualizado.png`, `35d-personalizar.png` e `35d-escuro.png` em `docs/canvas-task35-evidencias`. O contêiner anterior da API foi preservado como `orbita-api-fila35b-anterior35d`.

## Revisão 35e — resultado parcial

A lista e as opções de usuários passam a carregar a primeira página em paralelo; havia uma dependência sequencial entre essas duas requisições. Não foi medida a duração total no navegador após a alteração e não há evidência de que a meta de menos de três segundos foi atingida. O tempo anterior informado no QA23 foi de aproximadamente 6,6 s até a lista. A listagem do backend ainda faz consultas por usuário e merece investigação de N+1.

O formulário limita os acessos remotos já existentes aos níveis atuais da conexão, identifica a unidade afetada e envia os níveis limitados. Erros de delegação agora identificam unidade e seção. No banco descartável, o usuário de QA `teste35b` tem perfil administrativo na AME, mas não possui `reportWhatsApp`; por isso ele não pode delegar leitura de WhatsApp localmente. A mensagem antiga chamava esse erro local de remoto. A correção mantém o teto de delegação local; o caso exato com esse usuário continua sem salvar enquanto faltar a permissão local. Os testes cobrem outro administrador com WhatsApp local e uma conexão remota mais restrita, incluindo mensagem com unidade e seção.

Os tipos exibem Visão geral, Mensagens, Grupos e Pendências individualmente e tipos anteriores usam o nível de Mensagens como padrão para os novos campos. **Limitação:** a API ainda autoriza vários recursos dessas áreas pela permissão geral `messages`, não pelos níveis individuais apresentados; não se deve considerar as novas opções uma separação de segurança concluída até revisar e testar os endpoints e recursos compartilhados. A mudança precisa de validação funcional de ponta a ponta antes de uso.

Após login, rota conhecida não permitida é redirecionada para a primeira tela permitida. O ícone de Relatórios recebeu fundo suave; tamanho e contraste do rodapé foram ajustados. A barra lateral usa o perfil real da unidade, como a lista, e trocar o perfil de um vínculo com tipo pede confirmação.

Verificações: Vitest em Node 24, 648 testes aprovados; testes `test_instance_users.py` e `test_task35a5_roles.py`, 12 aprovados em banco de teste descartável. Build do frontend concluído; staging 8100 reconstruído com API da árvore 35b reiniciada. As rotas `/`, `/configuracoes`, `/relatorios`, `/mensagens` e `/grupos` retornaram HTTP 200. Essas verificações HTTP não substituem QA autenticado ou medição de tempo no navegador. Não houve migração, push nem uso de 8091.

## Revisão 35f — resultado parcial

A autorização dos recursos exclusivos `indicators`, `messages`, `replies`, `appointment-groups` e `issues` agora usa, respectivamente, Visão geral, Mensagens, Mensagens, Grupos e Pendências. Consultas de agendamentos filtradas por grupo ou pendências também reconhecem essas subáreas. Testes cobrem permissões individuais e aplicadas por tipo; os recursos compartilhados ainda precisam de revisão completa de segurança e fluxo de ponta a ponta antes de considerar a separação concluída.

O backend limita concessões remotas ao teto da conexão e do perfil, devolvendo unidade e seções limitadas; o formulário identifica os limites conhecidos e mostra avisos devolvidos pelo backend. A concessão local continua sujeita à permissão do administrador. O cenário exato solicitado não foi reproduzido: neste banco descartável não havia conexões remotas cadastradas, `qa23u` não tinha vínculo remoto e `teste35b` não tem WhatsApp local para delegar. Ainda é necessário montar o cenário completo com a unidade AME remota e validar o salvamento e o aviso no navegador.

Medição headless autenticada, Chromium com cache desativado, desde a navegação a `/configuracoes` incluindo abrir Usuários e acessos até a primeira linha visível: antes da reconstrução, 1,201 / 1,178 / 1,050 s; depois, 1,051 / 1,263 / 1,208 s. A meta de 3 s foi atendida nas seis medições; não houve alteração de desempenho nesta revisão. A estimativa anterior de 6,6 s da QA23 não tem metodologia comparável registrada.

Vitest: 648 aprovados. Testes backend direcionados após atualização de expectativas: 56 aprovados. A suíte ampla anterior à atualização dos testes terminou com 1.162 aprovados, 16 falhas e 7 erros: entre as falhas estavam expectativas antigas sobre permissão geral e rejeição de limites remotos, além de falhas de remoção de relatórios; os erros de SQL operacional ocorreram na preparação da fonte. A repetição isolada de remoção retornou HTTP 503. A suíte ampla não foi repetida após atualizar as expectativas e não pode ser considerada aprovada.

Frontend do staging 8100 reconstruído e API descartável reiniciada; `/`, `/configuracoes`, `/relatorios`, `/mensagens` e `/grupos` responderam 200. Nenhuma migração ou push foi realizada.
