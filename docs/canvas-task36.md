# Tarefa 36 — investigação da release 7354299

## Cadastro e comunicação

`RemoteInstance` (`backend/core/models.py`) associa uma unidade local à identidade da instalação e ao slug remoto. A restrição de unicidade usa os três valores. `RemoteInstanceViewSet.configure_connection` (`backend/core/federation.py`) exige administrador da unidade, valida o manifesto antes de salvar e audita `instance.connected`. O cadastro hoje depende da disponibilidade do manifesto; não existe uma segunda chamada para sincronizar usuários.

A origem emite `InstanceAccessKey`: o segredo é exibido uma vez, seu hash fica na origem e o segredo cifrado fica na conexão. `InstanceKeyAuthentication` valida chave, validade, emissor e unidade, limita o papel e autoriza somente o manifesto e recursos explicitamente permitidos. O manifesto não contém usuários. O transporte `federation_network.py` valida endereços, fixa a resolução, limita tempo e tamanho e não segue redirecionamentos. O proxy (`RemoteProxyView`) é autenticado por sessão, verifica o acesso local e retransmite apenas recursos permitidos; ele não cria usuários.

## Contas e acesso

A autenticação disponível é local: `LoginView` chama `authenticate` com login e senha; `session` retorna unidades e políticas. Não foi encontrado login federado nem endpoint de sincronização de usuários nesta base. A criação administrativa em `core/users.py` exige senha local e rejeita login já existente. O comando `bootstrap` também cria conta local. Nenhum desses fluxos deve ser confundido com importação de identidade externa.

`Membership` e `RemoteMembership` concedem acesso. Para preservar comportamento anterior, `remote_access` pode derivar acesso remoto da associação local quando não há `UserAccessProfile.explicit_units`. `UserAccessProfile.managing_unit` permite incluir na listagem administrativa contas sem vínculos. O fluxo administrativo aplica os tipos da tarefa 35 e registra `user.access_configured`. O controle por seção ocorre no backend (`SectionPermission` e checagens do proxy); a sessão e o login são exceções necessárias para exibir o estado de uma conta sem unidades.

## Pontos a resolver na implementação

- Criar identidade de origem persistente por instalação, unidade e id remoto e marcador explícito de pendência. Novas contas devem ter senha inutilizável, perfil de unidades explícitas e nenhum vínculo. A atualização não pode criar ou restaurar vínculos nem mudar acesso já liberado.
- Login igual não prova que duas identidades sejam da mesma pessoa. Vincular automaticamente por nome de usuário pode entregar uma conta existente a outra pessoa; conflitos precisam de tratamento explícito, sem alterar contas antigas. A deduplicação entre origens requer identidade confiável ou resolução administrativa.
- A chave atual não autoriza administração de usuários. Uma exportação de identificação precisa de escopo específico, sem senhas ou permissões, validação de integridade e paginação completa antes de marcar desaparecidos. Desativação/remoção na origem não deve excluir a conta mãe nem presumir remoção após falha parcial.
- O cadastro deve permanecer salvo se a sincronização posterior falhar, com erro auditado e nova tentativa disponível. Não enfraquecer a validação de identidade do manifesto nem a proteção do transporte para obter isso.
- A liberação deve exigir administrador, escolher acessos e tipos locais e ser auditada; a sessão precisa sinalizar pendência sem conceder unidades. São necessários testes de isolamento, colisões, repetição, remoção e duas instâncias, além de migração aditiva reversível.

## Estado

Investigação realizada; sincronização, migração, backend, interface e testes da tarefa ainda não foram implementados. Nenhum banco ou ambiente de execução foi alterado. A porta específica para staging desta etapa é 8110; a porta 8091 está expressamente proibida por `task-36a.md`.

## Validação 36d — 29/10/2026

Esta seção atualiza o estado anterior: o backend e a interface já estão implementados na branch. A validação foi feita em `8a22253`, em staging descartável e com dados fictícios. Nenhum recurso de produção foi usado.

Duas instalações Django/Gunicorn independentes usam PostgreSQL e redes Docker separados (`orbita-36d-mae`, `orbita-36d-unidade`); a API da unidade também se conecta à rede da mãe para a comunicação federada. Os painéis estão em `127.0.0.1:8110` e `127.0.0.1:8111` no scv59, em modo simulado. A mãe está disponível para revisão com usuário `teste36`; a senha está em `/workspace/orbita-canvas/teste36.txt` no workspace do solicitante. Estado observado por HTTP autenticado: `pendente36a` e `pendente36b` pendentes, `teste36` em conflito, `liberado36` liberado, e `desativado36` liberado anteriormente e marcado como removido na origem. Para acessar localmente, `ssh -L 8110:127.0.0.1:8110 scv59` e abrir `http://127.0.0.1:8110`.

### Comandos e resultados

