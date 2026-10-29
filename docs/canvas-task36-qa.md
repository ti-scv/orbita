# Tarefa 36 — investigação e QA

## Estado

Parcial. O ponto de partida confirmado é `f253842` na branch `feature/canvas-fila36`. Na investigação, `feature/canvas-fila35` também apontava para `f253842`: a tarefa 35 ainda não estava integrada. O pedido exige partir do HEAD posterior à integração e usar seus tipos de permissão. Nenhuma sincronização, migração ou liberação foi implementada neste estado.

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
| Suítes completas e staging isolado na porta 8099 | Pendente | Pendente |

Nenhuma suíte ou staging foi executado: não há implementação a validar. A regra específica da tarefa determina a porta 8099, apesar da referência à porta 8091 no brief. Nenhuma migração foi aplicada.
