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
