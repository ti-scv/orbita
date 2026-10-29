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