- Builds: `docker build -t orbita-36d-api ./backend` e `docker build -t orbita-36d-panel ./frontend`: sucesso. Os bancos são volumes novos `orbita-36d-mae-db` e `orbita-36d-unidade-db`; nenhum volume do compose padrão foi utilizado.
- Em cada banco recém-criado, executados `python manage.py migrate --noinput`, `python manage.py migrate core 0012 --noinput` e novamente `python manage.py migrate --noinput` em contêineres com env próprio: `0014` e `0013` revertidas e reaplicadas com sucesso. A reversão de 0013 apaga a tabela e os dados das identidades sincronizadas; a de 0014 apaga o campo de autorização de exportação das chaves. Reaplicar não recupera esses dados. Contas e concessões existentes em outras tabelas não são restauradas automaticamente.
- Ensaio com APIClient autenticado na mãe e chamadas HTTP reais da mãe para a unidade: `docker exec -i orbita-36d-unidade-api python manage.py shell < /tmp/orbita-36d/origin.py` e `docker exec -i orbita-36d-mae-api python manage.py shell < /tmp/orbita-36d/mother.py`; scripts e logs de execução em `/tmp/orbita-36d/`. Emissão de chave com exportação explícita, cadastro da conexão e sincronização automática retornaram 200 e cinco identidades. A identidade colidente não foi vinculada; contas novas ficaram inativas, sem senha utilizável ou associação; três rotas representativas responderam 403 mesmo com autenticação forçada. Liberação com concessão local retornou 200; nova sincronização retornou 200, sem duplicar nem revogar a concessão. Após trocar temporariamente a URL por hostname inexistente, sincronização retornou 502 com erro simples, preservando a conexão; a URL foi restaurada e a tentativa posterior passou. Auditorias `user_sync.completed`, `user_sync.released` e `user_sync.failed` verificadas.
- Após liberar `desativado36`, desativação na unidade e nova sincronização (`/tmp/orbita-36d/release_removed.py` e `removed.py`) marcaram a identidade como removida e desativaram a conta na mãe. A conta liberada `liberado36` permaneceu ativa.
- `pytest -q -p no:cacheprovider tests`, com PostgreSQL descartável em contêiner, `REDIS_URL` vazio e envio simulado, na branch: 1275 passaram, 5 ignorados, 2 falharam e 7 erros. A mesma suíte em `7354299`, em outro banco/rede: 1273 passaram, 5 ignorados, as mesmas 2 falhas e 7 erros. Falhas comuns: `test_cross_body_parameters_are_in_meta_request` e `test_all_sections_share_readonly_session_and_dates`. Os 7 erros de `test_operational_sql.py` eram falta de `ORACLE_CREDENTIALS_KEY` no ambiente de teste; repetidos na branch com chave Fernet fictícia e banco de teste independente: 7 passaram. Nenhuma falha nova identificada nesta comparação; `test_report_catalog` passou nas duas suítes PostgreSQL.
- `npm test` em contêiner Node: primeira execução concorrente às duas suítes backend teve 9 timeouts; repetição integral `npm test -- --maxWorkers=2` passou: 75 arquivos, 665 testes. Build do frontend passou.
- `git merge-tree --write-tree c6d6d45 8a22253` retornou árvore `492a5c3d339b5d61e12527ee12958dba72ac9080` sem conflitos; sem alterar branch ou fazer merge. A branch `feature/canvas-release-merge` avançou para `ff4fa24`; `git merge-tree --write-tree ff4fa24 8a22253` também foi limpo, árvore `2944d4cbf6ce925cd55cf97c6db22ea8f530ba2f`.

Limites: três rotas representativas foram verificadas diretamente para a conta pendente, além da inatividade e senha inutilizável; não foi feita uma enumeração exaustiva de todas as rotas.

### Complemento da validação 36d

- Com proxy HTTP descartável que responde ao manifesto e fecha a conexão na exportação, `docker exec -i orbita-36d-mae-api python manage.py shell < /tmp/orbita-36d/failure-create.py`: cadastro 200, `user_sync.ok=false` e `connection_failed`; a conexão persistiu e nova tentativa retornou 200. A unidade temporária criada para este ensaio foi removida.
- `/tmp/orbita-36d/type-test.py` liberou `tipo36` com `permission_role` de um tipo válido da tarefa 35: 200, associação com o tipo confirmada no banco; depois a origem foi desativada para preservar somente um liberado ativo na revisão. Uma primeira tentativa com tipo incompleto inserido diretamente no banco produziu 500; esse dado não representava um tipo válido criado pela API.
- Navegador Chromium/Playwright em `orbita-t31b-qa`, acesso por 8110, login e Configurações → Usuários e acessos: pendências, conflito, liberação e desativação exibidos. Evidência: [usuarios.png](evidencias-task36d/usuarios.png).

A suíte completa da branch foi repetida com `ORACLE_CREDENTIALS_KEY` fictícia e banco PostgreSQL de teste independente: 1282 passaram, 5 ignorados e 2 falharam em 312 segundos. As duas falhas são exatamente as observadas em `7354299` acima; não houve erros de setup nessa repetição. Logs: `docker logs orbita-36d-tests-configured`.

## Integração 36e — 29/10/2026

