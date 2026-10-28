# Tarefa 18 — abertura do Canvas

28/10/2026. Trabalho somente por `ssh scv59`, em `/opt/orbita`, branch `feature/canvas-redesign`. Leitura prévia de `AGENTS.md` e `docs/canvas-task17-qa.md`. Sem push, gravação de relatório ou reinício de painel/API de produção.

## Causa medida

O JS principal não explica sozinho a oscilação: transfere aproximadamente 166 kB com gzip e terminou em cerca de 1 s no comparativo. Antes da autenticação havia duas dependências de fonte externa: um stylesheet no HTML e outro por `@import` no CSS principal. O segundo só começava após baixar o CSS local. Ambos podiam bloquear a primeira pintura e a execução do módulo que inicia CSRF/sessão.

Na primeira execução diagnóstica (`before-wan.json`/`.log`, imagem de staging anterior à recompilação), 323 levou **29000 ms**, com primeira pintura em **22860 ms**. Uma chamada de CSS de fontes levou **18282 ms**; o JS principal levou apenas **873 ms** e CSRF só começou em **20372 ms**. O 326 levou 7105/4810 ms. A navegação de 6 estourou 30 s aguardando DOMContentLoaded; foi repetida com timeout de navegação de 90 s (`before-six.json`), resultando em 4793/1558 ms. Não se trata de timeout do endpoint de canvas.

A imagem de marca de 1187972 bytes também concorreu pela banda no diagnóstico (7834 ms). Não foi modificada: a meta foi atingida dentro do escopo inicial. A fonte pode continuar baixando depois da abertura; preservamos suas famílias, pesos e `display=swap`.

As APIs já faziam detalhe e canvas em paralelo, e os gráficos já eram tardios desde a tarefa 17. Não houve chamadas a fontes reais ou a `canvas-source-preview` na abertura. CSRF → sessão continua sequencial e a autorização continua anterior às leituras do relatório.

O outro custo comprovado era a transferência de JSON sem gzip: sessão com 117659 bytes, canvas de 323/326 com cerca de 70 kB. Na rede local, as leituras de 323/326 ficaram entre 381 e 782 ms no perfil repetido; sessão 35–48 ms, relatório 6 43–62 ms. `api-local.json` contém cada chamada, sem conteúdo privado. Não há evidência para adicionar cache privado no backend.

## Alterações

- Plugin de build no Vite converte a folha externa de fontes em preload com aplicação no `onload`. Retira o `@import` externo do CSS emitido e solicita a mesma URL também pelo HTML, sem bloquear a aplicação. Os arquivos do login, HTML fonte e CSS fonte não foram editados.
- Nginx normal e template de staging passam a comprimir `application/json`, mantendo `Vary: Accept-Encoding`. Nenhum cache de API foi adicionado; gzip/cache immutable de assets e carregamento tardio de gráficos da tarefa 17 foram preservados.
- Novo teste de navegador em `frontend/src/components/report-canvas/task18-loading.cjs`: deixa o provedor de fontes sem responder, confirma editor/zoom utilizáveis, ausência de @import externo no CSS emitido, gzip dos JSONs, ausência de cache immutable na API e formulário/marca do login customizado.

## Comparação em staging 8091

Antes e depois foram reconstruídos com `scripts/canvas-stage.sh up`. O primeiro build capturou a árvore antes das mudanças de configuração desta tarefa. Imagens resultantes: antes `dd782f45a8ef`, depois `730d005b1e0d`. O backend/banco não foi reiniciado nem teve caches limpos. Há trabalho concorrente na árvore; os arquivos dessa sessão foram preservados e não entram neste commit.

Perfil da tarefa 17: Chromium/CDP, latência de 100 ms, download de 250000 bytes/s (2 Mbps), upload de 125000 bytes/s. Um contexto novo por relatório; segunda página no mesmo contexto, cache HTTP normal. Sem interceptação de requisições no comparativo. “Primeira” significa cache de navegador frio, não DNS externo nem workers/banco frios. O relógio inclui navegação, área de edição, controle Dados reais disponível e clique em Aumentar zoom.

| Relatório | Antes primeira (ms) | Antes segunda (ms) | Depois primeira (ms) | Depois segunda (ms) |
|---|---:|---:|---:|---:|
| 323/scv | 4478 | 2043 | 3609 | 1703 |
| 326/scv | 4675 | 2085 | 3559 | 2112 |
| 6/ame | 3687 | 1596 | 3590 | 1657 |

No comparativo, as fontes responderam rapidamente: os números típicos de antes já ficaram abaixo de 5 s. A redução de cauda é validada separadamente pelo teste que mantém a fonte pendente: **3387 ms** para editor e zoom, sem esperar resposta externa. Não afirmamos ter reproduzido exatamente os 11 s do 326 nem garantir um SLA em qualquer rede/servidor.

Cinco contextos novos adicionais de 326 (cada um seguido de segunda abertura), todos no mesmo perfil de rede:

| Repetição | Primeira (ms) | Segunda (ms) |
|---|---:|---:|
| 1 | 3717 | 2155 |
| 2 | 3677 | 1613 |
| 3 | 3693 | 2057 |
| 4 | 3643 | 2069 |
| 5 | 3580 | 2114 |

Nenhuma abertura repetiu a cauda de 11 s; máximo frio de 3717 ms e quente de 2155 ms. O roteiro falha acima de 6500 ms no frio ou 4000 ms na segunda.

## Tempos de todas as APIs na abertura

Valores em ms, **antes → depois**; duração de rede completa, incluindo concorrência pela banda, não apenas execução no Django.

