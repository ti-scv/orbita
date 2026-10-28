# QA da tarefa 31h

Trabalho remoto em /opt/orbita, branch feature/canvas-redesign, com commits locais e integração por fast-forward desde o primeiro ajuste (65e8a95). Sem push, alterações em ícones, exclusão real ou migração 0031 no banco real. Login.tsx, auditoria estática, teste.bin, credenciais e configuração de execução foram preservados. Staging 8091 recebeu somente GETs; os testes de remoção operaram exclusivamente no banco descartável.

## Itens e resultados

| Item | Antes | Depois e evidência |
| --- | --- | --- |
| D1 | Origem estreita; overflow-wrap:anywhere partia Votuporanga e PostgreSQL. | Coluna com mínimo de 145 px, word-break e overflow-wrap normais. Quebra somente nos espaços; em larguras estreitas a tabela mantém sua rolagem interna. Matriz verifica cada palavra por DOM Range em Origem e Banco nos oito pares de zoom/tema. Inspeção da captura de 150% claro confirma Votuporanga e PostgreSQL inteiros. |
| D2 | Canvas em botão, tooltip, publicação, aba, carregamento, confirmações e erros. XLSX sem explicação; mensagens de código usavam JSON. | Ação “Editar relatório”, aba “Desenho do relatório”, publicação “modelo do relatório”, mensagens “relatório” e formato “Excel (XLSX)”. Varredura dos fontes frontend e das mensagens da API, com testes em reportVocabulary.test.ts e test_report_vocabulary.py. Chaves, rotas, SQL e conteúdo editável continuam técnicos quando necessário. |
| D3 | Banco exibia Orbita. | Rótulo “Banco do Órbita”, mapeado centralmente por friendlyDatabaseName em reportLabels.ts. Teste cobre capitalização, destino ausente e banco desconhecido. Capturas de Conexões na matriz. |
| D4 | Revisão da definição pendente. | “Abra o editor, confira as colunas e marque como revisado”. A lista de pendências continua expansível. |
| 5 | Aba Componentes 0. | O contador só aparece quando positivo. A aba continua disponível para adicionar o primeiro componente. Verificação nos oito pares da matriz. |
| 6 | Foco anterior na prancha mantinha a captura mesmo com ponteiro no cabeçalho. | Depois que o ponteiro se move, sua posição prevalece sobre o foco anterior. Teste unitário e Chromium verificam Ctrl+, Ctrl− e Ctrl+0 com foco ainda na prancha e ponteiro em três alturas do cabeçalho, inclusive entre suas linhas; fora da prancha não há preventDefault. Na prancha os três atalhos continuam funcionando. |
| D5 | Sem waterfall completo; uma chamada duplicada à lista e fontes locais sem cache/compressão. | HAR/CDP antes/depois, cache desativado, Chromium no próprio servidor. Removida a segunda carga de relatórios causada pela reinicialização de filtros já vazios. Fontes TTF com hash recebem MIME font/ttf, gzip e cache de um ano/immutable no nginx de staging e produção. Assets JS/CSS já tinham gzip/cache e foram preservados. Medições completas abaixo. |

## Verificações

- scripts/canvas-check.sh: hooks, tipos, 597 testes em 63 arquivos e build aprovados. Log em canvas-task31h-evidencias/frontend-check.log.
- Backend: suíte completa com --nomigrations em PostgreSQL descartável orbita-31h-test-db, credenciais/chaves sintéticas e diretório de arquivos montado somente para leitura: 1.012 aprovados e um ignorado. O teste de vocabulário novo foi executado separadamente e passou (um teste); ele foi adicionado após a coleta inicial da suíte. Primeira tentativa: 1.011 aprovados, um ignorado e um erro por falta da montagem /report_files; repetição completa corrigiu essa configuração.
- Matriz: 80%, 100%, 125% e 150%, temas claro e escuro, oito casos aprovados. Capturas de lista, conexões e editor e matriz.json em canvas-task31h-evidencias/matriz/. Chromium lançado com --force-device-scale-factor e viewport proporcional. Essa técnica reproduz o espaço útil/escala; os atalhos são eventos canceláveis verificados por preventDefault, sem automatizar a interface de zoom do navegador.
- Staging reconstruído de frontend limpo no worktree da tarefa, com API_UPSTREAM=orbita-canvas-task26-api:8000. Container da API reiniciado após a integração. nginx -t aprovado.
- Bundle index-BFRcd5FR.js obtido por curl com HTTP 200. SHA-256 da resposta descomprimida e do arquivo dentro do container: cc76b4e62bd423a47d53d8d1c1676b309db1a4091e1bbfa5b20f859582b557a7.
- curl confirmou font/ttf, Content-Encoding:gzip, Cache-Control:max-age=31536000 e public,immutable nas fontes com hash. A configuração de produção foi alterada no repositório; somente o staging foi reconstruído.

