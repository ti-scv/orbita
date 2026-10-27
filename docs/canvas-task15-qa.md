# Tarefa 15 — detalhes finais do Canvas

27/10/2026, somente via `ssh scv59`, em `/opt/orbita`, branch
`feature/canvas-redesign`, base `c8d6d84`. Sem push, migrate, alteração do login,
reescrita do commit `4d039ac` ou implantação em produção/8080.
O checkout `/home/danilo/vet-app` não foi acessado.
O `AGENTS.md` remoto foi lido; `docs/llm-instrucao-issue-correcao.md` não existe
neste repositório. Não houve acesso ao SimplesVet.

## Alterações e causas

1. O progresso “Carregando prévia…” herdava `cv-danger-bg`/`cv-danger` do
   cartão de erro. Agora usa uma classe de estado separada, com
   `cv-surface-3` e `cv-text-2`, inclusive dentro da folha branca.
   Erros de validação do bloco continuam com seu cartão de erro.
2. A gaveta consultava a fonte novamente, com os parâmetros brutos do layout;
   os blocos resolviam parâmetros e datas de outra maneira. As consultas
   independentes podiam devolver amostras e ordens diferentes. Agora a gaveta
   recebe o mesmo estado/resposta da fonte usado pelo palco, incluindo filtros
   resolvidos e atualizações. Não há ordenação adicional por padrão. A ordenação
   explícita pelas colunas continua disponível e é reiniciada ao trocar de fonte.
3. A configuração esperava o download/avaliação e montagem do editor antes de
   ser buscada. A rota agora inicia metadados, configuração e módulo em paralelo,
   passando a configuração inicial para a sessão. Recarregar ainda consulta o
   servidor. Para fontes que apontam ao próprio relatório, a prévia reutiliza
   o schema já carregado, eliminando outro GET em série. Nenhum cache persistente.
   O esqueleto agora contém mensagem visível e acessível, em vez de ter apenas
   um aria-label de carregamento.
4. Publicação explica que abre ativação/formato e que as alterações dependem
   de Salvar; há tooltip tanto na barra quanto no menu compacto. A lâmpada
   explica o próximo tema e, quando aplicável, o acompanhamento do dispositivo.
   O aria-label da lâmpada já informa o tema atual e o próximo.
5. Revisão dos botões nos componentes do Canvas: botões de ícone têm nome ou
   tooltip; ações com texto usam rótulos funcionais. O QA automatizado também
   verifica botões visíveis no palco, Publicação, gaveta, Adicionar, Estrutura e
   Imagens. Nenhum botão sem nome encontrado nesses estados.

## Medição — relatório 6

Três contextos Chromium novos por versão, sem cache de navegador, mesma URL
`http://127.0.0.1:8091/relatorios/6/canvas?unit=ame`. API existente, sem reinício
ou limpeza de caches do servidor. Tempos desde a navegação até o primeiro bloco,
e depois até a conclusão da prévia de dados reais:

| Medida em ms | Antes | Depois |
| --- | --- | --- |
| Editor | 1727 / 1321 / 1957 | 2045 / 1374 / 1423 |
| Dados reais | 2097 / 1948 / 2368 | 2637 / 1756 / 1814 |
| Mediana editor | 1727 | 1423 |
| Mediana dados reais | 2097 | 1814 |

A mediana caiu 17,6% no editor e 13,5% até os dados reais, mas os intervalos se
sobrepõem: não é garantia de latência. A primeira medição posterior coincidiu
com o término de uma checagem/build no host e foi mais lenta; foi mantida.
Os 15–20 s do QA5 não foram reproduzidos e sua causa integral permanece sem
comprovação. Estes números não medem uma rede externa nem worker recém-iniciado.

Separação rede/processamento:

- Antes, o GET do relatório levou 83–102 ms; o da configuração, 41–51 ms.
  A configuração só começava **351–369 ms após terminar o GET do relatório**:
  espera pelo carregamento/avaliação/montagem do editor, sem consulta de
  configuração em andamento nesse intervalo.
- Depois, ambos os GETs começam juntos (diferença de 0–1 ms). A fonte do próprio
  relatório deixa de repetir seu GET: seis requisições de API viraram cinco,
  contando CSRF, sessão e prévia. O login e sua inicialização não foram alterados.
