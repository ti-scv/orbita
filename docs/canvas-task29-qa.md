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

## Continuação 29b — execução parcial

- A apresentação remove o sufixo “› Dados” dos nomes de fonte e dos erros tratados pelo helper; a gaveta usa o nome amigável e a origem mostra o nome curto. Foram adicionadas explicações acionáveis por teclado para as contagens no painel e na gaveta.
- Na prévia de fonte, os parâmetros conhecidos recebem rótulos e valores legíveis, incluindo data final sem limite. O editor de parâmetros usa rótulos amigáveis em parte de suas ações. Datas brasileiras são reconhecidas na inferência; a lista de colunas utiliza a amostra para corrigir tipo desconhecido ou data pura classificada como data e hora.
- A auditoria completa de identificadores não terminou: o formulário da fonte ainda expõe nomes técnicos nos campos de vínculo e há outros caminhos de erro não auditados. Não foi implementado o resumo de alterações de parâmetros, nem a mensagem completa de parâmetro inexistente. A aparência e acessibilidade das novas explicações precisam de inspeção adicional.
- Sessão temporária autenticada, usuário existente, staging 8091, sem salvar relatórios. Chromium em 28/10/2026: abertura até a área do editor, sem cache / após navegação de aquecimento, respectivamente: relatório 1 1093/974 ms; relatório 2 1051/1096 ms; relatório 6 1154/873 ms. Em seguida foi acionado “Dados reais”; as prévias responderam 200 em 136/38, 152/44 e 155/39 ms respectivamente. São amostras únicas, feitas antes da reconstrução final, e não medem até a conclusão visual de todos os blocos. Requisições registradas em /tmp/canvas29b-real-warm.json; a maior espera de API nessa amostra foi 165 ms (CSRF, relatório 6 sem cache). A diferença até a abertura inclui carregamento e execução do frontend, não se isolou a etapa dominante. Não houve timeout de 20 s do relatório 2 na amostra.
- No relatório 6, a prévia enviou source report_id 6, unidade ame, período 2026-09-28 a 2026-10-28, parâmetros de execução vazios, limite 50 e offset 0; respondeu 200. Não houve chamadas de validação nessa abertura. Não foram reproduzidos os 400 nem o 502 relatados, e os logs disponíveis não permitem determinar suas causas exatas. Não se alterou a configuração de workers. É necessário reproduzir os erros e correlacionar os horários antes de propor alteração para produção.
- scripts/canvas-check.sh: 50 arquivos de testes passaram, hooks, TypeScript e build passaram (/tmp/canvas29b-check-verified.log). Backend: 42 testes em SQLite isolado passaram (/tmp/canvas29b-backend.log). Staging reconstruído com API_UPSTREAM solicitado; curl confirmou ReportCanvas-BLkEWOFt.js, HTTP 200, diferente de DDmcrE_t.
- Pendências adicionais: medição do esqueleto da origem, colagens das três datas no navegador, investigação completa de desempenho, erros e logs, auditoria dos identificadores em todas as telas e matriz visual integral. A matriz sintética não substitui dados reais. Não houve push, migração, gravação de relatórios ou mudança em produção; Login.tsx e a auditoria preexistente não foram incluídos nos commits.

- Matriz sintética t29b: 18 cenários (relatórios 1, 2 e 6, 1100/1280/1440, claro e escuro), 90 capturas de dados, parâmetros expandidos, gaveta, origem e editor de fonte. Detector: zero erros, rolagem horizontal, sobreposições visíveis ou cortes não intencionais. Não cobre o diálogo de parâmetros completo nem substitui inspeção humana. Resultados: docs/canvas-qa-prints/t29b-resultados.json.

FIM-TAREFA-29B — execução parcial; pendências acima.
FIM-DO-PROCESSO

## Continuação 29c — execução parcial

