# Recursos por unidade

Trabalho baseado em `ec04f82af5f8b6b4d706b0ef37fd73abe0caac26`, na branch local `feature/unit-flags`. A worktree foi criada a partir do repositório local `/opt/orbita-checkin-int`, que continha o commit; o objeto não estava disponível em `/opt/orbita`. Nenhum deploy ou push foi realizado.

## Funcionamento

As flags `checkin_enabled` e `autoagenda_enabled` têm padrão falso. A migração ativa ambas na unidade de slug `sansaude` existente; ao reverter, apenas os campos adicionados são removidos. O formulário de edição de unidade oferece os dois interruptores e avisos de configuração incompleta. A edição exige administração da unidade e é registrada em `unit.configured`, com valores anteriores e novos dos recursos alterados.

As APIs, o menu, a entrega, as regras de check-in, os relatórios e os processos periódicos respeitam as flags. Os schedulers mantêm seus interruptores globais e percorrem somente unidades habilitadas. As configurações podem ser inicializadas por unidade habilitada. O chat público usa o nome e a logo cadastrados na unidade; quando não há logo, apresenta um cabeçalho neutro. Para os comandos administrativos, informe `--unit`.

## Staging e evidências

Staging descartável em `http://scv59:8119`, com SQLite próprio e dados fictícios. A API está em rede interna, sem worker ou scheduler. O usuário de teste tem acesso administrativo às duas unidades de demonstração, uma habilitada e outra desabilitada; suas credenciais estão em `/workspace/orbita-canvas/teste119.txt`, fora do repositório. Nenhuma credencial de produção foi usada.

- [Configuração em tema claro](unit-flags/configuracao-claro.png)
- [Configuração em tema escuro](unit-flags/configuracao-escuro.png)
- [Menu com os recursos ligados](unit-flags/menu-ligado.png)
- [Menu com os recursos desligados](unit-flags/menu-desligado.png)

## Verificações

As suítes completas são executadas em contêineres sob `flock /tmp/orbita-suite.lock`, com `pytest -n 2` e `vitest --maxWorkers=2`. O PostgreSQL usado nos testes é descartável e separado do banco de staging e da produção. A migração foi testada nos dois sentidos em banco de teste. A compilação de frontend foi feita em Docker.

A busca `git grep -n sansaude` foi executada e seu resultado está em `/tmp/unitflags-git-grep-sansaude.txt` no servidor. Restam referências históricas em documentação, testes e fixtures, além de identificadores de fontes e dados legados de relatórios não relacionados às regras de acesso dos recursos; estas referências não foram alteradas.

Resultado da execução completa em PostgreSQL: **1.345 passaram, 5 ignorados**. O frontend teve **679 testes aprovados** na suíte completa após a adaptação do chat; o teste focado do chat após o ajuste visual também passou. O build específico do chat passou em Docker. Após o ajuste de concorrência na criação da configuração, os testes focados de recursos, autoagendamento e scheduler tiveram **24 aprovados e 1 ignorado**. O teste focado também exerceu a migração para frente e para trás em banco descartável.

## 39B

Os interruptores têm trilho e botão nos dois temas, com espaço para o rótulo, foco visível e estado acessível; podem ser acionados pelo teclado. O salvamento mostra “Unidade salva.” e mantém o diálogo aberto com erro em português quando falha. Na página sem acesso, nenhum item do menu é marcado como atual.

Os chips usam configurações operacionais por unidade, separadas dos interruptores de acesso: `checkin.Configuration` controla envios e apuração, e `autoagenda.Configuration` controla chat e reservas. Os textos agora identificam o recurso como habilitado na unidade e descrevem os estados dessas configurações sem confundi-los com o interruptor da unidade. As flags globais dos schedulers continuam independentes.

O erro de console reproduzido era o HTTP 401 esperado da consulta de sessão anônima na inicialização. A resposta de CSRF agora informa se a sessão está autenticada, permitindo evitar essa consulta quando não há login; a rota de sessão continua protegida. Navegação headless pelo login, configurações, check-in, autoagendamento e página sem permissão terminou sem erros de console.

Medição no staging isolado 8119 via Chromium headless: antes da alteração, 2.367 ms do clique ao menu, incluindo 1.546 ms no POST de login e 46 ms na consulta de sessão; depois, 1.613 ms, incluindo 1.160 ms no POST e 34 ms na sessão. Não foi reproduzida a espera de 20 s; essas amostras não explicam a lentidão observada anteriormente e não estabelecem uma causa no ambiente.

Verificações: build de frontend em Docker aprovado; suíte frontend 679 aprovados (78 arquivos), com `vitest --maxWorkers=2`; suíte backend 1.349 aprovados e 5 ignorados, com `pytest -n 2`, em PostgreSQL descartável. Ambas sob `flock /tmp/orbita-suite.lock`. Teste focado do contrato CSRF incluído na suíte; verificação no navegador dos estados, dimensões, teclado, erro de salvamento, toast, ausência de item ativo e console. Staging preserva Sansaúde com os dois recursos ligados e outra com ambos desligados.

Capturas novas: [Sansaúde claro](unit-flags/39b-sansaude-light.png), [Sansaúde escuro](unit-flags/39b-sansaude-dark.png), [outra claro](unit-flags/39b-outra-light.png), [outra escuro](unit-flags/39b-outra-dark.png), [check-in](unit-flags/39b-checkin.png), [autoagendamento](unit-flags/39b-autoagenda.png), [sem permissão](unit-flags/39b-sem-permissao.png) e [confirmação](unit-flags/39b-toast.png).
