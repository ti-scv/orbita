# Tarefa 32 — andamento e validação

## Alterações

O diálogo apresenta a origem, a escolha dos dados e o nome em ordem numerada. Para relatórios, busca os parâmetros declarados, mostra valores e opções, informa carregamento ou falha e usa os valores resolvidos para testar a prévia. As opções avançadas continuam acessíveis. O painel evita exibir HTTP e tempo; em erro 400 oferece editar a fonte, e nos demais erros permite tentar de novo.

A geração de valores de prévia substituía incondicionalmente o valor de Unidade pelo identificador da unidade do navegador. Quando esse identificador não consta das opções do relatório, a validação falha. Agora são preservados os valores configurados ou padrões válidos, e a unidade atual só é usada quando aceita. Um teste cobre o caso e a ausência de opção válida. Esta causa foi identificada no código; não foi comprovado que explica o caso específico relatado. A inspeção somente de leitura do relatório 1 mostrou padrão e opção ame, portanto não prova o defeito nesse relatório.

## Verificação

- Frontend: bash scripts/canvas-check.sh, 64 arquivos, 612 testes aprovados, hooks, TypeScript e build aprovados; aviso de tamanho de bundle do Vite.
- Backend: suíte inteira em container sem rede, com SQLite temporário e código montado somente para leitura: 974 aprovados, 11 ignorados, 12 falhas e 17 erros. Não há comparação suficiente para classificá-los como preexistentes. Falhas em test_cross_meta_payload, test_medical_indicators, cinco em test_report_removal, test_bed_snapshots, test_cross_controls, test_report_catalog, test_report_whatsapp e test_snapshot_datasets; os 17 erros são de test_oracle_send_regression. Esse ambiente não reproduz PostgreSQL e integrações da suíte; é necessário repetir com o ambiente de testes isolado apropriado.
- Staging 8091 reconstruído com API_UPSTREAM=orbita-canvas-task26-api:8000; página inicial respondeu 200. A API não foi alterada nem reiniciada.
- Capturas em canvas-task32-evidencias: relatório e tabela manual, em temas claro e escuro, com viewport de 1440×1000 e viewport reduzida para 960×667. As últimas simulam o espaço disponível em 150%, mas não verificam o zoom real do navegador. A navegação abriu e cancelou os diálogos, sem salvar ou excluir.
- Levantamento no banco compartilhado, somente leitura: 212 canvases habilitados e 310 fontes do tipo relatório. As fontes não foram todas executadas, e não existe ainda uma lista confiável das que falham.

## Pendências

A tarefa permanece parcial: testar individualmente as 310 fontes em modo de leitura e documentar suas causas; reproduzir e validar o caso da Unidade; validar com zoom real, teclado, estados de erro e prévia corrigida; completar a revisão do fluxo solicitado, inclusive origem por conexão; repetir e corrigir a suíte do backend em ambiente apropriado; acrescentar cobertura de backend e da interface para os novos estados. A validação visual atual não cobre todos os passos nem erros e sucesso. Não houve deploy em produção.

## Continuação 32b — verificação parcial

- A comparação de opções agora considera o valor convertido, incluindo datas exibidas como dia/mês/ano. Uma validação local falha orienta a editar a fonte, sem oferecer nova tentativa da mesma consulta. O botão de nova tentativa passa a solicitação de repetição ao carregador. Respostas de servidor 5xx recebem orientação simples. Há teste para opção de data; essas alterações não comprovam a causa do relato original.
- A API de prévia cria `Audit` em `backend/operations/report_canvas/source_preview.py`. Não foram executadas as 310 prévias contra o banco compartilhado porque a tarefa proíbe gravações. Nenhuma tabela de resultados de execução pode ser afirmada a partir apenas do inventário. É preciso uma execução que garanta ausência de escrita em todas as origens, inclusive externas, ou um ambiente isolado com dados e conexões adequados.
- A leitura dos metadados encontrou 309 fontes de relatório em 211 canvases simultaneamente habilitados como relatório e canvas. O levantamento anterior contou 310 em 212 canvases com critério diferente; esta diferença não identifica fonte removida. A interface usa “Tabela principal” como nome alternativo para muitas fontes sem rótulo; o nome não identifica o relato. Pergunta ao Danilo: qual é o nome ou endereço do canvas e a unidade em que aparece esse erro?
- Capturas novas em `canvas-task32b-evidencias/` mostram relatório e tabela manual, nos dois temas, em viewport 1440×1000 e 100%; requisições que não fossem GET foram bloqueadas e os diálogos cancelados. Não foram comprovados zoom real a 150%, teclado, os estados e o fluxo de conexão. O antes e depois do caso relatado e as colunas da prévia não foram confirmados. Não se deve interpretar a correção de opções de data como confirmação desse caso.

- Frontend: `bash scripts/canvas-check.sh` passou com 613 testes, tipos, hooks e build; houve aviso de tamanho de bundle.
- Backend: no PostgreSQL descartável, o primeiro preparo incorreto teve 1.000 aprovados, 7 falhas e 7 erros; a execução de `27ef2cc` com o mesmo preparo teve os mesmos resultados e nomes. A causa desses resultados foi o preparo: chave sintética inválida, remoção desligada e ausência dos arquivos em `/report_files`. O código de backend é idêntico entre `27ef2cc` e `58db7da`; isso não substitui a classificação individual das 12 falhas e 17 erros da execução anterior em SQLite.
- Staging 8091 reconstruído com `API_UPSTREAM=orbita-canvas-task26-api:8000`; após a inicialização a página respondeu 200. O backend não foi alterado.
- A suíte inteira do backend foi repetida com PostgreSQL descartável, chave sintética válida, remoção habilitada apenas no teste e arquivos de relatórios montados em leitura: 1.013 testes passaram e um foi ignorado, em 280,41 segundos. Não foram alterados backend ou banco de produção.
