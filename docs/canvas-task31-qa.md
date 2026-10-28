# Tarefa 31 — andamento parcial

As alterações estão em `feature/canvas-t31`, no worktree `/opt/orbita-t31`. O trabalho ainda não está pronto para integração: veja as pendências abaixo.

## Alterações e verificações

- Erros inesperados da API recebem mensagem genérica com referência; o servidor registra a exceção. A prévia de fonte e a geração deixaram de exibir mensagens de banco. O teste existente de proteção da prévia passou no PostgreSQL isolado.
- A consulta de vínculos funciona com a remoção desligada; os diálogos recebem `remocao_disponivel` e bloqueiam Remover. As listas de removidos retornam vazias com o mesmo indicador. O texto sobre a indisponibilidade foi simplificado.
- Em PostgreSQL descartável, com a migração 0031 desfeita **somente nesse banco**, foi verificada a ausência da coluna `removed_at`: as quatro consultas de vínculos e removidos responderam 200. A suíte do modo de compatibilidade teve 52 testes aprovados. A migração não foi aplicada ao banco real.
- O editor fecha o menu de ações ao clicar fora, pressionar Esc ou escolher a ação; o cancelamento tenta devolver o foco. Remoção de blocos em relatório ativo é bloqueada, inclusive por teclado; o aviso de desfazer é flutuante e dura oito segundos. Os testes existentes de rascunho cobrem seleção múltipla e Delete; foi acrescentado um teste para relatório ativo.
- A listagem deixou de exibir códigos internos e nomes de bancos crus nos locais ajustados; o contador respeita carregamento e singular. O controle de tema alterna claro e escuro. O teste do relatório preenche o período de 30 dias quando não há outro padrão. Telefones brasileiros são formatados na tabela da prévia do editor.
- Responsável é mapeado de `Case.assignee` (e da junção com o usuário na consulta operacional). Em consulta agregada de leitura, para a unidade AME nos últimos 30 dias, havia três casos confirmados e nenhum tinha responsável atribuído. Isso explica o vazio nessa amostra; não prova a situação de outros períodos ou relatórios.
- `bash scripts/canvas-check.sh`: hooks, TypeScript, 584 testes e build passaram. A primeira suíte completa do backend, em PostgreSQL isolado, teve 987 aprovados, um pulado e duas falhas de preparação (chave sintética Meta e arquivos de teste não montados); uma segunda execução com ambos configurados está em andamento.
- Staging próprio na porta 8093 (8092 estava ocupada por outro processo), com API própria e banco existente sem escrita intencional. A página e `ReportCanvas-D_jyLHbS.js` responderam HTTP 200. A verificação do bundle não equivale a uma revisão visual. Não foi executada exclusão real.

## Pendências

- Completar a suíte ampla do backend, corrigir qualquer falha restante e repetir após integrar os commits paralelos.
- Revisar a segurança de todas as rotas solicitadas com testes específicos de exceções; verificar o fluxo de menu, foco e estado ativo em navegador, e ampliar os testes de seleção múltipla.
- Concluir a varredura de todos os identificadores e termos técnicos, com teste automatizado; cobrir os valores efetivos de parâmetros em todas as origens e a formatação telefônica em todas as prévias.
- O script `scripts/canvas-task31-cadastros-qa.cjs` é uma adaptação parcial do roteiro sintético de cadastros, com zoom e cache desligado. Não foi executado: falta Playwright/Chromium neste ambiente. Ainda precisa cobrir editor, prévia, teste de relatório, relatório com muitas colunas, parâmetro inexistente e todos os critérios de sobreposição e corte. Não há capturas t31 nem medições de navegador para anexar.
- Medir listas, diálogo de vínculos e editor sem cache, identificar e tratar as causas da latência. A alteração da consulta de vínculos reduz campos carregados, mas o ganho não foi medido.
- Fazer rebase sobre a versão mais recente de `feature/canvas-redesign`, executar novamente os testes necessários e só então integrar por fast-forward. O staging 8091 e seu backend não foram reconstruídos nem reiniciados; não seria seguro apresentar esta versão parcial como pronta. Os arquivos paralelos, Login e os demais arquivos excluídos da tarefa foram preservados.
