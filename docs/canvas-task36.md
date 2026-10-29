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
