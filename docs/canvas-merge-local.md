# Integração do trabalho local com a release 33+35

Base da release: `4a3de497c62a5471b59bb8ca1c8d03d210d07a97`. Retrato do diretório local: `/opt/orbita-deploy-release-33-35/local-changes/` (status, diff completo de 32c69c7, lista e arquivo dos não rastreados, resumo e diff isolada do login).

## Mudanças de Danilo

Foi acrescentado o autoagendamento Sansaúde: painel para a equipe, chat público separado, acompanhamento, indicadores, integração Oracle, proteção das sessões e opção de passar o atendimento a uma pessoa. A gravação de reservas é desligada por padrão; envios não são ativados nesta entrega. A API, o guia e a especificação OpenAPI foram ampliados. O módulo possui arquivos e testes de backend e frontend, recursos visuais e duas migrações. Os documentos e imagens históricas que não integram o módulo ficaram no retrato. Detalhes operacionais estão em `docs/AUTOAGENDAMENTO_SANSAUDE.md`.

O `Login.tsx` personalizado não foi commitado. A sua diff está em `local-changes/login.patch`; o arquivo em `/opt/orbita-deploy-release-33-35/source/frontend/src/components/Login.tsx` coincide com o local e com `login-sha256.txt` (SHA-256 `646b7e51bf8d20143a93502ad730b628641b26410feb558c3aef5d46c0e6a1d5`). Para montar um deploy ou staging, aplicar esse arquivo personalizado em uma cópia de build e verificar o hash, como no deploy existente.

## Conflitos e decisões

- `App.tsx`: preservados os ícones da release, o workspace novo e a checagem de acesso da release; o carregador não executa requisições do painel para o Canvas, relatórios ou autoagendamento.
- `permissions.ts`: preservada a regra restritiva da release, inclusive WhatsApp de relatórios; o autoagendamento é negado quando estiver ausente de um registro existente. Políticas explícitas continuam valendo. Superusuário recebe acesso administrativo ao módulo, corrigindo a interação entre o novo campo e a exceção da release para WhatsApp.
- `routes.ts`: mantido o destino inicial de visão geral da release e adicionada a rota de autoagendamento. O destino anterior de agendamentos no patch era contexto da base, não uma alteração local.
- Backend mantém os quatro grupos de permissões e restringe o módulo à unidade Sansaúde. Os testes e o staging usam somente dados fictícios.

## Compose: linhas novas e justificativa

O serviço `autoagenda-api` usa `profiles: [autoagenda]` para não iniciar sem ativação explícita; `build: ./backend` usa a mesma aplicação; `env_file: .env` fornece configuração; `environment` herda `*backend_environment` (PostgreSQL/Redis) e fixa `SEND_MODE: simulated`, `META_REAL_ENABLED: "0"`, `REPORT_BAILEYS_ALLOW_SENDS: "0"` para impedir envios reais nesse serviço. `command` executa Gunicorn na porta interna 8000 com dois workers, timeout de 90 s e logs de aviso; `depends_on` espera o banco saudável; `restart: unless-stopped` reinicia em falhas; `mem_limit: 768m` limita memória.

O serviço `autoagenda-web` também exige o perfil; `build.context: ./frontend` e `dockerfile: Dockerfile.autoagenda` montam a interface pública própria; `ports` usa `AUTOAGENDA_BIND` e `AUTOAGENDA_PORT`, com padrão `127.0.0.1:8081`, para não expor por acidente; `depends_on` espera a API ser iniciada; `restart: unless-stopped` e `mem_limit: 128m` controlam reinício e memória. Um proxy remoto exige configurar explicitamente o bind e as proteções de rede. Nenhum serviço foi implantado em produção por esta tarefa.

## Migrações e validação

`autoagenda.0001_initial` cria tabelas do módulo; `0002_booking_autoagenda_unique_active_slot` adiciona uma restrição de unicidade condicional. Ambas foram aplicadas, revertidas até zero e reaplicadas no banco vazio de staging. Também foram aplicadas as migrações existentes da release, incluindo `core.0012` e `scheduling.0012` e suas sucessoras exigidas pela aplicação. A reversão de tabelas em uma instalação com dados reais apagaria os dados do módulo; a prova foi feita exclusivamente no banco descartável.