## Primeira carga: método e limites

Cada página usa contexto novo, cache HTTP desligado por CDP e navegação direta a 127.0.0.1:8091 no servidor, sem túnel. Tempo até a tabela/prancha aparecer; observação por mais quatro segundos para incluir requisições tardias. Bytes são encodedDataLength do CDP, incluindo cabeçalhos quando informados; não são a estimativa gzip do build. HARs omitem conteúdo e tiveram cookies/cabeçalhos removidos. Traces brutos não foram commitados; os HARs sanitizados preservam o waterfall.

A lista emite também uma URL data: embutida (zero bytes de rede), incluída no total de eventos do navegador. A tabela distingue a contagem de rede. Valores pontuais variam com carga do servidor; não demonstram a causa dos mais de 25 segundos observados pelo túnel. A carga local não reproduziu esse atraso. Uma coleta intermediária durante os testes também foi preservada, sem ser usada como comparação final.

| Página | Eventos antes → depois | Requisições de rede antes → depois | Bytes antes → depois | Tempo até aparecer antes → depois |
| --- | --- | --- | --- | --- |
| lista | 21 → 20 | 20 → 19 | 3,806,268 → 3,661,427 | 985 → 1481 ms |
| editor | 19 → 19 | 19 → 19 | 1,866,536 → 1,725,852 | 2003 → 1722 ms |

### Diagnóstico

A cadeia inicial é documento/assets → obtenção de sessão → conteúdo autorizado. No editor, a página carrega seu módulo e inicia em paralelo o chunk do editor, os dados do relatório e os dados do modelo. Na lista, fontes auxiliares/conexões/inventário e relatórios sobrepõem seus tempos; a chamada idêntica de relatórios desapareceu. Os arquivos abaixo registram todos os inícios e fins, sem inferir dependência só pela ordem.

Não apareceram fontes externas ou polling na janela observada. As fontes locais usam font-display:swap. Os preloads encontrados são chunks do Vite que a página utiliza; não foi removido preload necessário. O maior volume continua sendo a marca: brand-envelope.png transfere aproximadamente 1,19 MB por requisição e brand-wordmark.png aproximadamente 854 kB na lista. O envelope também é usado como favicon e foi transferido duas vezes na lista com cache desligado. Esses arquivos pertencem à tarefa paralela de ícones e não foram alterados aqui. A resposta de sessão transfere aproximadamente 60 kB. Portanto, os 170 kB gzip do JS principal não representam o custo completo da página.

O cache longo ajuda visitas com cache habilitado; sua presença foi verificada pelos cabeçalhos, mas não explica redução no ensaio com cache desligado. Nesse ensaio, a redução de bytes vem principalmente da compressão das fontes; a redução de chamadas vem da inicialização estável dos filtros. O relato de 25 s no túnel continua sem causa comprovada: faltaria medir aquele mesmo caminho/túnel para atribuir o atraso a ele.

### Todas as requisições

“Paralelo” significa que outra requisição listada ainda estava em andamento no instante do início. “Sem sobreposição anterior” descreve a linha do tempo, sem afirmar dependência causal. Início e duração em milissegundos a partir da primeira requisição de cada navegação. HAR e waterfall.json conservam os dados por requisição.

#### Antes: lista

