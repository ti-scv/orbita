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


A matriz sintética do componente foi executada em servidor de desenvolvimento isolado, sem gravações na API: menu e aviso com Desfazer em 1440, 1280 e 1100 px, nos temas claro e escuro (12 capturas `t30-*`). O teste restaurou o componente em todos os seis cenários. Não detectou erros de página, rolagem horizontal, botões sem nome, sobreposições entre botões ou cortes não identificados; essa verificação não substitui uma revisão visual completa. A primeira execução encontrou o menu atrás do painel lateral; sua posição foi corrigida e a matriz repetida. Os diálogos de relatórios e conexões ainda não existem e não foram capturados.


## Continuação 30d — relatórios e conexões

- A remoção de um componente altera apenas o rascunho do relatório; a fonte continua disponível. A alteração só é persistida ao salvar. Há seleção múltipla, menu no bloco, Delete/Backspace fora de campos editáveis e aviso temporário com Desfazer. Remover uma fonte com componentes ligados pede confirmação e apresenta seus nomes.
- Relatórios e conexões de banco e de aplicativo usam remoção reversível. Apenas administradores, como na edição, podem remover, consultar removidos e restaurar. A operação confere unidade e versão; guarda o estado de ativação anterior, a data e o responsável, registra auditoria e preserva as credenciais. Restaurar devolve o estado de ativação anterior. O diálogo lista vínculos e bloqueia a remoção enquanto existirem. Há seção recolhida de registros removidos nas respectivas listas e ação no editor do relatório.
- A migração `operations/0031_report_removal.py` está pendente de decisão e não foi aplicada ao banco real. Por padrão `REPORT_REMOVAL_ENABLED` fica desligado: os modelos e consultas continuam compatíveis com o banco anterior e remoção, listagem de removidos e restauração respondem 503 com orientação. Após aprovação e aplicação da migração no banco correspondente, é necessário configurar `REPORT_REMOVAL_ENABLED=1` e reiniciar os processos que usam o banco. Não desligar a chave após criar registros removidos, pois o modo de compatibilidade não distingue esses registros. A decisão de migrar e habilitar não foi tomada nesta tarefa.
- No SQLite, o filtro de dia da semana usa `json_each`, pois o lookup JSON `contains` do Django não é suportado nesse banco; PostgreSQL mantém o lookup original.
- As capturas `t30-*` são sintéticas. As matrizes anteriores cobriram 1100, 1280 e 1440 px, nos temas claro e escuro; incluem menu e Desfazer no palco, confirmação de relatório, conexões com dependências e seções de removidos. Os resultados automatizados não substituem inspeção visual completa.
