# Integração da tarefa 36 na release

Base `f14a1e9`, branch `feature/canvas-release-merge`, merge local da `feature/canvas-fila36-release` em `489e0b8`: commit de integração `ba3ae985510d80fd8e01bf1ec1d42bc8b511b6f3`. Não houve conflitos textuais. A revisão do diff preservou os ajustes do Danilo, o compose da release, rotas e permissões existentes; a 36 acrescenta suas rotas, agendamento opcional e componentes. O login personalizado, o arquivo de auditoria estática e `teste.bin` não foram commitados.

## Migrações

Consulta somente de leitura a `django_migrations` em produção encontrou `core.0012` aplicada; `autoagenda.0001` e `0002` também constavam. O código do contêiner de produção lista só até `core.0007`, portanto a tabela é a referência para o estado aplicado. Em PostgreSQL fictício, criamos um banco a partir das migrações da árvore integrada sem 0013/0014 e verificamos que a lista de migrações aplicadas era idêntica à tabela consultada (sem dados de produção). O `migrate --plan` da árvore integrada mostrou somente `core.0013_synceduseridentity` e `core.0014_instanceaccesskey_export_user_identities`, nesta ordem; ambas foram aplicadas com sucesso nesse banco. `makemigrations core --check --dry-run` passou. O `makemigrations --check --dry-run` geral detectou remoções pendentes em `operations`, já registradas na comparação da 36e com a release; nenhuma migração foi criada para isso. Logs e comparação em `/tmp/orbita-36i/` no servidor.

## Staging

Foram atualizadas as instalações fictícias existentes 36d em `127.0.0.1:8110` (mãe) e `127.0.0.1:8111` (unidade), com imagens `orbita-36i-api` e `orbita-36i-panel`, preservando bancos e dados de revisão. Os contêineres substituídos foram preservados parados com sufixo `-36i-backup`. Ambos os painéis responderam HTTP 200. O Chromium autenticou e exibiu a tela de usuários com pendência, conflito e remoção; o banco registra `pendente36b` pendente, `teste36` em conflito, `liberado36` liberado e `desativado36` removido na origem. O estado prévio de `pendente36a` era liberado e foi preservado. Log e captura: `/tmp/orbita-36i/browser.log` e `/tmp/orbita-36d/usuarios-36f.png`.

Acesso: `ssh -L 8110:127.0.0.1:8110 -L 8111:127.0.0.1:8111 scv59`, depois abrir `http://127.0.0.1:8110`. Login da mãe: `teste36`; senha no workspace do solicitante em `/workspace/orbita-canvas/teste36.txt`. Não houve alteração no ambiente de produção.

## Testes

Frontend integrado em Node 24: 77 arquivos, 673 testes aprovados; build da imagem passou. Comparação com `f14a1e9`: 76 arquivos e 671 testes aprovados, conforme `local-changes-2/frontend-tests.log`. Logs desta execução em `/tmp/orbita-36i/frontend.log` e `build-panel.log`. Build da API também passou.

Backend integrado: `pytest -q` com PostgreSQL isolado, modo simulado, chaves fictícias e arquivos de relatório montados somente para leitura: **1299 aprovados, 5 ignorados**, sem falhas, em 464 s. Resultado de `f14a1e9` no mesmo ambiente documentado em `local-changes-2/backend-tests.log`: **1297 aprovados, 5 ignorados**, sem falhas. Log integrado: `/tmp/orbita-36i/backend.log`. Os avisos incluem impossibilidade de escrever o cache pytest no código montado somente para leitura.
