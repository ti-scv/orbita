# Tarefa 33 — QA parcial

| Item | Teste | Print |
| --- | --- | --- |
| 1 | `ReportWorkspace.task33.test.tsx`: ausência na lista, ação na edição e bloqueio com flag desligada; `ReportRemoval.test.tsx`: confirmação, vínculos e remoção. | Pendente |
| 2 | Busca por nome na unidade do Canvas, inclusão, ordenação, remoção e preservação de campos de composições salvas: testes de frontend e backend e navegador no staging isolado. A continuação 33i cobre seleção e resolução de relatórios de outras unidades autorizadas. | `canvas-task33-evidencias/33e-{light,dark}-{100,150}.png` |
| 3 | Remoção individual e do bloco, confirmação, persistência após recarregar, restauração, permissão e conflito de versão: testes de frontend e backend e navegador no staging isolado. A configuração de execução e o SQL são preservados. | `canvas-task33-evidencias/33d-{light,dark}-{100,150}.png` |
| 4 | Parcial: `orientation.test.tsx`, navegador (troca e gravação nos dois sentidos) e `test_page_orientation_persists_and_controls_pdf` (dimensões e texto no PDF); falta garantir ausência de corte em blocos com conteúdo denso após reduzir suas dimensões. | `canvas-task33-evidencias/`: claro e escuro, 100% e 150%. |
| 5 | `settingsDirectory.test.ts` e `ReportWorkspace.task33.test.tsx`: entrada de configuração e ausência da aba. Falta validar atalho antigo no navegador e permissões. | Pendente |

Os prints do item 4 estão em `canvas-task33-evidencias`; os demais itens ainda aguardam evidências visuais.

A suíte completa do frontend passou (70 arquivos). O staging isolado responde em `127.0.0.1:8095`, usando `orbita-api-fila` e `orbita-db-fila`.

Pontos para continuação: a execução de composições procura componentes por código na própria unidade; a opção de outras unidades exige adequação da resolução e das permissões no backend. A auditoria é calculada a partir do legado e da consulta, sem armazenamento de exclusões. A alteração de tamanho atual ajusta os blocos aos limites da página, o que requer validação cuidadosa para evitar perda de conteúdo.

Suíte completa de backend em PostgreSQL descartável: 1.017 passaram e cinco falharam em `tests/test_report_removal.py`, com resposta 503 porque a flag de remoção permanece desligada:

- `test_report_remove_restore_and_permissions`
- `test_connection_with_report_is_blocked_and_keeps_secret`
- `test_report_with_schedules_and_canvas_references_cannot_be_removed`
- `test_app_connection_restore_preserves_previous_inactive_state`
- `test_other_unit_cannot_remove_report`

A primeira execução tinha também falhas por falta de chaves descartáveis e montagem dos arquivos de teste; a segunda usou chaves de teste e montou `files` somente para leitura.


Item 4: frontend 639 testes passaram; backend PostgreSQL descartável: 1.019 passaram e as cinco falhas conhecidas de `test_report_removal.py` retornaram 503 com a flag desligada. O PDF usa as dimensões gravadas; a impressão do visualizador usa esse PDF. O ajuste proporcional preserva a posição relativa dos blocos, mas fontes e conteúdo interno não são escalados, portanto ainda é possível cortar conteúdo denso. A ausência de cortes não está comprovada. O staging 8095 foi reconstruído. `FILA-REGRAS.md` não estava presente neste checkout.

Item 3: `ReportWorkspace.task33.test.tsx` passou (2 testes); `test_report_catalog.py` passou em PostgreSQL descartável (51 testes). A suíte completa do backend teve 1.020 testes aprovados e as cinco falhas conhecidas em `test_report_removal.py`, com 503 pela flag desligada. No frontend, a suíte completa teve 639 aprovados e um timeout em `task13.test.tsx`; esse arquivo passou isoladamente (4 testes). No navegador, a remoção individual persistiu após recarregar, e a remoção do bloco e a restauração foram verificadas. As quatro capturas são distintas e correspondem aos temas claro e escuro em 100% e 150%. Frontend e API do staging isolado 8095 foram reconstruídos.