| # | Requisição | Início ms | Duração ms | Bytes | HTTP | Sobreposição | Compressão |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | /relatorios?unit=ame | 0 | 8 | 1017 | 200 | Sem sobreposição anterior | gzip |
| 2 | /fonts/canvas-fonts.css | 20 | 7 | 749 | 200 | Sem sobreposição anterior | gzip |
| 3 | /assets/index-S5izCFgP.js | 21 | 54 | 170215 | 200 | Paralelo a 2 | gzip |
| 4 | /assets/index-pXHMkmFH.js | 21 | 61 | 4909 | 200 | Paralelo a 2, 3 | gzip |
| 5 | /assets/index-CTj_uPxB.css | 21 | 18 | 36209 | 200 | Paralelo a 2, 3, 4 | gzip |
| 6 | /brand-envelope.png?v=fe94463a5107 | 226 | 31 | 1188280 | 200 | Sem sobreposição anterior | — |
| 7 | /api/v1/auth/csrf/ | 268 | 24 | 587 | 200 | Sem sobreposição anterior | — |
| 8 | /fonts/0569c822cab6c510.ttf | 271 | 12 | 48599 | 200 | Paralelo a 7 | — |
| 9 | /api/v1/auth/session/ | 367 | 42 | 60118 | 200 | Sem sobreposição anterior | gzip |
| 10 | /brand-envelope.png?v=fe94463a5107 | 487 | 32 | 1188280 | 200 | Sem sobreposição anterior | — |
| 11 | /api/v1/report-app-connections/?unit=ame&page=1 | 497 | 37 | 436 | 200 | Paralelo a 10 | — |
| 12 | /api/v1/reports/?unit=ame&page=1&section=reports | 499 | 129 | 4332 | 200 | Paralelo a 10, 11 | gzip |
| 13 | /api/v1/report-connections/?unit=ame&page=1 | 500 | 152 | 1127 | 200 | Paralelo a 10, 11, 12 | — |
| 14 | /api/v1/reports/inventory/?unit=ame | 500 | 189 | 538 | 200 | Paralelo a 10, 11, 12, 13 | — |
| 15 | /api/v1/reports/?unit=ame&page=1&section=reports | 513 | 261 | 4332 | 200 | Paralelo a 10, 11, 12, 13, 14 | gzip |
| 16 | /brand-wordmark.png?v=f6992461fbe9 | 514 | 48 | 854287 | 200 | Paralelo a 10, 11, 12, 13, 14, 15 | — |
| 17 | data:[embedded] | 515 | 1 | 0 | 200 | Paralelo a 10, 11, 12, 13, 14, 15, 16 | — |
| 18 | /fonts/8257aa2626c379cb.ttf | 540 | 14 | 48519 | 200 | Paralelo a 12, 13, 14, 15, 16 | — |
| 19 | /fonts/18e69125ce1f964e.ttf | 540 | 26 | 48599 | 200 | Paralelo a 12, 13, 14, 15, 16, 18 | — |
| 20 | /fonts/9bd8ba39c9d55e06.ttf | 540 | 34 | 48627 | 200 | Paralelo a 12, 13, 14, 15, 16, 18, 19 | — |
| 21 | /fonts/b75124b8043e650f.ttf | 541 | 37 | 96508 | 200 | Paralelo a 12, 13, 14, 15, 16, 18, 19, 20 | — |

#### Antes: editor

