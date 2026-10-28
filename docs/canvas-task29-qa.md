# Tarefa 29 — execução parcial

## Alterações

- Nome padrão da fonte de relatório usa o nome do catálogo sem o sufixo de conjunto; lista de relatórios não acrescenta o código. O identificador foi movido para detalhes avançados. A tradução de erros continua limitada ao padrão já tratado, e não foi auditada em todos os pontos.
- Origem abre com consulta recolhida em “Consulta usada (avançado)” e mostra o nome curto. Colunas podem quebrar linhas e o menu tem rótulo “Mais ações da coluna”. A contagem no painel começa por “Mostrando” e tem explicação no atributo title; ainda é necessário confirmar um popover plenamente acessível por teclado e a contagem na gaveta.
- Máscara aceita ISO colado e DD-MM-AAAA; testes unitários foram ampliados. Falta confirmar a interação de colagem no navegador.
- O editor contém o botão único de tema do app; a matriz alternou temas nas telas capturadas.

## Verificação

- `scripts/canvas-check.sh`: 525 testes, hooks, TypeScript e build passaram, log /tmp/canvas-task29-check.log.
- Backend com SQLite isolado: 42 testes de prévia, canvas e paginação passaram, log /tmp/canvas-task29-backend.log (o fim do arquivo contém também texto residual de uma tentativa anterior com nome de imagem incorreto).
- Staging reconstruído com a API indicada. Curl encontrou `ReportCanvas-DDmcrE_t.js`, diferente de Cx0Ydhi6.
- Matriz sintética: 12 cenários, relatórios 1 e 6, 1100/1280/1440 px, temas claro e escuro, 48 capturas com prefixo t29 e resultados em docs/canvas-qa-prints/t29-resultados.json. Detector: zero erros de execução, sobreposições visíveis, rolagens horizontais e cortes não intencionais. Aberturas sintéticas entre 970 e 1161 ms, largura padrão do painel 215 px (1100) ou 247 px (1280/1440). Não substitui inspeção humana nem medição autenticada; não cobre todos os diálogos.
- Os logs disponíveis antes da reconstrução mostraram um 400 de prévia do relatório 1 em 28/10/2026 10:02:43 UTC, mas não os 400 do relatório 6 nem os 502 citados. O container da API estava configurado com um worker e timeout 120 s. Não há evidência suficiente para determinar a causa dos erros ou justificar alteração de workers. A validação encontrada no editor JSON é acionada pelo usuário. Nenhum pedido do relatório 6 foi reproduzido ou capturado.

## Pendências

A tarefa não está concluída. Faltam sessão real e linha do tempo de rede com e sem cache, identificação da etapa dominante e verificação da meta de 3 s e do esqueleto de origem; reprodução dos 400/502 e investigação do timeout; tradução abrangente de parâmetros, valores, identificadores e erros; inferência de tipos de texto e datas; resumo e estado inicial de parâmetros; confirmação de acessibilidade das explicações e análise visual completa. A matriz não cobre o relatório 2 nem os diálogos de origem e parâmetros em todos os temas. A origem continua com cache/pré-busca anterior, sem medição de 500 ms. Não houve alteração de produção, push, migração, salvamento ou ativação de relatórios. Login.tsx e a auditoria preexistente foram preservados.

FIM-TAREFA-29 — execução parcial; pendências acima.
FIM-DO-PROCESSO

## Continuação 29b — execução parcial

- A apresentação remove o sufixo “› Dados” dos nomes de fonte e dos erros tratados pelo helper; a gaveta usa o nome amigável e a origem mostra o nome curto. Foram adicionadas explicações acionáveis por teclado para as contagens no painel e na gaveta.
- Na prévia de fonte, os parâmetros conhecidos recebem rótulos e valores legíveis, incluindo data final sem limite. O editor de parâmetros usa rótulos amigáveis em parte de suas ações. Datas brasileiras são reconhecidas na inferência; a lista de colunas utiliza a amostra para corrigir tipo desconhecido ou data pura classificada como data e hora.
- A auditoria completa de identificadores não terminou: o formulário da fonte ainda expõe nomes técnicos nos campos de vínculo e há outros caminhos de erro não auditados. Não foi implementado o resumo de alterações de parâmetros, nem a mensagem completa de parâmetro inexistente. A aparência e acessibilidade das novas explicações precisam de inspeção adicional.
- Sessão temporária autenticada, usuário existente, staging 8091, sem salvar relatórios. Chromium em 28/10/2026: abertura até a área do editor, sem cache / após navegação de aquecimento, respectivamente: relatório 1 1093/974 ms; relatório 2 1051/1096 ms; relatório 6 1154/873 ms. Em seguida foi acionado “Dados reais”; as prévias responderam 200 em 136/38, 152/44 e 155/39 ms respectivamente. São amostras únicas, feitas antes da reconstrução final, e não medem até a conclusão visual de todos os blocos. Requisições registradas em /tmp/canvas29b-real-warm.json; a maior espera de API nessa amostra foi 165 ms (CSRF, relatório 6 sem cache). A diferença até a abertura inclui carregamento e execução do frontend, não se isolou a etapa dominante. Não houve timeout de 20 s do relatório 2 na amostra.
- No relatório 6, a prévia enviou source report_id 6, unidade ame, período 2026-09-28 a 2026-10-28, parâmetros de execução vazios, limite 50 e offset 0; respondeu 200. Não houve chamadas de validação nessa abertura. Não foram reproduzidos os 400 nem o 502 relatados, e os logs disponíveis não permitem determinar suas causas exatas. Não se alterou a configuração de workers. É necessário reproduzir os erros e correlacionar os horários antes de propor alteração para produção.
- scripts/canvas-check.sh: 50 arquivos de testes passaram, hooks, TypeScript e build passaram (/tmp/canvas29b-check-verified.log). Backend: 42 testes em SQLite isolado passaram (/tmp/canvas29b-backend.log). Staging reconstruído com API_UPSTREAM solicitado; curl confirmou ReportCanvas-BLkEWOFt.js, HTTP 200, diferente de DDmcrE_t.
- Pendências adicionais: medição do esqueleto da origem, colagens das três datas no navegador, investigação completa de desempenho, erros e logs, auditoria dos identificadores em todas as telas e matriz visual integral. A matriz sintética não substitui dados reais. Não houve push, migração, gravação de relatórios ou mudança em produção; Login.tsx e a auditoria preexistente não foram incluídos nos commits.

- Matriz sintética t29b: 18 cenários (relatórios 1, 2 e 6, 1100/1280/1440, claro e escuro), 90 capturas de dados, parâmetros expandidos, gaveta, origem e editor de fonte. Detector: zero erros, rolagem horizontal, sobreposições visíveis ou cortes não intencionais. Não cobre o diálogo de parâmetros completo nem substitui inspeção humana. Resultados: docs/canvas-qa-prints/t29b-resultados.json.

FIM-TAREFA-29B — execução parcial; pendências acima.
FIM-DO-PROCESSO