Item 2: no navegador, a composição foi salva e reaberta com ordem e parâmetros preservados. As quatro capturas são distintas, nos temas claro e escuro com zoom de 100% e 150%. O staging 8095 foi reconstruído. Frontend: 641 testes passaram; build e verificação de tipos passaram. Backend em PostgreSQL descartável: 1.013 passaram, cinco falharam pela flag de remoção desligada e sete tiveram erro de configuração pela ausência inicial da chave Oracle de teste; os testes afetados foram executados novamente com chave descartável (ver resultado abaixo). A busca em outras unidades permanece pendente.


Reexecução com chave Oracle descartável: 59 testes aprovados em `test_operational_sql.py` e `test_report_catalog.py`, incluindo o novo teste de isolamento por unidade e persistência da composição.

## Continuação 33f — parcial

O teste de navegador `scripts/canvas-task33f-shortcut-qa.cjs`, usando sessão administrativa e dados descartáveis da unidade `qa33c` no staging isolado, confirmou que o endereço antigo `reportTab=appSources` abre a configuração geral de Instâncias dos apps e que o atalho não aparece no editor Canvas. As verificações anteriores de permissões em `settingsDirectory.test.ts` continuam aplicáveis; não houve nova validação de permissões no navegador.

O staging `orbita-canvas-stage-fila` foi reconstruído na porta 8095 e retornou HTTP 200. Os testes `tests/test_report_canvas.py` e `tests/test_report_catalog.py` passaram (87 testes), em PostgreSQL descartável `orbita-task33f-db`. Uma tentativa anterior com credenciais incorretas do banco isolado teve 70 erros de conexão; a execução acima usou um banco dedicado. A execução inicial do frontend no Node 18 do host falhou por incompatibilidade com jsdom; a verificação suportada via `scripts/canvas-check.sh` foi executada separadamente.

Continuam pendentes: correção e provas de ausência de cortes com conteúdo denso em ambas as orientações, editor, visualização e PDF/impressão; capturas correspondentes em ambos os temas e níveis de zoom; busca e resolução segura de componentes de outras unidades com teste de permissões. Nenhuma dessas funcionalidades foi implementada nesta continuação.

Frontend: `scripts/canvas-check.sh` passou com Node 24 (641 testes em 71 arquivos, ESLint de hooks, TypeScript e build). O build apresentou apenas o aviso de tamanho de chunks.

## Continuação 33g — parcial

Os commits 5afc7e5 e 59cdb19 preservam texto longo e linhas longas de tabelas no PDF por continuação e permitem rolagem de texto e KPI no editor. A continuação divide também tabelas largas em grupos de colunas no PDF. Os dois testes de `backend/tests/test_canvas_dense_pdf.py` passaram em container, com as duas dimensões de página: verificam palavras, células e colunas nos textos extraídos do PDF. Eles não comprovam a apresentação visual nem a troca de orientação pela interface.

O frontend passou em `scripts/canvas-check.sh` nesta retomada: 641 testes em 71 arquivos, ESLint de hooks, TypeScript e build; houve aviso de tamanho de chunks. O frontend isolado de 8095 foi reconstruído, e a API isolada foi atualizada e reiniciada com o PDF deste checkout; a imagem `orbita-api-fila:task33g` também foi reconstruída. O frontend respondeu HTTP 200. A atualização da API no container em execução foi feita por cópia do arquivo, portanto ao recriar o container é necessário usar a imagem reconstruída.

Ainda falta validar no navegador, em ambas as direções, editor, visualização e PDF/impressão com dados densos, e capturar novas evidências em 100% e 150% nos temas claro e escuro. Os prints já existentes são de verificações anteriores e não demonstram esse cenário. Os gráficos ainda podem cortar rótulos ou legendas, e a correção não garante ausência de cortes para todos os tamanhos e conteúdos; especialmente tabelas com larguras de coluna muito desiguais e títulos longos precisam de validação. Por isso o item 4 permanece parcial.