| # | Requisição | Início ms | Duração ms | Bytes | HTTP | Sobreposição | Compressão |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | /relatorios/1/canvas?unit=ame | 0 | 8 | 1017 | 200 | Sem sobreposição anterior | gzip |
| 2 | /fonts/canvas-fonts.css | 16 | 15 | 749 | 200 | Sem sobreposição anterior | gzip |
| 3 | /assets/index-S5izCFgP.js | 21 | 70 | 170215 | 200 | Paralelo a 2 | gzip |
| 4 | /assets/index-pXHMkmFH.js | 22 | 32 | 4909 | 200 | Paralelo a 2, 3 | gzip |
| 5 | /assets/index-CTj_uPxB.css | 22 | 41 | 36209 | 200 | Paralelo a 2, 3, 4 | gzip |
| 6 | /brand-envelope.png?v=fe94463a5107 | 371 | 50 | 1188280 | 200 | Sem sobreposição anterior | — |
| 7 | /fonts/0569c822cab6c510.ttf | 375 | 33 | 48599 | 200 | Paralelo a 6 | — |
| 8 | /api/v1/auth/csrf/ | 461 | 18 | 587 | 200 | Sem sobreposição anterior | — |
| 9 | /api/v1/auth/session/ | 600 | 53 | 60126 | 200 | Sem sobreposição anterior | gzip |
| 10 | /assets/ReportCanvasPage-oa27QxiT.js | 669 | 18 | 2744 | 200 | Sem sobreposição anterior | gzip |
| 11 | /assets/ReportCanvasPage-zk2t_boC.css | 672 | 17 | 5859 | 200 | Paralelo a 10 | gzip |
| 12 | /assets/ReportCanvas-FuHHKVc5.js | 986 | 87 | 89456 | 200 | Sem sobreposição anterior | gzip |
| 13 | /assets/ReportCanvas-DQDtmDqG.css | 993 | 78 | 11714 | 200 | Paralelo a 12 | gzip |
| 14 | /api/v1/reports/1/?unit=ame | 994 | 183 | 2456 | 200 | Paralelo a 12, 13 | gzip |
| 15 | /api/v1/reports/1/canvas/?unit=ame | 1001 | 246 | 1203 | 200 | Paralelo a 12, 13, 14 | gzip |
| 16 | /fonts/9bd8ba39c9d55e06.ttf | 1575 | 18 | 48627 | 200 | Sem sobreposição anterior | — |
| 17 | /fonts/beeb7fd59d9b2c10.ttf | 1575 | 23 | 96668 | 200 | Paralelo a 16 | — |
| 18 | /fonts/18e69125ce1f964e.ttf | 1575 | 19 | 48599 | 200 | Paralelo a 16, 17 | — |
| 19 | /fonts/8257aa2626c379cb.ttf | 1683 | 9 | 48519 | 200 | Sem sobreposição anterior | — |

#### Depois: lista

| # | Requisição | Início ms | Duração ms | Bytes | HTTP | Sobreposição | Compressão |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | /relatorios?unit=ame | 0 | 7 | 1014 | 200 | Sem sobreposição anterior | gzip |
| 2 | /fonts/canvas-fonts.css | 18 | 18 | 749 | 200 | Sem sobreposição anterior | gzip |
| 3 | /assets/index-BFRcd5FR.js | 20 | 73 | 170316 | 200 | Paralelo a 2 | gzip |
| 4 | /assets/index-pXHMkmFH.js | 20 | 26 | 4909 | 200 | Paralelo a 2, 3 | gzip |
| 5 | /assets/index-C488Cqty.css | 21 | 35 | 36225 | 200 | Paralelo a 2, 3, 4 | gzip |
| 6 | /brand-envelope.png?v=fe94463a5107 | 259 | 32 | 1188280 | 200 | Sem sobreposição anterior | — |
| 7 | /fonts/0569c822cab6c510.ttf | 262 | 23 | 26808 | 200 | Paralelo a 6 | gzip |
| 8 | /api/v1/auth/csrf/ | 292 | 76 | 587 | 200 | Sem sobreposição anterior | — |
| 9 | /api/v1/auth/session/ | 379 | 62 | 60118 | 200 | Sem sobreposição anterior | gzip |
| 10 | /brand-envelope.png?v=fe94463a5107 | 536 | 111 | 1188280 | 200 | Sem sobreposição anterior | — |
| 11 | /api/v1/report-app-connections/?unit=ame&page=1 | 546 | 48 | 436 | 200 | Paralelo a 10 | — |
| 12 | /api/v1/reports/?unit=ame&page=1&section=reports | 548 | 530 | 4352 | 200 | Paralelo a 10, 11 | gzip |
| 13 | /api/v1/report-connections/?unit=ame&page=1 | 550 | 552 | 1127 | 200 | Paralelo a 10, 11, 12 | — |
| 14 | /api/v1/reports/inventory/?unit=ame | 551 | 593 | 538 | 200 | Paralelo a 10, 11, 12, 13 | — |
| 15 | /brand-wordmark.png?v=f6992461fbe9 | 562 | 96 | 854287 | 200 | Paralelo a 10, 11, 12, 13, 14 | — |
| 16 | data:[embedded] | 563 | 1 | 0 | 200 | Paralelo a 10, 11, 12, 13, 14, 15 | — |
| 17 | /fonts/8257aa2626c379cb.ttf | 576 | 52 | 26996 | 200 | Paralelo a 10, 11, 12, 13, 14, 15 | gzip |
| 18 | /fonts/18e69125ce1f964e.ttf | 576 | 83 | 26684 | 200 | Paralelo a 10, 11, 12, 13, 14, 15, 17 | gzip |
| 19 | /fonts/9bd8ba39c9d55e06.ttf | 577 | 93 | 27180 | 200 | Paralelo a 10, 11, 12, 13, 14, 15, 17, 18 | gzip |
| 20 | /fonts/b75124b8043e650f.ttf | 577 | 105 | 42541 | 200 | Paralelo a 10, 11, 12, 13, 14, 15, 17, 18, 19 | gzip |

