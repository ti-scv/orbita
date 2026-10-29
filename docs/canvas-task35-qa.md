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

A seção `reportWhatsApp` é independente de `reports`: sem valor explícito, seu padrão é `none`. O superusuário possui edição. Em vínculos locais, remotos e limites das conexões existentes, a migração `core.0008_report_whatsapp_permission` grava o nível efetivo anterior de `reports` apenas para o perfil administrador; nos demais perfis grava `none`. Valores explícitos já presentes são preservados. A interseção federada continua exigida. O estado precisa de `read`; conectar e desconectar precisam de `write`. A ação de configuração continua exigindo também perfil administrador. A sessão já publica as permissões efetivas por unidade.

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
