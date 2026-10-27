# Tarefa 13 — fontes de dados e proteção do Canvas

Trabalho feito por SSH no Orbita, em `/opt/orbita`, branch
`feature/canvas-redesign`, partindo de `262b9ed` (tarefa 12 já commitada).
A árvore estava limpa. Sem push, migrate, atualização da API/produção 8080,
alteração do login customizado ou alteração do commit `4d039ac`.

## Causa e reprodução antes da correção

`SourceDialog` continuava montado quando fechado. Nesse estado retornava
`null` antes de cinco `useMemo`. Ao abrir pelo lápis ou por Adicionar fonte,
passava a executar esses hooks, mudando a ordem em relação ao render anterior.
O teste novo renderiza o `ReportCanvas` real com uma resposta de API simulada,
abre Dados e clica em `Editar fonte dados`. Antes da correção, falhou com
`Rendered more hooks than during the previous render`, apontando SourceDialog.
Evidência fora do Git: `artifacts/task13/before.log`.

A varredura de todos os componentes e hooks do Canvas com
`react-hooks/rules-of-hooks` encontrou mais duas violações em `DataDrawer`,
a gaveta Ver dados. Total antes: sete violações em dois componentes.
Todos esses hooks agora executam antes dos retornos condicionais; os cálculos
aceitam o estado fechado. Não foi usado remount por chave para esconder o bug.
A varredura passou e faz parte de `scripts/canvas-check.sh`, com configuração
restrita ao Canvas em `frontend/eslint.canvas.config.mjs`.

## Recuperação e edição de fonte

O Error Boundary da interface fica abaixo do store e da sessão do editor.
Uma falha em um painel/bloco/modal mostra a mensagem
“Algo deu errado nesta tela. Seus dados não foram perdidos.”, registra o erro
no console e oferece Tentar de novo e Voltar à lista. Tentar de novo mantém
o estado do Canvas e do formulário de fonte na sessão; sair exige confirmação
quando há rascunho ou formulário aberto. O aviso de saída do navegador do
editor continua ativo. Uma segunda proteção envolve o carregamento/editor
inteiro na rota e avisa, com confirmação, antes de reabrir ou voltar à lista,
pois nesse caso extremo o estado interno pode precisar ser remontado.

O modal mostra o nome, o relatório de origem e as colunas do catálogo/dataset.
A tabela manual mantém a grade de colunas. A prévia permite consultar os dados
retornados quando necessário. Confirmar fonte aplica ao rascunho local;
Cancelar descarta a edição do modal. O texto deixa claro que gravar o relatório
exige salvar o Canvas em uma ação separada.

## Testes automatizados

- `scripts/canvas-check.sh`: verde, incluindo regra de hooks, TypeScript,
  460 testes Vitest e build. Log: `artifacts/task13/check-final.log`.
- Quatro testes novos com Vitest + Testing Library/jsdom: abrir/cancelar/reabrir
  editar e adicionar fonte, alternar tipos de fonte, fechar/abrir/carregar
  Ver dados, fallback em português, registro no console, recuperação preservando
  estado e confirmação ao sair/reiniciar. O teste da falha original foi
  executado antes da correção, sem o Error Boundary esconder o erro.
- Python: 67 testes passaram em banco de testes isolado:
  `docker compose run --rm --no-deps tests pytest -q -p no:cacheprovider tests/test_report_canvas.py tests/test_report_canvas_ports.py tests/test_canvas_preview_columns.py`.
  Nenhum container `orbita-tests-run` estava ativo antes de iniciar.
  Log: `artifacts/task13/pytest.log`.
- O build conserva o aviso de tamanho de chunk maior que 500 kB; não impede
  a validação e não faz parte da causa da tela em branco.

## Navegador e staging

Roteiro reproduzível: `scripts/canvas-task13-qa.cjs`, usando a imagem Playwright
já existente `orbita-canvas-stage-qa09-tools:latest`, rede host, script montado
em `/qa/task13.cjs`, evidências em `/evidence` e sessão em `/private/session.json`.
A sessão administrativa existente é reutilizada em arquivo privado temporário,
sem credencial no script, no relatório ou no Git.

O roteiro bloqueia TODOS os POST/PUT/PATCH/DELETE, inclusive a consulta de
prévia; confirmações de fonte/remoção e alterações de blocos ficam apenas no
rascunho do navegador. Não clica em Salvar. Compara a resposta GET da
configuração persistida antes e depois de cada relatório. Captura pageerror e
console.error, separando os erros de rede esperados pelo bloqueio de prévias.
Após o editor carregar, um MutationObserver e verificações após cada ação
impedem que body vazio ou o fallback passem despercebidos.

Cobertura executada nos relatórios 6, 8 e 9: lápis após hover; alteração do nome
e Cancelar; Adicionar fonte e alternar relatório/tabela manual/metas;
Ver dados e fechar; Atualizar prévia; cancelar remoção da fonte original;
confirmar adição/remoção de fonte temporária; adicionar Texto/Tabela/KPI/Barras/
Linhas/Pizza/Imagem; Conteúdo/Aparência/Dados; abrir Ações do bloco, duplicar,
alterar ordem e excluir; trocar tipo de gráfico; selecionar/desselecionar.
A aba Dados de Imagem é desabilitada por projeto, com explicação de que imagens
não usam fonte: o roteiro valida esse estado, sem forçar um clique inválido.

Resultado final (27/10/2026): **270 verificações passaram** nos três
relatórios. Zero pageerror, zero body vazio durante as interações, zero
acionamento do Error Boundary e zero escrita real. Os seis console.error
capturados são exclusivamente `net::ERR_BLOCKED_BY_CLIENT` das seis consultas
POST de prévia deliberadamente abortadas. Nenhum outro console.error apareceu.
As três respostas GET de configuração persistida permaneceram idênticas antes
e depois dos testes, inclusive versão e layout.

Staging reconstruído exclusivamente com `scripts/canvas-stage.sh up`;
container `orbita-canvas-stage`, imagem `0aed6d3dc735`, publicado somente em
`127.0.0.1:8091`. HTTP 200 nas rotas de Canvas dos relatórios 6, 8 e 9.
Log do build: `artifacts/task13/stage-final.log`. Log completo do navegador:
`artifacts/task13/browser-final.log`; resumo: `browser-summary.json` no mesmo
diretório. Capturas: `task13-report-6.png`, `task13-report-8.png` e
`task13-report-9.png`, fora do Git. A sessão privada temporária usada pelo QA
foi removida ao concluir a validação.

## Pendências e limites

A produção não foi implantada. As prévias POST reais são bloqueadas neste QA;
retorno de dados é coberto pelos testes existentes e pela tarefa 12. O roteiro
desta tarefa se concentra nas transições da interface sem gravação real.
