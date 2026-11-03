# Tarefa 17 — tempo de abertura do canvas

27/10/2026. Exclusivamente via `ssh scv59`, `/opt/orbita`, branch
`feature/canvas-redesign`. Sem push, migrate, implantação em 8080 ou alteração
do login customizado/commit `4d039ac`. Nenhum acesso ao SimplesVet.

## Diagnóstico

Playwright/Chromium no staging 8091, sessão administrativa existente em mount
privado. Relatórios 323/326 na unidade `scv`, 6/8 em `ame`. Apenas navegação,
leitura e zoom; nenhum relatório salvo. Evidências sem conteúdo dos relatórios
em `artifacts/task17/` (ignorado pelo Git).

A abertura de 25 s relatada não foi reproduzida na rede local do servidor:
323 abriu em 2292/1163 ms, 326 em 1240/1088 ms, 6 em 1237/1157 ms e 8 em
1309/1149 ms. O primeiro roteiro desativava o cache do navegador pela
interceptação de requisições; esses números são apenas referência local.

O perfil Django/SQL (`scripts/canvas-task17-profile.py`, `profile-before.jsonl`)
mostrou para 323/326: detalhe em 227–345 ms (12 consultas, SQL 102–127 ms),
canvas em 177–276 ms (7 consultas, SQL 100–132 ms). A sessão levou 12–34 ms,
3 consultas, resposta de 117659 bytes. A primeira chamada CSRF no processo de
perfil levou 465 ms, as seguintes 2 ms. Esse primeiro tempo inclui imports.

EXPLAIN ANALYZE: busca do relatório por PK usa Index Scan, 0,049 ms;
catálogo com 192 relatórios usa Bitmap Index Scan para unidade e ordenação,
1,497 ms. Não há evidência para criar um índice ou cache de dados privados.
Nenhuma alteração de banco foi feita.

O waterfall mostra CSRF → sessão → relatório/canvas/import do editor. Detalhe
e canvas já são paralelos. Não há chamada a `canvas-source-preview` nem
fonte externa na abertura; o modo inicial usa dados de exemplo. Consultar a
fonte real continua sendo uma ação posterior, sem bloquear o editor.

A causa reproduzida é a transferência de código/estilos sem compressão e o
runtime de gráficos no caminho crítico. Antes, os recursos somavam cerca de
1,6 MB de JS/CSS; somente o JS principal tinha 580385 bytes. O chunk do editor
baixava junto com charts (288768 bytes) e dependência compartilhada
(127116 bytes). Não havia política de cache persistente dos assets com hash.

Com CDP Network.emulateNetworkConditions (100 ms de latência, 250000 bytes/s
download, 125000 bytes/s upload), 323 demorou 10124 ms: principal até 3552 ms,
sessão até 4933 ms, editor/charts até aproximadamente 9619 ms. As respostas
HTTP concorrem pela banda; o canvas levou 2375 ms nesse cenário, apesar do
backend levar menos de 300 ms no perfil local.

## Correção

- gzip para JavaScript/CSS e cache de um ano/immutable somente em `/assets/`,
  cujos nomes têm hash, nos dois arquivos nginx usados pelo staging. API e
  HTML não recebem esse cache. Asset inexistente retorna 404.
- Runtime de gráficos em import dinâmico próprio. Tabelas, textos e controles
  não aguardam Recharts. O gráfico mostra `Carregando gráfico…` enquanto baixa.
  Paletas e agrupamento foram preservados; as paletas ficam em módulo leve.
- Mantido o esqueleto existente com mensagem visível durante a preparação do
  relatório/editor; sem substituir o login ou alterar autenticação.

## Medições comparáveis

Contexto Chromium novo por relatório (frio do navegador); segunda navegação
no mesmo contexto (cache normal, sem interceptação que o desative). Não foram
reiniciados workers/banco nem limpos caches do servidor. Portanto “frio” aqui
não comprova o primeiro acesso após reinício do backend. Mesma limitação de
rede acima. O roteiro final também clica em Aumentar zoom para comprovar que
os controles respondem e falha se ultrapassar 10 s no frio ou 5 s na segunda.

| Relatório | Antes frio (ms) | Antes segunda (ms) | Depois frio (ms) | Depois segunda (ms) |
|---|---:|---:|---:|---:|
| 323/scv | 10124 | 2609 | 4292 | 2036 |
| 326/scv | 10033 | 2029 | 4202 | 2251 |
| 6/ame | 9646 | 1515 | 3571 | 1589 |
| 8/ame | 9612 | 1514 | 3571 | 1546 |

Dados brutos: `before-wan.json`/`after-wan.json`; `resources` separa início,
duração, TTFB, bytes e transferência. Roteiro: `canvas-task17-timing.cjs`.
Os 25 s e uma primeira carga de worker novo permanecem sem reprodução.

## Verificações e preservação

- `scripts/canvas-check.sh`: hooks, TypeScript, **491 testes Vitest** e build verdes; execução final em `check-final.log`.
- Pytest dos seis arquivos do canvas: **144 passaram**, em banco de teste
  isolado; nenhum container `orbita-tests-run` rodando antes/depois. Container
  temporário `orbita-canvas-task17-tests` removido ao terminar.
- Novo teste Vitest: controles respondem enquanto o módulo de gráficos está
  pendente, com fallback local, e gráfico aparece ao concluir o carregamento.
- `canvas-task17-http.cjs`: passou; HTTP 200, `Content-Encoding: gzip`,
  `Cache-Control: max-age=31536000, public, immutable` nos assets, 404 em
  asset inexistente e sem cache immutable na API; evidência `http.json`.
- Staging reconstruído exclusivamente com `scripts/canvas-stage.sh up`,
  HTTP **200** na porta 8091. Imagem `384b8f685784` (`stage.log`).
- As oito aberturas finais passaram nos limites, sem erros JavaScript ou
  requisições de escrita. Em 323, frio caiu de 10,124 s para 4,292 s.
  JS principal transferido com gzip: aproximadamente 164 kB, antes 580 kB.
  Os chunks do runtime de gráficos saíram do caminho crítico do editor.
- O Docker demorou a finalizar build/remoção dos containers após a compilação;
  não houve reinício de daemon ou serviços para contornar isso.
- O aviso preexistente de chunk principal acima de 500 kB permanece no build.
  A transferência agora usa gzip. Não foi alterado o código do login.
- O diff dos arquivos rastreados que já estavam sujos foi comparado byte a
  byte com a captura inicial: preservado. Não houve stash ou revert. Arquivos
  não rastreados da outra sessão também não foram editados ou adicionados.
- Seleção interativa por arquivo/hunk antes do commit, revisão do staged e
  `git diff --cached --check`. Apenas os arquivos desta tarefa entram no commit.

Reprodução no Orbita (imagem `orbita-canvas-stage-qa09-tools:latest`, rede host):
montar `scripts` em `/work:ro`, sessão Playwright privada em
`/private/session.json:ro` e pasta de saída em `/evidence`.
`THROTTLE=1 ASSERT_BUDGET=1 RESULT=after-wan node /work/canvas-task17-timing.cjs`.
Não incluir a sessão no Git nem publicar seu conteúdo.