Staging em `127.0.0.1:8115`: banco PostgreSQL novo sem dados reais, rede da API/banco interna, envio simulado, relatório e quatro grupos fictícios. Smoke HTTP verificou login, sessão, os quatro grupos de permissões, workspace, relatório, Canvas, configuração/console do autoagendamento e a negação do método público inválido. Smoke de navegador com o login personalizado confirmou login, menu, quatro grupos, relatórios e abertura do editor Canvas; a página de autoagendamento também foi aberta. Os logs e scripts estão em `local-changes/`.

A primeira execução de testes foi feita por engano com um link para `node_modules` de `/opt/orbita`, e Vite/Vitest gravou caches nesse diretório. O link foi removido e as execuções seguintes usam cópia independente. Nenhum arquivo rastreado ou login desse diretório foi alterado por esta tarefa.

Build frontend em Node 24 concluído; suíte com dois workers e timeout de 30 s: **669 testes aprovados**. A primeira execução com concorrência maior teve timeouts sob carga; com Node 18 também houve incompatibilidade de módulos. Backend em PostgreSQL isolado com chaves fictícias e arquivos de relatório somente leitura: **1.296 aprovados, 5 ignorados**. Testes específicos do autoagendamento em SQLite: 13 aprovados, 1 ignorado. Os logs completos estão em `local-changes/frontend-controlled.log` e `backend-postgres-corrected.log`.

`makemigrations autoagenda --check --dry-run` não detectou mudanças. A checagem geral, com `REPORT_REMOVAL_ENABLED` desligado, propõe remover campos condicionais de `operations`; a mesma diferença foi reproduzida na imagem original da release (`local-changes/baseline-migrations.log`). Não foi gerada migração a partir disso.

Commit de implementação: `02ed5350c1d8b1da030f627c87e54e0f801aaa76`. O SHA do commit atual pode ser consultado por `git rev-parse HEAD`; o valor registrado no final deste arquivo fica fora do commit de documentação, pois um commit não pode conter seu próprio SHA.

SHA final: `c6d6d45e7a043695e70c518a9604a89a643dedac`

FIM-TAREFA-37M (concluída) c6d6d45e7a043695e70c518a9604a89a643dedac

## Revisão 37n

O código original restringe o Autoagendamento à unidade cujo slug é `sansaude`. Na AME o menu permanece oculto; a rota direta agora informa a restrição da unidade. No staging foi criada uma Sansaúde fictícia, com configuração fictícia desativada e sem credenciais ou reservas reais. O usuário de teste `qa_autoagenda` tem apenas a permissão de edição do módulo nessa unidade. Administrador e usuário autorizado abrem o console, a configuração e os indicadores; a API aplica a permissão de leitura ou edição do módulo também à configuração e ao acompanhamento, e a troca de credencial continua exigindo a senha do usuário. Sem permissão, as APIs negam acesso. A lateral de um usuário com apenas essa permissão mostra o item na Sansaúde. Testes adicionais cobrem os níveis e o isolamento por unidade.

A marca na lateral escura usa a cor de texto do tema. A reprodução no navegador confirmou o menu, console, configuração e indicadores para ambos os perfis, o menu exclusivo do usuário de teste e a ausência do menu e mensagem da rota na AME. O build de produção com o Login personalizado e a suíte frontend passaram (670 testes). Nenhuma migração foi adicionada.

O estágio antigo usava um worker e DEBUG ligado; foi reconstruído com três workers, DEBUG desligado, assets minificados, banco descartável e envios simulados. Em medições locais antes da reconstrução, `GET /health/` levou 4 ms no staging e 8 ms na produção; após, 31 ms e 7 ms sob carga. Os assets principais levaram 18 ms no staging e 10 ms na produção (635 kB e 616 kB); não foi identificada regressão do código nessas leituras. Após a reconstrução, login no staging levou 1,2–1,5 s, consulta do Canvas 0,16 s e criação de usuário fictício 1,42 s. São amostras pontuais, não uma prova da causa das lentidões relatadas no navegador; o servidor tinha várias suítes simultâneas e carga elevada. A produção foi consultada apenas por GET, sem acesso ao banco real.

Logs das suítes: `/tmp/orbita-37n-frontend.log` e `/tmp/orbita-37n-backend.log`. O staging 8115 usa `admin` e a mesma senha exclusiva de staging da tarefa anterior; a unidade e os usuários de teste são fictícios.

A suíte backend completa em PostgreSQL isolado terminou com **1.297 testes aprovados e 5 ignorados**. O commit anterior a esta atualização de documentação é `9cd45dd`; o SHA final da entrega é obtido com `git rev-parse HEAD`.
