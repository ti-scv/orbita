# Tarefa 36 — investigação e QA

## Estado

Parcial. A investigação anterior partiu de `f253842`; a release `7354299` foi incorporada preservando esse registro. Veja `docs/canvas-task36.md` para o mapeamento atualizado. Nenhuma sincronização, migração ou liberação foi implementada neste estado.

## Como funciona hoje

- `core.models.RemoteInstance` representa uma conexão de uma unidade local com uma unidade de outra instalação. Ela guarda UUID da instalação, slug e metadados da unidade remota, URL, chave cifrada, papel e permissões remotos. A combinação de unidade local, UUID remoto e slug remoto é única.
- `RemoteInstanceViewSet.configure_connection` exige administrador da unidade, consulta o manifesto remoto antes de salvar e registra `instance.connected`. Uma falha no manifesto impede o próprio cadastro. O manifesto fornece identidade da instalação e unidade, papel e permissões, não usuários. A conexão usa chave criada na origem; `InstanceAccessKey` armazena o hash, expiração, revogação e emissor.
- `InstanceKeyAuthentication` valida a chave e a autorização atual do emissor. O protocolo limita a chave à unidade, papel e recursos permitidos; a administração de usuários não está entre eles. O proxy remoto também usa lista de recursos permitidos. A comunicação em `federation_network.py` fixa o endereço resolvido, não segue redirecionamentos, limita tamanho e tempo e usa TLS para HTTPS; o segredo local é cifrado.
- `Membership` representa acesso local e `RemoteMembership` representa acesso a uma conexão. `UserAccessProfile.explicit_units` controla acesso explícito; sem perfil explícito, `remote_access` pode derivar acesso remoto da associação local. A criação normal de usuários exige senha e recusa login já existente; não há fluxo de importação ou identidade federada. Assim, inserir usuários diretamente nesse fluxo sem tratar identidade e acesso implícito poderia conceder acesso indevido ou associar contas de pessoas diferentes.
- `Audit` guarda unidade, ator, ação, identificador e detalhes. Há auditoria de conexão e de configuração de acesso de usuário, mas não de sincronização de usuários.

## Requisito → teste → print

| Requisito | Teste | Print |
| --- | --- | --- |
| Duas instâncias e dados apenas de identificação | Pendente | Pendente |
| Sem senha/permissões herdadas; pendente sem acesso | Pendente | Pendente |
| Deduplicação e remoção/desativação na origem | Pendente | Pendente |
| Ao cadastrar, sob demanda e periódica configurável | Pendente | Pendente |
| Falha de rede preserva cadastro e permite repetição | Pendente | Pendente |
| Só administrador vê e libera; auditoria | Pendente | Pendente |
| Migração reversível em banco descartável | Pendente | Pendente |
| Suítes completas e staging isolado na porta 8110 | Pendente | Pendente |

Nenhuma suíte ou staging foi executado: não há implementação a validar. A regra específica desta etapa determina a porta 8110 e proíbe a porta 8091. Nenhuma migração foi aplicada.

## Execução 36c — parcial

Backend e interface foram alterados na branch local. A sincronização periódica usa
`USER_SYNC_INTERVAL_SECONDS`, com padrão zero (desligada). Uma origem deve emitir
uma chave administrativa com a opção de exportar identidades. O login de uma
identidade em conflito só pode ser resolvido criando uma conta separada.

| Requisito | Evidência | Print |
| --- | --- | --- |
| Exportação restrita à identificação | `test_identity_export_requires_explicit_admin_key_and_only_returns_identification` | Pendente |
| Pendência, colisão, liberação, repetição, remoção e falha de rede | `test_user_sync_release_conflict_removal_and_network`; resposta remota simulada | Pendente |
| Duas instalações com bancos independentes, cadastro com falha de rede, periodicidade e interface | Pendente | Pendente |
| Migração reversível | Migrações anteriores 0013 e 0014; validação reversa pendente | Pendente |

Em contêiner descartável sem rede, com SQLite: os testes direcionados de
federação e sincronização passaram (64). A suíte completa executada antes do
último ajuste no teste de federação teve 1246 aprovados, 9 falhas, 17 erros e
17 ignorados. O teste de federação foi corrigido e passou na execução
direcionada. Falhas também observadas na suíte completa do commit 7354299:
`test_preview_exception_does_not_disclose_connection_or_data`,
`test_cross_body_parameters_are_in_meta_request`,
`test_all_sections_share_readonly_session_and_dates`,
`test_two_workers_queue_and_collect_only_one_daily_snapshot`,
`test_two_operators_cannot_overwrite_activation` e
`test_concurrent_duplicate_inbound_creates_one_execution`. Os 17 erros
em `test_oracle_send_regression.py` também ocorreram na base: os testes
exigem PostgreSQL. `test_concurrent_scheduler_once_per_day` de
`test_report_catalog.py` falhou em execução separada da base com bloqueio
de tabela SQLite. `test_concurrent_workers_capture_one_lives_snapshot` falhou também em execução
isolada no commit-base. As falhas concorrentes podem variar entre execuções SQLite.

A suíte completa não foi repetida no último commit. Faltam os testes com duas
instalações e bancos independentes, testes de interface específicos e prints;
não foi feito rebuild de staging. Nenhum banco real ou contêiner de produção
foi alterado.

O build do frontend passou, assim como a suíte completa (75 arquivos, 665 testes).
Após o ajuste de colisão concorrente, o teste direcionado de sincronização passou.