- O editor de parâmetros recolhido mostra a quantidade de declarações e de alterações de cadastro pendentes; acrescentado teste do resumo. Nos vínculos de fonte, os nomes conhecidos são apresentados em português e os identificadores dos parâmetros ficam recolhidos; erros do formulário passam pelo helper de nome da fonte. A máscara de data também foi aplicada ao diálogo “Testar relatório”.
- Sessão real temporária, usuário existente, staging 8091: no relatório 6, colagem com Ctrl+V de 2026-01-01, 01-01-2026 e 01012026 resultou em 01/01/2026. Após abrir a gaveta, expandir origens e esperar três segundos pela pré-busca, abertura da primeira origem até os detalhes: 89 ms. Uma amostra aquecida; não mede cache frio nem garante todas as colunas.
- Nova medição autenticada em 28/10/2026: abertura sem cache/com navegação prévia em ms: relatório 1 1026/994, relatório 2 1091/864, relatório 6 1025/962. Prévia da fonte: 142/37, 158/37 e 134/69 ms, respectivamente, todas HTTP 200; sessão HTTP 200. O relatório 6 enviou fonte report_id 6, unidade ame, start 2026-09-28, end 2026-10-28, parâmetros de execução vazios, limite 50 e offset 0; ambas as prévias responderam 200. Nenhuma chamada de validação foi feita nessas aberturas. Evidência de rede em /tmp/canvas29b-real-warm.json e /tmp/canvas29c-network.log; horários são UTC em epoch ms. Não houve timeout na amostra.
- Os logs disponíveis do nginx não registraram os 400/502 procurados; gunicorn registrou parada às 09:55:58 UTC e reinício às 09:56:00 UTC em 28/10, com um worker síncrono. Isso não associa o reinício aos erros relatados, nem prova sua causa. Não foram feitos ensaios de concorrência nem adicionada proteção específica para 502; ainda faltam repetição, corpos e respostas da validação e correlação com logs.
- Matriz sintética t29c: relatórios 1, 2 e 6, 1100/1280/1440, claro/escuro, seis telas por cenário incluindo diálogo completo de teste: 18 cenários e 108 capturas, em docs/canvas-qa-prints/t29c-*. Detector registrou zero erros de execução, rolagem horizontal de página, sobreposição de botões, controles sem nome ou cortes não intencionais. Inspeção humana de amostras: fonte clara, origem clara, gaveta escura e diálogo de teste escuro. O diálogo de teste ainda exibe o valor técnico “ame”; não foram inspecionadas individualmente todas as capturas nem verificado contraste formalmente. A matriz é sintética.
- scripts/canvas-check.sh: 50 arquivos, 528 testes, hooks, TypeScript e build passaram (/tmp/canvas29c-check-final.log). Backend isolado: 42 testes passaram (/tmp/canvas29c-backend.log). Staging reconstruído; curl identificou ReportCanvas-i3CvzpBy.js, diferente de BLkEWOFt. A tentativa isolada de teste em container teve timeout de inicialização de worker, mas a execução completa posterior passou.
- Pendências: auditoria completa de identificadores e erros do backend, teste automático abrangente contra sua exposição, valor amigável editável no diálogo de teste, mensagem de parâmetro inexistente, investigação dos erros e concorrência, inspeção visual individual completa e correções decorrentes. O resumo contabiliza edições de cadastro de parâmetros, não mudanças nos valores de execução. Não houve push, migração, gravação de relatórios ou alteração de produção; Login.tsx e a auditoria preexistente foram preservados.

FIM-TAREFA-29C — execução parcial; pendências acima.
FIM-DO-PROCESSO

## Continuação 29d — execução parcial

