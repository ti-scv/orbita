# Tarefa 20 - QA parcial

## Parametros

Na edicao da fonte, o botao de remocao ja existia para vinculos em `source.parameters`. A rotina reconstruia todos os valores ao remover um so vinculo, convertendo valores `null` de outros vinculos em texto vazio. A remocao agora pede confirmacao e apaga apenas a chave escolhida no rascunho; salvar a fonte e depois o relatorio continuam necessarios. Teste: abra uma fonte com dois vinculos, remova um, cancele ou confirme e confira o outro. O teste automatizado usa `null`, cancela e confirma sem salvar.

A auditoria tambem descreve declaracoes historicas em `legacy.parameters` e o contrato `parameter_schema`, que nao sao a mesma lista de vinculos da fonte. Faltam acesso e exclusao dessas declaracoes, selos, locais de uso, exclusao em lote, confirmacao especifica e sugestao de renomeacao. A auditoria e uma fotografia por versao; nao se deve apresenta-la como classificacao atual sem verificar identidade e versao. Renomear metadados historicos nao demonstra correcao do contrato atual.

## Erro da previa

Pendente: diagnostico seguro, codigo HTTP, tempo, copia e repeticao. `request` descarta o codigo HTTP e pode receber mensagem generica do servidor. A implementacao de backend esta sob `backend/operations/`, cuja alteracao foi proibida; nao foi modificada.

## JSON

Pendente: edicao, validacao compartilhada com o backend, confirmacao e desfazer. Nao ha mudanca no fluxo de salvar.

## Origem das colunas

Pendente: painel nas duas listas, consulta, banco, destaque e data da leitura. A origem real nao deve ser inferida apenas pelo nome da coluna.

## Verificacao

Nao foram criados ou salvos relatorios. Node 18 do host nao atende ao Vitest do projeto; a verificacao oficial usa Node 24 em conteiner. A alteracao nao constitui a entrega completa da tarefa.

O teste especifico passou em Node 24. `canvas-check.sh` ficou parado em `npm ci` e o build de staging ficou parado em `npm run build`; ambos foram interrompidos sem resultado. Staging nao foi validado visualmente.


## Continuidade da tarefa 20

A auditoria foi lida. A classificacao depende do ID e da versao da definicao; nao e seguro aplicar a fotografia a declaracoes alteradas. A edicao das declaracoes e os selos permanecem pendentes. Nenhum relatorio foi modificado.

Na lista de fontes expandida, a falha da previa agora mostra a fonte, o HTTP quando disponivel, o tempo e o botao Tentar de novo. A API de frontend preserva o status nos erros. Teste: expandir uma fonte com falha e acionar Tentar de novo; o teste automatizado usa dados simulados e abertura pelo teclado. Ainda faltam diagnostico seguro da mensagem real e Copiar detalhes. A implementacao do endpoint fica em backend/operations/report_canvas, que esta fora do escopo permitido; nao foi alterada.

JSON e origem das colunas permanecem pendentes. A tarefa nao esta concluida.

Teste especifico: task20-preview.test.tsx, dois testes aprovados em Node 24.

Verificacao final: canvas-check.sh concluiu hooks, TypeScript, 511 testes e build com sucesso; o processo excedeu o limite de 90 segundos durante a finalizacao. canvas-stage.sh up excedeu 90 segundos durante o build; nao foi possivel confirmar a nova imagem nem realizar validacao visual. O container de staging existente nao comprova que a alteracao foi publicada nele.

## Rodada 3 — item 1
Editor de declarações em Dados: contrato atual e cadastro legado; uso real em SQL, fontes, blocos e contrato, duplicidades normalizadas e sugestões da fotografia CSV somente na mesma versão. Renomeação explícita limita-se aos nomes históricos sugeridos, sem reescrever SQL. Exclusão individual/em lote mostra resumo e consumidores; tudo fica pendente até Salvar. A causa era a interface editar apenas vínculos de fonte, não declarações. Nenhum relatório foi alterado por script. Backend: dois testes aprovados. Teste de interface cobre seleção e confirmação.
