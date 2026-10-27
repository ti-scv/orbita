# Tarefa 14 — acabamentos do Canvas após QA4

Executada em 27/10/2026, exclusivamente por SSH no Orbita, /opt/orbita,
branch feature/canvas-redesign, partindo de aac51cc, com árvore limpa.
Somente commit local. Sem push, migrate, alteração do login customizado,
reescrita dos commits 4d039ac/45e8b3f ou implantação em produção.
O checkout do servidor 82 não foi acessado.

## Correções

1. **Ver dados:** a gaveta estava no contexto de empilhamento do painel
   esquerdo (z-index 10), abaixo da barra de ícones (20). Aumentar só o
   z-index da gaveta não resolveria. Agora usa portal em document.body,
   cobrindo a lateral integralmente. O cabeçalho aceita quebra de linha.
2. **Datas:** gaveta e blocos compartilham o formatador validado: meia-noite
   aparece como 21/09/2026; horário preenchido como 21/09/2026 14:35.
   Sem conversão de fuso, segundos ou alteração dos valores da fonte.
   Datas inválidas continuam visíveis como recebidas.
3. **Nome da fonte:** a abertura do formulário usa label ou id, igual à lista.
   Um nome existente é preservado; Cancelar não altera a fonte.
4. **Tema escuro:** filtros e chips de origem usam explicitamente os tokens
   cv-surface-3, cv-line-strong e texto do tema do aplicativo, inclusive sobre
   folha branca. Os chips preservam suas cores semânticas. A inspeção inicial
   já encontrou os controles com tokens escuros; a mudança reforça a superfície
   escura e remove a sombra. O botão único de tema foi mantido.
5. **Carregamento:** durante a consulta, o corpo da gaveta mostra somente
   “Carregando dados…”, sem vazio, tabela antiga ou contador provisório.
   Copiar TSV fica desabilitado. O vazio aparece depois da consulta.
6. **Ações:** alternador “Dados de exemplo / Dados reais”, com ajuda curta.
   “Testar relatório” identifica o teste no cabeçalho e no menu compacto
   “Mais” usado a 1100 px.
7. **Lista:** havia oito buscas repetidas por fontes do Canvas. A lista agora
   reutiliza o índice de relatórios já carregado para descrições, restrito à
   requisição. A geração mantém a busca normal. Unidade, revisão, fila de
   revisão, disponibilidade, dataset, conexão e contrato SQL continuam
   validados. Objetos do índice são copiados antes da normalização.
   Visão geral e Custos Meta carregam seus módulos sob demanda, para a lista
   não baixar a biblioteca de gráficos. A configuração do build deixa somente
   módulos explícitos no chunk de gráficos: antes o runtime React compartilhado
   também estava nele e obrigava a lista a baixá-lo mesmo com imports lazy.

## Medição da primeira carga

Endpoint principal: GET /api/v1/reports/?unit=ame&page=1&section=reports.
As medições diretas equivalentes omitiram apenas page=1.

Perfil da mesma página (dez registros), em processos Django novos, com banco
em modo de leitura (PGOPTIONS=-c default_transaction_read_only=on):

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Primeira chamada no processo | 987,8 ms | 824,1 ms |
| Segunda chamada | 132,3 ms | 77,3 ms |
| Terceira chamada | 111,5 ms | 60,7 ms |
| Consultas SQL por resposta | 17 | 9 |
| Consultas à definição de relatórios | 12 | 4 |

Uma API Gunicorn temporária foi criada somente na rede Docker, sem porta
pública, workers de tarefas ou inicialização com migrate. Usou o código atual
montado em leitura, o banco com transações de leitura e um worker.
Sua primeira requisição HTTP direta à lista demorou **896 ms**; as seguintes,
**85, 86 e 59 ms**, todas HTTP 200, dez registros e 18.536 bytes.
A resposta completa foi comparada com a API existente: JSON idêntico,
inclusive pendências e descrições (evidência api-parity.json).

Antes da separação dos módulos de gráficos, três contextos novos do navegador,
sem cache, abriram a lista no staging padrão em **3460 / 1536 / 1967 ms**.
Baixavam 592.671 bytes do módulo inicial e 427.881 bytes de gráficos;
o download local de cada arquivo levou 28–60 ms. Num staging auxiliar com
worker novo e backend corrigido, a lista ficou pronta em
**3366 / 1379 / 1582 ms**. A primeira chamada de CSRF levou 1825 ms;
o GET principal da lista, 107 ms. Isso separa o custo de inicialização do
worker da consulta da lista.