- O teste de relatório apresenta “AME Votuporanga” para o padrão `ame` em campo editável e converte esse nome de volta ao código ao enviar; opções conhecidas recebem rótulos amigáveis. Foi removido o código do bloco do link de erro. O resumo inclui nomes de parâmetros de execução cujo valor difere do padrão inicial da prévia, além das edições de cadastro (sem contar o mesmo nome duas vezes). Testes cobrem a conversão e o resumo; não foi feita a auditoria completa de identificadores e mensagens de todas as telas.
- Erro de parâmetro desconhecido no motor lista os nomes amigáveis disponíveis e mantém entre aspas apenas o parâmetro inexistente. A alteração de backend foi testada, mas o processo da API de staging não foi reiniciado para carregá-la.
- A API do frontend tenta até três vezes as leituras de sessão e prévias de fonte em HTTP 502/504 ou timeout de 15 s, com mensagens em português; outras operações não são repetidas. O editor JSON impede o envio de sintaxe inválida e da ausência das listas de páginas/fontes; isso não garante validação prévia completa do esquema. Teste cobre 502 transitório e ausência de repetição em erro 400.
- `scripts/canvas-check.sh`: 50 arquivos, 531 testes, lint de hooks, TypeScript e build passaram (/tmp/canvas29d-check-final.log). Backend com SQLite isolado: 42 testes passaram (/tmp/canvas29d-backend.log). Commits locais 87669da e 396f078.
- Ensaios autenticados entre 11:22:23 e 11:22:27 UTC, sem gravar relatórios: duas rodadas, cada uma com cinco chamadas simultâneas por operação de sessão, prévia e validação dos relatórios 1, 2 e 6. Todas as 70 respostas foram HTTP 200, entre 31 e 341 ms. Corpos e respostas completos estão em /tmp/canvas29d-concurrency.json com permissão 600 por conterem dados reais. A segunda rodada foi aquecida; a primeira não comprova cache de servidor frio. O nginx registrou as respostas no mesmo intervalo e o Gunicorn não registrou erros nesse intervalo. O reinício às 09:55:58–09:56:00 UTC e o worker síncrono único são compatíveis com indisponibilidade temporária e filas, respectivamente, mas não há evidência para atribuir os erros anteriores a qualquer um deles. Considerar mais workers para produção após medição de carga; nenhuma configuração de produção foi alterada.
- Medição de origem sem pré-busca aquecida, relatório 6, navegador externo por túnel SSH: 3168 e 3567 ms até os detalhes, acima da meta. Uma requisição observada respondeu em 404 ms na segunda amostra, mas o túnel e a concorrência introduzem incerteza; não foi isolada a causa nem corrigida a meta de cache frio. A medição anterior aquecida de 89 ms continua válida apenas para aquela amostra.
- Ainda faltam auditoria e teste abrangentes contra identificadores crus, tratamento completo de erros do backend, teste integral de corpos de validação, medições de cache frio controlado, e matriz t29d com inspeção individual e verificação formal WCAG AA. Os resultados anteriores t29c não substituem essas verificações. Não houve push, migração, alteração de produção ou inclusão de Login.tsx e da auditoria preexistente.


## Encerramento 29d — concluída (28/10/2026)

Esta seção encerra as pendências registradas acima; as seções parciais foram preservadas como histórico. Continuação dos commits 87669da e 396f078, sem refazer os 70 pedidos concorrentes nem os 42 testes de backend já aprovados. Código complementar no commit local c2c7430.

### Identificadores, erros e contrato de validação

A revisão cobriu ReportCanvas, painel de dados, resumo/editor de parâmetros, gaveta, origem, editor de fonte, diálogo Testar relatório, inspetores de conteúdo/dados/página, estrutura, problemas, tooltips e nomes acessíveis. Os nomes passam pelos helpers de apresentação; fonte removida não imprime seu código. O sufixo legado “› Dados” também é removido no inspetor e no editor, sem alterar o layout original ao abrir/cancelar. O conjunto de dados permanece “Dados (8 colunas)”, rótulo humano do seletor; seu identificador fica restrito ao avançado.

Unidade e tipo de envio usam nomes amigáveis editáveis nos filtros, valores fixos da fonte e diálogo de teste. “AME Votuporanga” e “Agendamento” viram os códigos esperados somente no envio. Campo opcional sem padrão continua vazio. O resumo de parâmetros considera diferenças nos valores de execução além das edições de cadastro, conforme 87669da; sua cobertura foi preservada.

