# Tarefa 30 — andamento parcial

O editor já permitia remover um bloco pelo inspetor e pelas teclas Delete e Backspace, com histórico de desfazer e refazer. Esta alteração acrescenta aviso temporário com Desfazer; quando o bloco usa uma fonte, o aviso informa que a fonte continua disponível. A remoção altera o rascunho do layout e só é persistida ao salvar o relatório. O aviso desaparece se outra alteração mudar o histórico, para não desfazer uma ação diferente.

Ainda não foi implementada a remoção de relatórios ou conexões, nem seu restauro, permissões, dependências, auditoria ou testes. `enabled` já representa ativação e não distingue um registro removido de um registro inativo; não foi reutilizado como arquivo. Não há migração criada ou aplicada. Também faltam seleção múltipla e menu de contexto de bloco, testes de interação, matriz visual, integração com a tarefa 29d e validação no staging. Não houve exclusão no staging nem alteração de dados reais.
