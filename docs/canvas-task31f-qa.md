# QA 31f — revisão A a K

Integração inicial: `f23bfcd93f5bc13b73da6916680b1075b4451360`, com rebase sobre a 31e. A revisão e as medições foram feitas no servidor; o staging 8091 compartilha o banco real e nele foram feitos somente GETs. A matriz de navegação e geração de PDF usa a porta 8097 e PostgreSQL descartável. Não houve exclusão real nem aplicação da migração 0031 no banco real.

| Item | Antes | Depois e evidência |
| --- | --- | --- |
| A | Quatro URLs retornavam 503 na revisão. | API reiniciada após integração; os quatro GETs exatos com `unit=ame`, inclusive `removidos=1&page=1`, retornaram 200 autenticados. Indicadores e agendamentos também 200. Testes de compatibilidade cobrem parâmetros e disponibilidade. |
| B | Menu não fechava em toda a tela e faltavam papéis acessíveis. | Fecha por clique fora ou Esc, retorna o foco e expõe os papéis. Exercitado na matriz do editor. |
| C | Estados e banco apareciam com valores crus. | Estados e nomes legíveis em listas, prévia e exportações; teste de formatação. |
| D | Telefones sem máscara; responsável vazio. | Máscara nas telas e exportações. A investigação anterior encontrou zero responsáveis atribuídos em 2.352 casos AME nos últimos 30 dias; o traço representava dado vazio. |
| E | Pelo túnel: listas até 4,5 s, dependências até 2,2 s e editor 5,1 s. | Sem túnel e sem cache, cinco amostras no servidor: relatórios 383–1.116 ms; conexões 151–222 ms; dependências de relatório 101–154 ms e de conexão 96–127 ms; editor 939–1.044 ms. Antes da 31d, na mesma metodologia: 471–1.187, 292–402, 112–161, 54–118 e 926–970 ms, respectivamente. Todas abaixo das metas. |
| F | Delete em relatório ativo não explicava o bloqueio. | Aviso visível e teste de teclado na matriz. |
| G | Período padrão não era explicado. | O diálogo mostra o período efetivo com “Padrão”. |
| H | Botão JSON e mensagem duplicada; vínculos vazios pouco claros. | “Código do relatório”; mensagem única e texto para ausência de vínculos, com agendamento quando presente. |
| I | Filtros e ações cortados a 150%; editor não conferido. | Filtros e ações responsivos; cabeçalho do editor passa a duas linhas em largura reduzida. Matriz nos espaços equivalentes a 80, 100, 125 e 150%, nos dois temas, com lista, editor, prévia e diálogos. O script ajusta viewport e escala de dispositivo; não altera o controle de zoom do navegador. |
| J | Datas americanas; contador e pendências pouco claros. | Datas explícitas em português; explicação dos contadores e pendências. |
| K | Parâmetro inexistente e muitas colunas não tinham cobertura manual. | Validação amigável antes de enviar a prévia; matriz com parâmetro inexistente e relatório de 24 colunas, incluindo PDF e editor. |

GETs diretos após integração: relatórios 61–117 ms, conexões 26–32 ms, dependências 40–47 e 28–32 ms, configuração Canvas 41–50 ms (três amostras). Na primeira chamada fria de dependências, 676 ms. As medições de navegador incluem renderização e usam Chromium no servidor; a comparação com o túnel da revisão não é direta.

Verificações: `canvas-check.sh` com 593 testes, hooks, tipos e build; backend com PostgreSQL descartável e `--nomigrations`: 1.012 aprovados e um ignorado. A primeira execução do backend falhou por chaves sintéticas ausentes e flag de remoção desabilitada no container de teste; repetida com chaves temporárias e a flag habilitada apenas no teste. Bundle servido em 8091 por HTTP 200 após reinício da API. Os prints `t31f-*` e a matriz JSON ficam em `docs/canvas-task31f-evidencias/`.