O tratamento central em common/errorMessage.ts transforma listas e campos aninhados, ignora metadados técnicos e substitui o identificador pelo nome da fonte obtido do corpo da requisição. Erros de rede, autenticação, permissão, ausência, limite e servidor recebem português simples; respostas HTML/SQL/framework não vazam na interface. Mensagens de validação mantêm a orientação útil e a posição de linha/coluna. A única exceção deliberada é o nome entre aspas do parâmetro inexistente, exigida pelo brief, além dos detalhes técnicos avançados e editor JSON explícito.

O motor atualizado foi carregado no processo de staging e conferido com pedido real do relatório 6: HTTP 400, `Fonte "dados": O parâmetro "nao_existe_t29d" não existe nesta fonte. Parâmetros disponíveis: Data final, Data inicial, Unidade, Tipo de envio.` O código de fonte pertence ao contrato técnico da API e é substituído pelo nome amigável ao apresentar o erro; o teste inclui também o formato real “O parâmetro ... não existe”.

A API tenta no máximo três vezes, com timeout de 15 s por tentativa, leituras de sessão e prévias de fonte/Canvas em 502/504 ou timeout. Esgotamento, recuperação transitória e ausência de repetição em 400 têm testes. Escritas não recebem repetição automática. JSON sintaticamente inválido e envelope inválido não são enviados por validateCanvasRequest: objeto, listas de páginas/fontes, limite de 750 KB, booleano enabled, formato pdf/xlsx e lista parameter_edits são conferidos. O servidor continua responsável pela validação semântica do esquema e devolve 400 legível com localização. A matriz confirmou zero chamadas de validação ao tentar JSON malformado e conferiu a apresentação de erro 400 contendo todos os identificadores conhecidos.

Testes novos: task29d-errors.test.ts (nomes/erros, campos aninhados, metadados, fonte ausente e estados HTTP), task29d-validation.test.ts (corpo completo e bloqueio antes da rede), api.test.ts (repetições/timeout) e task29d-keyboard.test.tsx (ordenação real por teclado). O script scripts/canvas-task29d-qa.cjs falha diante de identificadores nos textos visíveis, valores de campos, títulos e aria-labels em 12 estados de cada cenário. Avançado fechado e textarea do editor JSON técnico são excluídos explicitamente. Resultados finais: zero vazamentos em 216 estados.

### Validação real, correlação e erros históricos

Foram feitos 27 POSTs autenticados e seriados no staging, nos relatórios 1, 2 e 6: um corpo válido e oito inválidos por relatório (json ausente, tipo incorreto, sintaxe incompleta, null, array, objeto vazio, pages inválido e sources inválido). Resultado: três HTTP 200 e 24 HTTP 400 esperados, nenhum resultado inesperado, máximo 51 ms. Esses pedidos inválidos foram enviados diretamente pelo ensaio para verificar a defesa do backend, sem passar pela interface. O cliente tem testes separados que comprovam o bloqueio antes da rede.

Os 27 pedidos aparecem no nginx no mesmo intervalo UTC; recortes de nginx e API, corpos e respostas integrais estão em /root/canvas29d-evidence/ com acesso restrito. validation.json tem permissão 600 e SHA-256 4df85adf1d1c13858b83bbc5afb6791fdee84a543fed4741b4a1a52fb8e86ad9. Não se versionaram sessões, credenciais nem layouts reais. [Resumo dos corpos/respostas](canvas-qa-prints/t29d-validacao-resumo.json) e [execução/correlação](canvas-qa-prints/t29d-validacao-execucao.json) contêm somente o necessário, com o layout válido omitido e hash de cada corpo.

