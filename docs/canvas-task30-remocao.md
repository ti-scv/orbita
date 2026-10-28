# Tarefa 30 — andamento parcial

O editor já permitia remover um bloco pelo inspetor e pelas teclas Delete e Backspace, com histórico de desfazer e refazer. Esta alteração acrescenta aviso temporário com Desfazer; quando o bloco usa uma fonte, o aviso informa que a fonte continua disponível. A remoção altera o rascunho do layout e só é persistida ao salvar o relatório. O aviso desaparece se outra alteração mudar o histórico, para não desfazer uma ação diferente.

Ainda não foi implementada a remoção de relatórios ou conexões, nem seu restauro, permissões, dependências, auditoria ou testes. `enabled` já representa ativação e não distingue um registro removido de um registro inativo; não foi reutilizado como arquivo. Não há migração criada ou aplicada. Também faltam seleção múltipla e menu de contexto de bloco, testes de interação, matriz visual, integração com a tarefa 29d e validação no staging. Não houve exclusão no staging nem alteração de dados reais.

## Continuação — execução parcial

- O TypeScript do commit ca09a26 passou em verificação isolada com as dependências do checkout principal e Node 24.
- A confirmação de remoção de fonte apresenta nomes legíveis dos tipos dos componentes, inclusive quando não têm título. O menu do inspetor informa o nome do componente na ação de remover. Um teste isolado da descrição de dependências passou.
- A tentativa de teste de interação do editor expirou ao iniciar o worker durante a carga do servidor; não se considera o fluxo visual validado.
- Ainda faltam seleção e remoção múltipla, menu de contexto no bloco, testes do fluxo completo, remoção e restauração de relatórios e conexões, dependências, permissões, auditoria, matriz visual e integração.
- Os modelos de relatório e conexão têm campo de ativação, mas ele já representa outro estado e não distingue remoção de desativação. Nenhuma migração foi criada nem aplicada; não se implementou remoção parcial que possa deixar relatórios ou conexões inconsistentes.
- A 29d ainda estava em execução e o checkout principal tinha alterações não commitadas. Não houve cherry-pick, reconstrução de staging nem reinício da API. Nenhuma exclusão foi executada no banco real.

FIM-TAREFA-30 — parcial; integração e pendências acima não concluídas.
FIM-DO-PROCESSO

## Continuação 30c — componentes

- No palco, Shift+clique seleciona mais componentes. O menu de contexto informa quando removerá o conjunto, que entra no histórico como uma única ação. O inspetor continua removendo apenas o componente indicado. O aviso de remoção permite desfazer; as fontes permanecem disponíveis. A alteração só é persistida ao salvar o relatório.
- O teste de interação usa dados sintéticos e cobriu remoção múltipla pelo menu, desfazer, Delete fora de campos editáveis e refazer. Passaram dois testes, TypeScript e lint de hooks. A versão instalada do Vitest não aceita `--poolOptions.forks.singleFork`; usou-se `--pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=120000`. Uma tentativa anterior expirou ao iniciar o worker e não executou testes.
- Ainda faltam remoção e restauração de relatórios e conexões, dependências, permissões, auditoria, testes desses fluxos, matriz visual e integração. Nenhuma migração foi criada ou aplicada; não se alterou o banco real.