## Continuação 33h — parcial

A prévia de barras e linhas reserva espaço para as categorias e para o eixo numérico, mostra todas as categorias e permite rolar o bloco. A legenda é exibida fora do desenho, com quebra de linha; o mesmo tratamento de legenda se aplica à pizza. No PDF, o gráfico usa categorias e séries numeradas e acrescenta páginas com uma tabela paginada de rótulos e valores. Isso aumenta o número de páginas também para gráficos pequenos. Os testes de PDF verificam os rótulos completos de barras, linhas e pizza em ambas as dimensões, por extração de texto; não demonstram ausência de cortes visuais nos gráficos nem em títulos e valores extremos.

Frontend completo: 641 testes em 71 arquivos, ESLint de hooks, TypeScript e build passaram. Backend: 103 testes passaram em PostgreSQL descartável, nos arquivos test_canvas_dense_pdf.py, test_canvas_chart_grouping.py, test_report_canvas.py e test_report_catalog.py. Duas expectativas anteriores de PDF de uma página foram atualizadas para considerar a continuação. A suíte completa de backend não foi reexecutada nesta etapa.

O script scripts/canvas-task33h-editor-qa.cjs exercitou as duas alterações de orientação no editor do relatório descartável Conteúdo denso QA 33g, em claro e escuro, com escala CSS de 100% e 150%. As oito capturas 33h-{landscape,portrait}-{light,dark}-{100,150}.png mostram o editor; a escala CSS não é uma medição do zoom nativo do navegador. O teste verifica dimensões da página, não a ausência de cortes. A visualização, o PDF visual e o diálogo de impressão ainda precisam ser validados nas duas direções com dados densos, incluindo legendas longas e valores extremos. Portanto, não se declara o item concluído.

O frontend do staging 8095 e a imagem orbita-api-fila:task33g foram reconstruídos; o módulo PDF foi copiado para a API isolada em execução, que foi reiniciada, e o frontend respondeu HTTP 200.

Complemento: scripts/canvas-task33h-preview-qa.cjs também gerou, no navegador e com o relatório denso, as prévias em ambas as orientações. Os arquivos 33h-preview-{landscape,portrait}.{pdf,png} estão nas evidências. O PDF horizontal tem cinco páginas de 842,25 × 595,5 pontos e o vertical quatro páginas de 595,5 × 842,25 pontos. Foi verificada a geração e a dimensão, não a inspeção visual de todos os conteúdos ou o diálogo físico de impressão.
## Continuação 33i — busca entre unidades

A composição pode pesquisar relatórios de unidades acessíveis, agrupados por unidade, com nome, código e ID. Referências novas a outra unidade usam o ID; referências anteriores continuam resolvidas por código na unidade original. O catálogo e a gravação verificam o acesso, e a execução volta a verificar o acesso do solicitante, inclusive após revogação. Componentes de outra unidade sem acesso são ocultados na resposta; ao salvar é necessário removê-los ou recuperar o acesso. Chaves de instância permanecem limitadas à sua unidade.

A execução de uma composição com fonte externa exige um solicitante com acesso à unidade e ao relatório externo; execuções sem solicitante não podem usar essa fonte. A auditoria de parâmetros informa que o componente externo não foi auditado, sem expor seus dados.

Validação em PostgreSQL descartável: 53 testes de catálogo passaram; na rodada ampliada passaram 77 testes e um teste de Indicadores Médicos falhou porque os arquivos de fixture não foram montados. Após montar files como /report_files somente para leitura, os sete testes de Indicadores Médicos passaram. No frontend, scripts/canvas-check.sh com ReportWorkspace.task33.test.tsx passou (quatro testes, hooks, TypeScript e build). Não foi executada a suíte completa.

No staging isolado 8101, com API e banco próprios descartáveis, o navegador mostrou resultados de duas unidades com o mesmo nome e código e verificou inclusão, gravação e reabertura. Capturas: canvas-task33-evidencias/33i-{light,dark}-{100,150}.png. Script: scripts/canvas-task33i-qa.cjs.