O ensaio anterior de 70 respostas 200 (31–341 ms, 11:22:23–11:22:27 UTC) permanece registrado na seção parcial e não foi repetido. O host reiniciou inesperadamente por volta de 13:16 UTC, apagando /tmp e interrompendo uma coleta intermediária; por isso o arquivo bruto anterior /tmp/canvas29d-concurrency.json deixou de estar disponível. Essa limitação é explícita: seu resultado vem da execução anterior já documentada, não da nova coleta. As evidências desta continuação foram guardadas fora de /tmp.

Não se reproduziram os 502 e timeout de 20 s históricos. A parada/reinício de Gunicorn às 09:55:58–09:56:00 UTC é compatível com indisponibilidade transitória; o worker síncrono único é compatível com fila durante prévias. São hipóteses mais prováveis, sem correlação temporal suficiente para afirmar a causa exata. Os ensaios bem sucedidos não provam ausência futura de falhas. Após o novo reboot, um curl imediatamente após subir o nginx teve conexão interrompida; novas tentativas após a prontidão funcionaram. Esse incidente de inicialização é distinto dos 502 antigos. Não houve alteração de configuração de produção ou de workers; eventual comparação com dois workers deve começar em teste de carga isolado de staging.

### Origem com cache frio controlado

Medição autenticada no próprio host, pelo navegador Chromium, em novo contexto para cada caso. Oito pedidos de pré-busca foram interceptados e abortados antes de cada abertura; só então um clique liberou o pedido da origem. performance.now e MutationObserver dentro da página registraram a primeira aparição do esqueleto e dos detalhes. Assim, o tempo não inclui a viagem do controlador pelo túnel SSH. Foram três rodadas por relatório, nove contextos frios do cache de origem do frontend; não se limpou cache compartilhado de banco/produção. O endpoint fornece metadados e não executa a SQL mostrada.

| Relatório | Até detalhes (ms) | Esqueleto visível (ms) | HTTP final |
| --- | --- | --- | --- |
| 1 | 54,8–113,9 | 40,6–90,6 | 200 nas três rodadas |
| 2 | 94,7–110,6 | 82,1–92,2 | 200 nas três rodadas |
| 6 | 39,7–74,9 | 30,6–61,9 | 200 nas três rodadas |

Meta <500 ms atendida inclusive até os detalhes, máximo 113,9 ms; a espera HTTP observada foi 26–91 ms. [Medições completas](canvas-qa-prints/t29d-origem-fria.json). As amostras anteriores de 3168/3567 ms usavam controle externo por SSH e não isolavam a duração do esqueleto; não são diretamente comparáveis. A amostra aquecida anterior de 89 ms continua sendo apenas aquela amostra.

### Matriz final e inspeção visual individual

Relatórios 1, 2 e 6 × 1100/1280/1440 px × claro/escuro: 18 cenários. Cada cenário tem 12 estados verificados no DOM/axe e seis PNGs (dados, parâmetros expandidos, gaveta, origem, editor de fonte e diálogo Testar relatório): 216 verificações e 108 capturas finais. Os demais estados são filtros, inspetor de dados, inspetor de conteúdo, estrutura, erro do backend e JSON inválido. Os dados desta matriz são sintéticos e as chamadas interceptadas não gravam nada; os ensaios de tempo/validação acima são reais e separados.

Todos os 108 PNGs foram abertos individualmente após a reconstrução final e comparados por SHA-256 com os arquivos do servidor: 108 iguais. [Lista individual com observações](canvas-qa-prints/t29d-inspecao.md), [manifesto SHA-256](canvas-qa-prints/t29d-sha256.txt) e [resultado automático](canvas-qa-prints/t29d-resultados.json).

Defeitos encontrados e corrigidos durante a inspeção: nome de coluna comprimido junto das ações do inspetor; regra CSS compartilhada que cortava “Acompanhamentos” na lista de blocos da página; contraste insuficiente de números de linha, ajuda de filtros, contagem da árvore e bordas de campos; cabeçalhos longos sem quebra. As capturas finais mostram nome de coluna acima da origem/ações, nome do bloco completo e campos amigáveis. A regra de grade foi limitada aos filhos diretos da lista de colunas, preservando a lista de blocos. Não restaram sobreposições nem cortes involuntários de controles/rótulos nos PNGs finais. Rolagem de tabelas/listas/corpo de modal e deslocamento da página maior que a área central no zoom de 85% são intencionais. PDF, XLSX, TSV, Status e Layout são termos aceitos; nenhum texto funcional em inglês foi encontrado.