Código integrado: `322f7a2ff31648aef8824afdac4e2e36875e1ca6`, merge de `feature/canvas-fila36` em `428dd33`, na branch `feature/canvas-fila36-release`, worktree `/opt/orbita-fila36r`. O commit posterior a esse SHA registra esta documentação. O merge não alterou arquivos do Autoagendamento. As migrações da tarefa 36 são `core.0013_synceduseridentity` e `core.0014_instanceaccesskey_export_user_identities`, sequenciais após `core.0012`; as migrações próprias do Autoagendamento foram aplicadas nos dois bancos de revisão.

Para revisar, execute `ssh -L 8110:127.0.0.1:8110 -L 8111:127.0.0.1:8111 scv59` e acesse `http://127.0.0.1:8110`. O administrador da mãe é `teste36`, com senha em `/workspace/orbita-canvas/teste36.txt` no workspace do solicitante. Em Configurações → Usuários e acessos, a unidade fictícia cadastrada e sincronizada apresenta `pendente36a` e `pendente36b` pendentes, `teste36` em conflito e `liberado36` liberado. Duas identidades de ensaios anteriores aparecem marcadas como removidas na origem. A unidade está em 8111. São instalações descartáveis em modo simulado, com bancos PostgreSQL e redes separados, usando os contêineres `orbita-36d-*` reconstruídos com imagens `orbita-36e-api` e `orbita-36e-panel`; a API da unidade participa também da rede da mãe para federação. Health, login HTTP, listagem autenticada e nova sincronização foram verificados com sucesso.

Comparação de suítes completas, com PostgreSQL isolado e chave Oracle fictícia: merge, 1297 passaram, 5 ignorados e 2 falharam; release `428dd33`, 1295 passaram, 5 ignorados e as mesmas 2 falhas (`test_cross_body_parameters_are_in_meta_request` e `test_all_sections_share_readonly_session_and_dates`). Logs: `docker logs orbita-36e-tests-current` e `docker logs orbita-36e-tests-base`. Frontend `npm test -- --maxWorkers=2`: ambas as versões passaram, 76 arquivos e 670 testes. Logs em `/tmp/orbita-36e/frontend-current.log` e `/tmp/orbita-36e/frontend-base.log`; build da imagem do painel passou. `makemigrations --check --dry-run` aponta remoções pendentes de campos em `operations` tanto no merge quanto na release; nenhuma migração foi gerada para isso.

FIM-TAREFA-36E concluída 322f7a2ff31648aef8824afdac4e2e36875e1ca6


## Revisão 36f — 29/10/2026

Código de revisão: `ec4d565556974da688aa570f01d10ac5a7393235`. Identidades sincronizadas aparecem na tabela, com origem, situação, filtro e ações. A coluna de unidades agrupa descrições repetidas. A sincronização apresenta contagens e pode ser acionada também em Usuários e acessos. Conflitos indicam o usuário local e a origem; manter pendente e criar conta separada são decisões auditadas. A auditoria apresenta títulos e detalhes disponíveis em português, inclusive informações recuperáveis de registros antigos. A senha inicial tem validação própria e explicação de autenticação local.

Os ambientes descartáveis `orbita-36d-*` foram atualizados com `orbita-36f-api` e `orbita-36f-panel`, em 8110 e 8111, com os mesmos bancos isolados. `pendente36a`, anteriormente liberado na revisão, foi restaurado a pendente, sem senha utilizável nem concessões. Após sincronizar, estado confirmado: dois pendentes, `teste36` em conflito, `liberado36` liberado e `desativado36` e `tipo36` removidos. Login de revisão e encaminhamento SSH permanecem como descritos em 36e. Os contêineres anteriores foram preservados parados com sufixo `-36e-backup`.

Verificação: build do frontend passou; suíte frontend 76 arquivos e 670 testes passaram. Backend com PostgreSQL de teste e chave fictícia: 1297 passaram, 5 ignorados e 2 falharam, as mesmas falhas registradas em `428dd33` na seção 36e (`test_cross_body_parameters_are_in_meta_request` e `test_all_sections_share_readonly_session_and_dates`); portanto a suíte backend não está verde, apesar de não haver regressão identificada na comparação. Testes direcionados de sincronização e logs: 3 passaram. Logs em `/tmp/orbita-36f-backend.log`, `/tmp/orbita-36f-frontend.log` e `/tmp/orbita-36f-tests-target.log`.

Chromium em 8110 confirmou login sem recarga, estados e ações da tabela, diálogo de conflito, validação de senha em português e resultado da sincronização. Evidência em `/tmp/orbita-36d/usuarios-36f.png`; logs `/tmp/orbita-36f-browser.log` e `/tmp/orbita-36f-check.log`. A queixa de botão preso em “Entrando…” não foi reproduzida nesta execução; `Login.tsx`, `App.tsx` e `api.ts` não diferem de `428dd33`, assim como os arquivos de autenticação e permissões examinados. Isso não prova que o comportamento intermitente não ocorra por outra causa. `Login.tsx` não foi alterado.

FIM-TAREFA-36F parcial ec4d565556974da688aa570f01d10ac5a7393235
