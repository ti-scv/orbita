# Tarefa 27 — QA7 (parcial)

No servidor scv59, branch feature/canvas-redesign. As alterações de Login.tsx e a auditoria preexistentes foram preservadas.

Foram aplicadas correções parciais: seleção e exclusão de parâmetros com uso identificado bloqueadas; usos exibidos em selo com detalhe no tooltip; formatação de células compartilhada pela tabela do palco, gaveta e prévia do editor de fonte; aviso de parâmetros em estilo neutro; disposição e tooltip do botão Origem; horário de rascunho com formato de 24 horas explícito. A contagem do selo refere-se aos locais identificados, que podem incluir consultas e fontes, não apenas blocos. O painel de parâmetros ainda não foi alargado.

Validação: scripts/canvas-check.sh passou com 519 testes, lint de hooks, TypeScript e build (log /tmp/canvas-task27-check-final.log). O script cobre frontend, não backend. Não houve mudança de backend.

Pendências: contagem total limitada no backend e texto padronizado; etapas e medição de abertura; origem e nome amigável completos; entrada de data brasileira; contraste do inspetor; investigação do zoom e expiração de rascunhos; script Playwright e matriz de larguras, temas e painéis; capturas e validação visual. Não foi validado o botão Descartar nem se há outros horários com AM/PM. Não há resultados de larguras a relatar. A tarefa não está concluída.

## Continuação 27c — andamento parcial

- Fontes PostgreSQL fazem contagem limitada a 10.001 linhas, com teto exibido de 10.000. A contagem e sua indicação de limite são usadas no chip, palco, gaveta e teste da fonte. Se a consulta de contagem falhar, a resposta conserva o limite inferior anterior; nesse caso, ele ainda pode mudar entre páginas. A contagem adicional também precisa de medição em dados reais para avaliar o custo.
- A prévia aceita e exibe datas DD/MM/AAAA e envia AAAA-MM-DD. O inspetor de página somente leitura recebeu regras para manter os valores legíveis; falta revisão visual nos dois temas.
- Rascunhos de versões diferentes são removidos ao consultar o rascunho da versão atual; rascunhos com mais de sete dias ou horário futuro são descartados. Testes cobrem expiração e versões. A ação Descartar ainda não foi validada no navegador.
- O código do zoom usa a mesma variável para o número da barra e a escala da página. Falta reproduzir a divergência relatada no navegador. No código do Canvas, os dois relógios encontrados usam hora de 24 horas; falta validar a interface integralmente.
- Foi escrito `scripts/canvas-task27c-qa.cjs`, que aceita `CANVAS_QA_SESSION`, permite GET e apenas POST de prévia, registra medidas e captura os quatro painéis nas larguras e temas pedidos. A sintaxe foi verificada, mas o roteiro não foi executado: não foi localizada uma sessão de QA disponível. Não há capturas nem resultados de larguras a declarar; seletores e critérios do roteiro ainda precisam de validação em execução real.

Validação: 7 testes de backend passaram com banco de testes SQLite isolado (`/tmp/canvas-task27c-backend-final.log`). `scripts/canvas-check.sh` passou com 522 testes, lint, TypeScript e build (`/tmp/canvas-task27c-check-verified.log`, dois workers e limite de 60 s). Antes disso, uma rodada falhou com três tempos esgotados e um mock de armazenamento incompleto; o mock foi corrigido. O staging 8091 foi reconstruído com `orbita-canvas-task26-api`, e somente essa API foi reiniciada. O curl confirmou o bundle `/assets/ReportCanvas-DtOUW1Wk.js`, contendo os textos novos. Login.tsx e a auditoria preexistentes continuam fora dos commits.

Pendências: etapas e medição de abertura dos relatórios 1 e 6 e meta de desempenho; origem e nome amigável completos; validação visual do contraste e do botão Descartar; reprodução do zoom e busca visual de horários; execução e correção da matriz Playwright com capturas. A contagem real e o custo da consulta limitada ainda precisam ser conferidos no staging. A tarefa não está concluída.

## Continuação 27d — medições e matriz sintética