Na versão final, o staging padrão (API existente) abriu em
**2114 / 1538 / 1406 ms**, sempre com contexto sem cache. O JavaScript inicial
caiu de **1.020.552 para 592.537 bytes (41,9% a menos)**. Nenhuma requisição ao
chunk de gráficos ocorreu na lista; o roteiro do navegador exige isso.
Visão geral e Custos Meta foram abertas em contextos novos e carregaram seus
módulos e gráficos corretamente, sem erros. No smoke de Custos Meta, somente a
resposta de faturamento foi simulada para não consultar o serviço externo.

Com frontend final e API temporária em sua primeira requisição HTTP após boot,
a lista ficou pronta em **4150 ms**; as repetições deram **938 / 1111 ms**.
A primeira chamada CSRF custou **2555 ms**; a primeira consulta de lista,
**234 ms**. Todos os endpoints responderam 200. O socket do worker foi
verificado antes do teste, sem aquecer endpoints por HTTP. Uma tentativa
anterior iniciou o navegador antes da escuta do worker e recebeu 502; foi
descartada, e não integra os resultados acima.
Os números brutos, perfis SQL e paridade estão em docs/qa14/measurements.json.


“Frio” significa processo/worker novo e contexto de navegador sem cache.
Não foram limpos caches do sistema operacional/PostgreSQL nem reiniciados
serviços de produção. Os ~22 s do QA4 não foram reproduzidos: há aquecimento
mensurável, mas não é possível atribuir toda a demora original a ele.
Os tempos são locais ao Orbita e não comprovam o comportamento de outra rede.

## Testes e QA

- scripts/canvas-check.sh: hooks, TypeScript, **476 testes Vitest** e build
  passaram. Há 16 testes novos para datas, nome/fallback e carregamento/vazio;
  expectativas anteriores foram atualizadas para os novos rótulos e minutos.
- Comando solicitado de pytest do Canvas: **74 passaram**, incluindo sete
  novos casos de consultas e restrições de fontes.
- Verificação ampliada do mesmo conjunto mais catálogo, descrições, paginação
  e snapshots de leitos: **171 passaram**. Banco de testes isolado.
- scripts/canvas-task14-qa.cjs: relatórios **6, 8 e 9**, claro e escuro,
  **1100 × 900 px**, dados reais, Ver dados, abrir/cancelar edição de fonte,
  abrir/fechar Testar relatório e trocar tema pelo botão da interface.
  Verifica nome, formatação, estados, camadas, cores computadas e ausência de
  overflow da página. GETs da configuração antes/depois ficaram idênticos.
  Somente POSTs de consulta canvas-source-preview são permitidos; qualquer
  salvamento/escrita é abortado. Nenhum salvamento foi tentado.
- **Zero erros de JavaScript/console e zero escritas em relatórios**.
  **24 capturas** em /opt/orbita/docs/qa14/, com estados canvas, dados,
  fonte e testar para cada relatório/tema. As seis capturas da gaveta foram
  também inspecionadas visualmente.
- Capturas com dados operacionais ficam somente no host e são ignoradas pelo
  Git. Os JSONs de resumo/desempenho não contêm linhas dos relatórios ou cookies.
- Logs completos em artifacts/task14/ (fora do Git). Sessão reutilizada de
  arquivo privado temporário, removido após o QA.

## Reprodução

O QA usa a imagem existente orbita-canvas-stage-qa09-tools:latest, rede host,
scripts/canvas-task14-qa.cjs montado em /qa/task14.cjs, sessão privada em
/private/session.json e docs/qa14 montado em /evidence. Executar node task14.cjs;
PERFORMANCE_ONLY=1 faz somente a medição da lista. QA_BASE seleciona o staging
(padrão http://127.0.0.1:8091).

scripts/canvas-task14-lazy-qa.cjs verifica também as duas telas com gráficos.

scripts/canvas-task14-profile.py, executado por stdin em container com
PGOPTIONS=-c default_transaction_read_only=on, mede o endpoint usando usuário
administrativo existente em memória, sem login ou criação de sessão.
scripts/canvas-task14-api-timing.cjs mede HTTP contra a API temporária
orbita-canvas-stage-api-qa14 na rede orbita_default, com a sessão privada.
Nenhum deles imprime credencial ou conteúdo do relatório.

## Entrega e limites

Staging padrão atualizado apenas por scripts/canvas-stage.sh up, porta 8091,
imagem dac76c1fc15e.
O backend de produção não foi atualizado: a melhoria das consultas fica no
commit local, validada em testes e na API temporária. O staging padrão continua
apontando para a API existente. O staging auxiliar de medição e sua API foram
removidos ao concluir. O aviso de chunk acima de 500 kB permanece no build;
a biblioteca de gráficos deixa de fazer parte da carga da lista.

Este relatório pertence ao commit local consultável por
git log -1 --oneline -- docs/canvas-task14.md.
