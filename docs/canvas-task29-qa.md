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
