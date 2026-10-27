# Canvas — Tarefa 11 (27/10/2026)

## Mudança

A prévia interrompia a consulta quando start e end não tinham defaults. Além disso,
o pedido só convertia valores vinculados, deixando parâmetros comuns sem resolução.
Agora os parâmetros da consulta recebem os valores declarados na fonte/relatório;
datas sem default usam hoje menos 30 dias e hoje, e unidade usa a unidade da tela.
Ano/mês conhecidos usam a data atual; filtros opcionais podem ficar vazios. Filtros
obrigatórios sem padrão seguro continuam identificados para preenchimento.

Os valores são temporários: não alteram o layout, a versão nem a configuração salva.
O selo e a aba Dados mostram período assumido e quantidade. “Alterar período / filtros”
abre campos recolhidos; resultado vazio oferece 90 dias. Tabelas mostram até 50 linhas
em uma área com rolagem dentro do bloco. O botão de altura recebeu espaçamento próprio
dentro do inspetor.

## Validação

- scripts/canvas-check.sh: typecheck, 32 arquivos / 440 testes e build passaram.
  O aviso conhecido de chunks maiores que 500 kB permanece.
- Pytest: todos os seis arquivos de testes Canvas, 126 testes passaram. Execução
  exclusiva do serviço tests, em orbita_suite, sem outro container tests ativo.
- View real CatalogViewSet.canvas_source_preview, chamada por Python dentro de
  orbita-api-1, com usuário administrativo existente e unidade ame:
  start=2026-09-27, end=2026-10-27, HTTP 200, 50 de 1.258 linhas, 0,881 s.
  Nenhuma credencial foi alterada e nenhum relatório foi salvo.
- scripts/canvas-task11-qa.cjs: Playwright em container contra o staging real 8091,
  com sessão existente; relatórios 6 e 3, 50 linhas reais, selo, campos recolhidos,
  rolagem, contenção, posição do botão de altura, período no inspetor e claro/escuro.
  GETs e POSTs de canvas-source-preview são permitidos; outras gravações bloqueadas.
- scripts/canvas-task11-fixtures-qa.cjs: autenticação e dados sintéticos para
  fonte compartilhada, defaults de data/unidade/ano, KPI, barras, linha, pizza,
  erros 400/403/404 e recuperação, vazio e ampliação para 90 dias. Não comprova
  dados reais nos gráficos: os relatórios reais usados possuem tabela.
- Logs e capturas ficam em artifacts/task11/ (ignorado pelo Git, diretório protegido).
  Capturas reais contêm dados da aplicação e não devem ser publicadas.

## Lista e lentidão

Na reprodução autenticada, a lista respondeu HTTP 200 em aproximadamente 0,2 s
(primeira página), e as requisições adicionais de catálogo em até 1,2 s. Os editores
6, 3, 2, 8 e 9 abriram em 1,0–1,6 s. Não foi reproduzida a espera superior a 15 s
do QA2; a causa histórica continua indeterminada. Não há evidência de regressão do
Canvas nessa lista, cujo carregamento é independente; ela não foi alterada.

Houve espera de I/O e demora na finalização de containers Docker durante os builds.
O helper de staging concluiu, inclusive na execução final normal. Não houve reinício
do Docker nem alteração dos serviços de produção.

## Escopo

Somente /opt/orbita no scv59, branch feature/canvas-redesign. Staging atualizado
somente por scripts/canvas-stage.sh up em 127.0.0.1:8091. Sem migrations, mudanças
de backend, push ou implantação na porta 8080. Login customizado preservado.