- A consulta de dados reais levou 214–287 ms antes e 268–452 ms depois. Não
  apareceu uma consulta de 15 s; não há evidência para mudar o SQL neste escopo.
- Transferência de JavaScript: aproximadamente 1,29 MB nas duas versões; soma
  das durações individuais de downloads de JS: 128–195 ms antes e 104–186 ms
  depois (downloads paralelos, soma não representa tempo total). O ganho não é
  redução do bundle. Os tempos totais também incluem inicialização da aplicação,
  avaliação de JS e render; não são uma medição isolada de CPU React.

Dados brutos em `artifacts/task15/before.json` e `after.json`, no host.
Reprodução: `scripts/canvas-task15-timing.cjs`, imagem
`orbita-canvas-stage-qa09-tools:latest`, rede host, sessão existente em mount
privado `/private/session.json`, saída `/evidence`. Nenhum login novo ou dado de
relatório é persistido pelo roteiro de medição.

## Validação

- `scripts/canvas-check.sh`: hooks, TypeScript, 483 testes Vitest e build.
  Sete testes novos cobrem estados, resposta/ordem compartilhada sem nova
  consulta, esqueleto, paralelismo, GET redundante e ajudas dos controles.
- Pytest solicitado: **74 passaram**, em banco de testes isolado, após verificar
  que nenhum container `orbita-tests-run` estava rodando. Comando:
  `docker compose --profile test run --rm --no-deps tests pytest -q -p no:cacheprovider tests/test_report_canvas.py tests/test_report_canvas_ports.py tests/test_canvas_preview_columns.py`.
- `scripts/canvas-task15-qa.cjs`: relatórios 6 e 8, 1440×1000, tema escuro,
  consulta atrasada para observar o carregamento. Cor computada do fundo:
  `rgb(28, 33, 40)`; texto: `rgb(169, 182, 198)`. Ordem comparada linha a linha:
  **50 linhas no palco e na gaveta**, nos dois relatórios.
- Zero erros de JavaScript; nenhum salvamento tentado. Configurações GET
  antes/depois idênticas. O roteiro aborta qualquer escrita, permitindo somente
  POST de consulta `canvas-source-preview`.
- Quatro capturas e resumo `browser.json` em `artifacts/task15/`, ignorado pelo
  Git. As capturas contêm dados operacionais e ficam somente no Orbita.
- Staging reconstruído exclusivamente por `scripts/canvas-stage.sh up`,
  porta 8091, HTTP 200. Usa a API existente; backend de produção não foi alterado.
  O aviso preexistente de chunk acima de 500 kB permanece.

Houve correções nos próprios testes durante a validação. Um teste preexistente
exigia azul para os blocos novos da capa, incompatível com os padrões neutros da
árvore compartilhada. Sua expectativa agora usa `validColor(undefined)`, mantendo
comparação integral do JSON e preservação das cores já salvas. A implementação
de estilo da outra sessão não foi incluída neste trabalho.

## Árvore compartilhada

`git status --short` foi conferido antes de qualquer edição e novamente antes e
depois do commit. Os seguintes arquivos já estavam sujos e não foram editados,
revertidos, guardados em stash ou incluídos no commit desta tarefa:

- `backend/operations/bed_snapshots.py`
- `backend/operations/medical_layout.py`
- `backend/operations/report_canvas/pdf.py`
- `backend/operations/report_canvas/ports.py`
- `backend/operations/report_canvas/schema.py`
- `backend/operations/report_canvas/xlsx.py`
- `backend/operations/stock_loans.py`
- `frontend/src/components/report-canvas/blocks/BlockPreview.tsx`
- `frontend/src/components/report-canvas/inspector/fields/AppearanceFields.tsx`
- `frontend/src/components/report-canvas/model.ts`
- `frontend/src/components/report-canvas/stage.css`
- `frontend/src/components/report-canvas/stage/geometry.ts`
- `frontend/src/components/report-canvas/stage/pageOps.ts`
- `backend/tests/test_report_neutral_style.py` (não rastreado)

O staging e os testes usam a árvore compartilhada atual, incluindo as mudanças
não commitadas da agy. A seleção para o commit foi feita por caminhos explícitos,
somente dos arquivos desta tarefa. Nenhum arquivo da lista acima foi selecionado.
O commit local pode ser consultado com
`git log -1 --oneline -- docs/canvas-task15-qa.md`.