O timeout de screenshots esperando fontes foi eliminado no coletor por espera limitada, sem mudar o carregamento do produto. Todos os registros finais indicam fontes DM Sans/Manrope carregadas; não se aceitou captura sem fonte como substituição silenciosa.

### WCAG AA

axe-core 4.14 com regras WCAG 2 A/AA e 2.1 AA: zero violações nos 216 estados. Corrigidos papéis ARIA, cabeçalhos de tabela e regiões roláveis com foco. A ordenação da gaveta responde a Enter/Espaço e atualiza aria-sort, conferida no navegador e em teste de interação. Os modais mantêm cabeçalho/ações fora do corpo rolável.

Contraste calculado pela fórmula de luminância relativa sRGB de WCAG: texto normal exige 4,5:1; limites de controles exigem 3:1. Valores finais:

| Uso | Claro | Escuro |
| --- | --- | --- |
| Texto secundário nos fundos usados | 4,52–5,05:1 | 5,18–5,69:1 |
| Borda forte dos campos nos fundos usados | 3,56–3,73:1 | 4,36–4,80:1 |
| Texto principal da gaveta | 15,09:1 | 15,08:1 |

Tokens conferidos: claro #5a7189 sobre #ffffff/#f8fafc/#eef3f8; escuro #8593a6 sobre #15181d/#1c1c1c/#1c2128. Bordas #75869a (claro) e #76869c (escuro). A contagem selecionada na árvore passou de 4,46:1 para 7,18:1 com #3b5266 sobre #ebf2f6. Antes, números de linha estavam em 2,42/2,75:1 e ajuda de filtro escuro em 3,34:1; foram corrigidos.

O axe deixou somente verificações inconclusivas de contraste em células parcialmente recortadas pela rolagem e no título da gaveta, por geometria de sobreposição/recorte; não apresentou razão numérica reprovada. Esses elementos foram inspecionados nas imagens e suas cores verificadas explicitamente, incluindo o texto de tabela com ~15:1. Esta verificação cobre os estados e conteúdos padrão da matriz; não certifica cores arbitrárias escolhidas pelo usuário nem todos os conteúdos futuros.

### Verificação e entrega

scripts/canvas-check.sh executado novamente após o código final: 53 arquivos, 574 testes aprovados, hooks, TypeScript e build aprovados; 118 s. Log durável /root/canvas29d-evidence/check.log, hash no [resumo final](canvas-qa-prints/t29d-verificacao.json). Os 42 testes de backend aprovados pela sessão anterior não foram refeitos, conforme pedido; esta continuação não alterou backend.

Após o reboot foi iniciado o container existente da API de teste e reconstruído somente o staging com API_UPSTREAM=orbita-canvas-task26-api:8000 scripts/canvas-stage.sh up. Curl de 28/10/2026 13:48:55 UTC confirmou HTTP 200 e ReportCanvas-Cb4znwU2.js, diferente de DCPruKQY/i3CvzpBy. [Comprovação do bundle](canvas-qa-prints/t29d-build.json). Os 108 PNGs finais e a matriz foram gerados com esse bundle.

Somente commits locais na branch feature/canvas-redesign; sem push, main, migração, gravação de relatórios ou mudança em produção. Login.tsx, a auditoria estática preexistente e teste.bin foram preservados e excluídos dos commits. A sessão temporária para testes usa usuário existente; suas credenciais permanecem privadas. As pendências funcionais da 29d foram encerradas; a causa exata dos incidentes históricos continua não demonstrável com os logs disponíveis, com hipótese e limitação documentadas acima.

FIM-TAREFA-29D (concluída)
FIM-DO-PROCESSO
