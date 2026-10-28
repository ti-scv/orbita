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