- Mensagens de carregamento identificam relatório, fontes e montagem. As marcas `canvas-abertura-inicio`, `canvas-definicao-pronta`, `canvas-fontes-prontas` e `canvas-primeira-renderizacao` permitem medições no navegador. Definição e Canvas são requisitados em paralelo; a marca de fontes se refere ao catálogo/layout retornado, não à execução de prévias.
- A origem das colunas usa nomes do catálogo e do conjunto, o tooltip do bloco usa a mesma identificação amigável e o editor apresenta o nome amigável sem alterar o nome salvo ao abrir; o identificador fica em opção avançada. O nome comprido da fonte passou a quebrar linha. Horários do Canvas pesquisados no código usam 24 horas, inclusive no detalhe de origem.
- O botão Descartar foi exercitado em todos os 12 cenários com rascunho sintético: a chave local foi removida. A escala medida coincidiu com a barra: 70%/0,70, 54%/0,54 e 44%/0,44 nas três larguras; a divergência de 194%/104% não foi reproduzida.
- Inspetor somente leitura em relatório ativo: capturas claro e escuro `6-1440-*-inspetor.png`. Cálculo WCAG de `--cv-text` sobre `--cv-surface`, `--cv-surface-2` e `--cv-surface-3`: claro 15,79:1, 15,09:1 e 14,15:1; escuro 15,08:1, 15,64:1 e 13,72:1, acima de 4,5:1. Esses valores cobrem os controles de leitura, não todos os pares de cores da interface.

### Desempenho

Meta de abertura a quente: menos de 3 s. A matriz abaixo usa sessão e APIs sintéticas, sem login real. `Abertura` mede navegação até o workspace; as outras três colunas são milissegundos desde a marca de início, para requisições paralelas e primeira renderização. Os resultados sintéticos atingem a meta, mas não comprovam o tempo de abertura real com autenticação e rede.

| Relatório | Largura | Tema | Abertura ms | Definição ms | Fontes ms | Primeira renderização ms | Resultado dos quatro painéis |
|---|---:|---|---:|---:|---:|---:|---|
| 6 | 1440 | light | 1093 | 30 | 30 | 497 | OK |
| 6 | 1440 | dark | 1271 | 32 | 37 | 504 | OK |
| 6 | 1280 | light | 1278 | 21 | 26 | 540 | OK |
| 6 | 1280 | dark | 1115 | 35 | 35 | 484 | OK |
| 6 | 1100 | light | 1084 | 18 | 21 | 454 | OK |
| 6 | 1100 | dark | 1025 | 14 | 18 | 485 | OK |
| 1 | 1440 | light | 1057 | 14 | 18 | 481 | OK |
| 1 | 1440 | dark | 1096 | 49 | 49 | 523 | OK |
| 1 | 1280 | light | 1005 | 11 | 15 | 460 | OK |
| 1 | 1280 | dark | 1229 | 21 | 24 | 480 | OK |
| 1 | 1100 | light | 1064 | 32 | 37 | 540 | OK |
| 1 | 1100 | dark | 1041 | 20 | 29 | 499 | OK |

Os quatro painéis são Dados, parâmetros, gaveta e editor de fonte; 48 capturas ficam em `docs/canvas-qa-prints/`, com cópias em `/tmp/qa-prints/`. O detector examina rolagem horizontal do documento, botões visíveis sem nome, sobreposição entre botões visíveis e recorte nos seletores inspecionados; não é auditoria exaustiva de todo texto e todo elemento. A primeira execução identificou recorte do nome da fonte em 1100 px, corrigido antes da tabela final. Os dados e chamadas de prévia são simulados, com quatro parâmetros e oito colunas.

Consulta PostgreSQL real em transação `READ ONLY`, três repetições, parâmetros padrão, sem transporte HTTP: relatório 1, amostra 37–38 ms e contagem limitada 16–23 ms (3 linhas); relatório 6, amostra 36–151 ms e contagem 19–28 ms (2.473 linhas). O tempo de execução no banco da contagem foi 2,87–3,70 ms e 6,08–8,76 ms, respectivamente. O custo adicional observado é o da contagem separada; não representa uma garantia para outros períodos ou volume. Nenhum resultado clínico foi registrado.

Validação final: `scripts/canvas-check.sh` passou (522 testes, hooks, TypeScript e build; `/tmp/canvas-task27d-check-final4.log`); 13 testes backend passaram com SQLite isolado (`/tmp/canvas-task27d-backend.log`). Staging 8091 reconstruído; curl confirmou `/assets/ReportCanvas-BLHJSA1s.js`. A sessão sintética bloqueia mutações, exceto respostas simuladas de prévia. Login e auditoria preexistentes foram preservados; sem push ou migração.

Limites: não foi medido o tempo de ponta a ponta com sessão real. Os nomes de colunas dependem dos metadados retornados pela fonte; não há catálogo adicional de tradução de identificadores arbitrários. O detector automatizado não substitui revisão visual completa de todos os estados.