## Continuação 33j — integração

Merge local da 33i na 33h: `e42dc0d1760122587bcee4df481ad625e180c0b7`. O conflito de documentação foi resolvido preservando os registros das duas continuações.

Frontend completo: `bash scripts/canvas-check.sh` passou (ESLint de hooks, TypeScript, suíte Vitest e build); o build avisou sobre tamanho de chunks. Backend em PostgreSQL descartável: 104 testes passaram nos arquivos `test_canvas_dense_pdf.py`, `test_canvas_chart_grouping.py`, `test_report_canvas.py`, `test_report_catalog.py` e `test_report_removal.py`; as cinco falhas conhecidas de remoção retornaram 503 com a flag desligada. Não foi executada a suíte completa do backend.

Staging isolado 8095 reconstruído, com API executando a imagem `orbita-api-fila:task33j` e proxy preservado. As rotas `/relatorios/57/canvas?unit=scv` e `/relatorios/1/canvas?unit=ame`, assim como `/health/`, responderam HTTP 200. Isso confirma a resposta HTTP, não uma validação funcional no navegador. Ao iniciar, o Django avisou que há alterações de modelos de `operations` não refletidas em migration; nenhuma migration pendente foi aplicada. As limitações de validação visual registradas na 33h permanecem.

## Continuação 33l — revisão qa22

O catálogo do Canvas inclui agora relatórios finais não homologados da mesma unidade como fontes em revisão, sem alterar as restrições de execução. No relatório 3 de qa33e o navegador mostrou os IDs 4, 5 e 6, e a busca por nome funciona mesmo com poucas opções. O filtro de estabelecimento continua operando dentro da unidade proprietária: o acesso e a resolução de fontes de outras unidades administrativas no Canvas ainda não foram implementados, portanto esse trecho do item 1 permanece pendente.

Em 29/10/2026, em Chromium local de 1440 × 900, com contexto novo e sessão autenticada, antes das alterações o editor 3 ficou pronto em 1,093 s e o diretório de Configurações em 1,081 s; a tela de login apareceu em 0,409 s. Após o rebuild foram 1,104 s, 0,449 s e 0,580 s, respectivamente. Não foi medido o envio de credenciais no login; a medição não comprova login completo abaixo de 3 s. Os tempos de 8/10/20 s relatados na qa22 não foram reproduzidos e sua causa não foi comprovada. Foram eliminadas cinco consultas de outras áreas que bloqueavam Configurações. Curl autenticado após rebuild: sessão 0,038 s, definição 0,061 s, canvas 0,038 s e control 0,040 s; todos 200. A API isolada tinha um worker síncrono; o log não apresentou timeout, mas registrou aviso anterior sobre alterações de modelo sem migration e diretório staticfiles ausente.

O estado vazio foi deslocado para a metade superior da folha; no navegador a área estava entre y=342 e y=466, dentro do estágio y=85–872. Ao reduzir a página, blocos próximos da borda respeitam 24 px de margem; texto excedente rola dentro do bloco. No relatório 7 em paisagem, após o rebuild, a área interna media 177 px e o conteúdo 718 px, com rolagem ativa e o fim do bloco 347 px acima do fim da folha na escala medida. As amostras ganharam borda no tema escuro e o aviso de portabilidade flutua sem modificar o tamanho do editor. A verificação não cobre PDF/impressão ou todas as escalas e tamanhos de viewport.

Vitest em Node 24: 23 testes aprovados (task34, orientation, task32e e task32f); pytest no PostgreSQL de teste: 25 aprovados (catálogo, colunas SQL e task34). A execução inicial do Vitest no Node do host não iniciou por incompatibilidade com jsdom. A suíte completa não foi executada. A API isolada foi reconstruída a partir da imagem `orbita-api-fila:task33l`; o frontend do staging 8095 foi reconstruído. As rotas `/`, `/login`, `/configuracoes?unit=qa33e`, `/relatorios/3/canvas?unit=qa33e`, `/health/` e as APIs autenticadas acima responderam 200. Não houve push.