#### Depois: editor

| # | Requisição | Início ms | Duração ms | Bytes | HTTP | Sobreposição | Compressão |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | /relatorios/1/canvas?unit=ame | 0 | 13 | 1014 | 200 | Sem sobreposição anterior | gzip |
| 2 | /fonts/canvas-fonts.css | 24 | 11 | 749 | 200 | Sem sobreposição anterior | gzip |
| 3 | /assets/index-BFRcd5FR.js | 24 | 63 | 170316 | 200 | Paralelo a 2 | gzip |
| 4 | /assets/index-pXHMkmFH.js | 24 | 63 | 4909 | 200 | Paralelo a 2, 3 | gzip |
| 5 | /assets/index-C488Cqty.css | 26 | 26 | 36225 | 200 | Paralelo a 2, 3, 4 | gzip |
| 6 | /brand-envelope.png?v=fe94463a5107 | 227 | 17 | 1188280 | 200 | Sem sobreposição anterior | — |
| 7 | /fonts/0569c822cab6c510.ttf | 251 | 9 | 26808 | 200 | Sem sobreposição anterior | gzip |
| 8 | /api/v1/auth/csrf/ | 264 | 16 | 587 | 200 | Sem sobreposição anterior | — |
| 9 | /api/v1/auth/session/ | 306 | 35 | 60126 | 200 | Sem sobreposição anterior | gzip |
| 10 | /assets/ReportCanvasPage-BpzU7cMb.js | 351 | 13 | 2748 | 200 | Sem sobreposição anterior | gzip |
| 11 | /assets/ReportCanvasPage-zk2t_boC.css | 353 | 13 | 5859 | 200 | Paralelo a 10 | gzip |
| 12 | /assets/ReportCanvas-DN-2E6rh.js | 661 | 24 | 89474 | 200 | Sem sobreposição anterior | gzip |
| 13 | /assets/ReportCanvas-DQDtmDqG.css | 662 | 30 | 11714 | 200 | Paralelo a 12 | gzip |
| 14 | /api/v1/reports/1/?unit=ame | 663 | 82 | 2456 | 200 | Paralelo a 12, 13 | gzip |
| 15 | /api/v1/reports/1/canvas/?unit=ame | 663 | 305 | 1203 | 200 | Paralelo a 12, 13, 14 | gzip |
| 16 | /fonts/9bd8ba39c9d55e06.ttf | 1279 | 13 | 27180 | 200 | Sem sobreposição anterior | gzip |
| 17 | /fonts/beeb7fd59d9b2c10.ttf | 1281 | 16 | 42524 | 200 | Paralelo a 16 | gzip |
| 18 | /fonts/18e69125ce1f964e.ttf | 1282 | 20 | 26684 | 200 | Paralelo a 16, 17 | gzip |
| 19 | /fonts/8257aa2626c379cb.ttf | 1420 | 10 | 26996 | 200 | Sem sobreposição anterior | gzip |

## Matriz de zoom e temas

| Zoom | Tema | Resultado |
| --- | --- | --- |
| 80% | light | Aprovado; 18 verificações |
| 80% | dark | Aprovado; 18 verificações |
| 100% | light | Aprovado; 18 verificações |
| 100% | dark | Aprovado; 18 verificações |
| 125% | light | Aprovado; 18 verificações |
| 125% | dark | Aprovado; 18 verificações |
| 150% | light | Aprovado; 18 verificações |
| 150% | dark | Aprovado; 18 verificações |