| Relatório / abertura | CSRF | Sessão | Detalhe | Canvas |
|---|---:|---:|---:|---:|
| 323 / primeira | 121 → 117 | 1192 → 933 | 658 → 615 | 1233 → 441 |
| 323 / segunda | 109 → 112 | 574 → 454 | 638 → 372 | 668 → 330 |
| 326 / primeira | 112 → 114 | 1185 → 938 | 778 → 454 | 1240 → 554 |
| 326 / segunda | 110 → 111 | 577 → 448 | 517 → 421 | 672 → 534 |
| 6 / primeira | 112 → 111 | 1178 → 937 | 234 → 152 | 157 → 123 |
| 6 / segunda | 104 → 106 | 577 → 451 | 152 → 122 | 128 → 115 |

Bytes do corpo transferido (antes → depois): sessão 117659 → 86556; detalhe 323 15851 → 4091, 326 15400 → 3882, 6 6711 → 1989; canvas 323 70341 → 7744, 326 70339 → 7747, 6 2043 → 602. CSRF permanece com 80 bytes, abaixo do limiar de compressão. Nenhum campo da resposta foi removido.

## Chunks e primeira pintura

Primeira abertura de 323; todos os chunks/estilos locais efetivamente carregados no caminho do editor. Os JSONs brutos contêm os mesmos dados para 326, 6 e todas as segundas aberturas. Bytes são `encodedBodySize`; transferência inclui ainda cabeçalhos.

| Recurso | Bytes antes → depois | Início antes → depois (ms) | Duração antes → depois (ms) |
|---|---:|---:|---:|
| JS principal | 165792 → 165792 | 122 → 117 | 1008 → 961 |
| JS compartilhado | 4440 → 4440 | 123 → 117 | 173 → 163 |
| CSS principal | 40061 → 39964 | 123 → 118 | 473 → 462 |
| JS editor | 81493 → 81508 | 2582 → 2208 | 1086 → 868 |
| CSS editor | 10394 → 10394 | 2583 → 2209 | 234 → 237 |

Não houve download do runtime de gráficos nessa abertura. O aviso de bundle principal acima de 500 kB permanece (583,14 kB sem gzip); não foi ocultado. Não dividimos rotas fora do escopo: o diagnóstico apontou dependências externas bloqueantes e transferência das APIs.

| Relatório | Primeira pintura antes → depois (ms) | Conteúdo antes → depois (ms) | Área de edição antes → depois (ms) |
|---|---:|---:|---:|
| 323 | 740 → 596 | 1280 → 1176 | 4228 → 3192 |
| 326 | 716 → 592 | 1180 → 1168 | 4108 → 3158 |
| 6 | 764 → 596 | 1192 → 1188 | 3458 → 3151 |

Resource Timing lista recursos concluídos até o clique; uma imagem/fonte ainda em voo pode não aparecer nessa lista. Isso não é interpretado como zero bytes transferidos. A medição diagnóstica inicial e o teste com fonte pendente complementam o comparativo em que o provedor respondeu rápido.

## Verificação e reprodução

- `scripts/canvas-check.sh`: npm ci, hooks, TypeScript, **491 testes Vitest** e build passaram; saída 0 (`check.log`, `check.exit`).
- Verificação final após mudanças concorrentes: hooks, TypeScript, **493 testes Vitest** e build também passaram (`check-final.log`). O build final reflete mudanças posteriores de outra sessão nos blocos; as medições de navegador acima se referem à imagem de staging congelada `730d005b1e0d`.
- Teste novo de regressão passou: fonte pendente, gzip JSON e login customizado, zero erros JavaScript e zero requisições de escrita (`regression.log`).
- `scripts/canvas-task17-http.cjs` passou novamente: HTML 200, gzip e cache immutable nos assets, asset inexistente 404 e API sem cache immutable (`http.log`).
- `validate.exit` e `stress.exit`: 0. Todas as aberturas normais sem erros JS nem escritas.
- Pytest do backend não foi executado: havia container `orbita-tests-run-67d80b3d4e0f` ativo na inspeção inicial. Não houve mudanças de backend.
- Não editamos Login.tsx, reports.css, stage/geometry.ts, stage/pageOps.ts, blocks/ ou backend/operations/. Uma captura intermediária de preservação comparou 32 arquivos inicialmente modificados e manteve 29 diffs idênticos; api.py, canvasSampleData.test.ts e model.ts já haviam mudado por trabalho concorrente (`preservation.json`). A outra sessão continuou alterando e fazendo commits durante a QA. Nenhum desses arquivos entra neste commit.
- O Docker demorou na finalização/remoção de camadas; não foi reiniciado. O pré-build separado também produziu a mesma imagem final `730d005b1e0d`. Só o staging foi reconstruído/recriado.

Evidências sem conteúdo de relatório em `artifacts/task18/` (ignorado pelo Git). Os roteiros `timing.cjs`, `stress.cjs` e `validate.sh` ficaram junto delas. A sessão administrativa foi reutilizada em mount privado, sem imprimir credenciais nem criar usuário/login. A cópia privada da sessão, os cinco containers de QA e a tag temporária de pré-build foram removidos ao terminar; o staging validado permanece disponível.

Para repetir o comparativo, usar a imagem existente `orbita-canvas-stage-qa09-tools:latest`, rede host, `artifacts/task18` montado em `/evidence` e uma sessão existente em `/private/session.json:ro`; executar `THROTTLE=1 RESULT=<nome> node /evidence/timing.cjs`. Para a repetição de 326: `THROTTLE=1 ASSERT_BUDGET=1 RESULT=<nome> node /evidence/stress.cjs`.

Para a regressão, montar `frontend/src/components/report-canvas` em `/work:ro`, a sessão em `/private/session.json:ro` e executar `node /work/task18-loading.cjs` na mesma imagem/rede. O teste que mantém fontes pendentes usa interceptação em contexto separado; seus tempos não substituem o comparativo com cache normal.
