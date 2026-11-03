# Tarefa 21 — desempenho da prévia de dados

Coleta em 28/10/2026, aproximadamente 05:32–06:10 UTC, servidor 172.16.0.59, projeto /opt/orbita, branch feature/canvas-redesign. Somente commits locais. Nenhum serviço de produção foi reiniciado/reconstruído; nenhum dado de relatório, credencial ou configuração de conexão foi alterado.

## O que explica a demora

- O banco Orbita tem 80 MB. Os relatórios 323 e 326 não têm consulta lenta no PostgreSQL: EXPLAIN inicial mediu 1,42 e 1,53 ms; o 6 mediu 7,90 ms. Com os parâmetros padrão do período, 323/326 não tinham linhas: isso não valida volume histórico cheio.
- Alguns indicadores locais têm uma junção de mensagens com OR e subconsulta correlacionada de fallback por agendamento. Ela consumia 400–980 ms mesmo com poucos milhares de registros. Dividir em duas junções disjuntas com UNION ALL removeu o trabalho repetido.
- A prévia buscava até o max_rows da conexão, convertia todo o resultado e inferia todas as linhas, para depois mostrar 50. O relatório 59, por exemplo, carregava 1.312 linhas.
- Os indicadores externos coletavam novamente todos os conjuntos a cada prévia. No relatório 63, a primeira coleta externa continua custando cerca de 9,7 s; os próximos conjuntos da mesma coleta passaram a 44–54 ms. Vidas (273/307/309) passou de aproximadamente 1,6–2,3 s por conjunto para 46–57 ms nos conjuntos seguintes.
- Com as datas obrigatórias preenchidas, as consultas Oracle comuns levaram 7,8–17,1 s (por exemplo, 268: 17,1 s; 269: 12,2 s), quase tudo no execute, e não na conexão.
- Com data_referencia=2026-10-28, o relatório 33 fez consultas Oracle externas até o timeout: 30,4–31,2 s, dos quais aproximadamente 29,8–30,1 s na consulta e 25–132 ms na conexão. Seus componentes são 366/367/368, conexão 20; a conexão declarada no relatório pai não basta para atribuir o gargalo. O cálculo exige a série histórica desde janeiro do ano anterior. Não aplicar LIMIT aos agregados nativos: mudaria os indicadores.
- Há espera por armazenamento na VM. A latência de auditoria/autenticação e concorrência também produz picos em uma API cuja consulta já terminou. A observação não identifica qual equipamento físico causa a espera.

## Alterações aplicadas ao código

1. Prévia PostgreSQL tem LIMIT no banco, uma linha adicional para detectar continuidade e offset de 0 a 10.000. Limite padrão 50, máximo 500; as amostras de 50 e 200 foram verificadas. A exportação mantém SQL, limite e comportamento anteriores.
2. Só no caminho da prévia operacional conhecida, substitui a junção de mensagens por UNION ALL. Confere a estrutura real da CTE de mapeamento, inclusive DISTINCT ON, para não reescrever SQL arbitrário ou um trecho presente apenas em comentário. As 141 consultas PostgreSQL comparadas retornaram exatamente os mesmos resultados e ordem; 93 usam a reescrita.
3. Cache de 15 s em memória de cada worker, até 32 entradas e até 2 MiB por entrada. A chave separa usuário, unidade, relatório, versão, conexão/SQL, metas, parâmetros, conjunto, limite e página. Permissões e disponibilidade são conferidas antes de qualquer hit. Não persiste amostras em Redis ou disco. Compartilha também a coleta nativa entre conjuntos do mesmo relatório. Workers diferentes podem ter miss; não existe garantia de cache entre processos.
4. Prévia SQL PostgreSQL usa timeout de no máximo 5 s, sem persistir a mudança na conexão. Timeout retorna orientação para reduzir o período. Fontes nativas/externas mantêm os timeouts dos respectivos adaptadores; não houve mudança de consultas clínicas ou credenciais.
5. A API retorna total_rows_exact, has_more, next_offset, cache_hit, external, notice e tempos de conexão/execute/fetch/leitura/serialização. Em PostgreSQL paginado, total_rows é um limite inferior quando total_rows_exact=false. Não executa COUNT caro só para desenhar uma amostra. Metadados de coluna descrevem a página amostrada.
6. O catálogo identifica fontes externas com “(origem externa)”, visível na seleção da origem; a resposta inclui aviso. A interface já tinha estados de carregamento. Não foram editados frontend, login nem report-canvas/data nesta tarefa. Os novos campos de paginação ficam disponíveis à interface; controles de navegação e indicação explícita de total aproximado precisam ser integrados pela sessão responsável pelo frontend.

Não foram criados índices, alteradas visões, executadas migrações de produção ou ajustados parâmetros do PostgreSQL. Os planos não justificaram um índice novo nesta base pequena; a correção demonstrada é na junção. Por isso não houve pg_dump de migração nem etapa de aplicar migração em produção. Se surgir uma migração futura: primeiro pg_dump protegido em /root/backup-t21-<data>.sql, testar em staging e somente depois aplicar; índices grandes com CREATE INDEX CONCURRENTLY em migração não atômica.

## Método e limites da medição

Inventário: 212 relatórios ativos com Canvas, 310 fontes/páginas de origem; 183 relatórios de origem distintos. As 237 chamadas de fontes PostgreSQL usavam 141 consultas distintas. Inclui explicitamente 323, 326 e 6, além das fontes dos compostos.

A tabela completa abaixo usa o endpoint REST com APIRequestFactory, autenticação administrativa interna e renderização JSON dentro de uma API de staging. Inclui validação, consulta, conversão e auditoria, mas não transporte HTTP nem carregamento do navegador. Executado sequencialmente; repetições idênticas indicadas como reutilizadas nos JSON. O observador de conexão mede handshake; query_ms mede execute com espera/transporte; fetch_ms mede busca no driver. A diferença de API menos esses tempos não é só serializador: inclui autorização, parsing/validação de SQL, montagem de objetos, finalização da transação e gravação de auditoria.

“—” significa que o estágio não foi executado/instrumentado ou que houve reaproveitamento. Um relatório nativo pode usar Oracle/PostgreSQL internamente, por isso “native” não é o motor real. Os campos handler e os componentes documentados distinguem esses casos. O tempo de serialização está disponível no depois; no antes ele está misturado à sobrecarga da API.

Limitação do primeiro medidor: respostas de validação em lista causavam AttributeError ao extrair a métrica. Nas linhas com antes “erro*”, o número é o tempo até esse erro do medidor, não uma prévia bem-sucedida nem um tempo confiável da consulta. O medidor foi corrigido; o depois registra HTTP 400. As falhas dessas origens foram verificadas separadamente. Não se contam como ganho de velocidade. Também não se compara erro sem parâmetro obrigatório com sucesso com um parâmetro preenchido.

Parâmetros padrão vazios nos relatórios comuns; estoque 28 com 2026-10-01 a 2026-10-28. Os casos 33, 268/269, demais consultas Oracle com WPA_DATA_INICIAL/FINAL e 310 exigem datas: foram identificados na validação e repetidos separadamente com datas explícitas. Em 28, a conexão está desativada/não validada; 50 tem Oracle indisponível. O relatório 269 sem datas falha por WPA_DATA_FINAL; 310 sem datas falha na seleção obrigatória; com 01–28/10, a validação impede misturar fotografias de homologação e legado de produção, como deve fazer. Não foram “consertadas” conexões desativadas pelo administrador.

Resumo de fontes PostgreSQL, janela compartilhada (não é SLA):
- Antes: 237 chamadas; mediana 202.25 ms; p95 783.53 ms; máximo 2714.91 ms; 7 acima de 1 s.
- Depois: 237 chamadas; mediana 177.38 ms; p95 285.30 ms; máximo 462.41 ms; 0 acima de 1 s.

Na rodada completa depois da correção, todas as 237 chamadas PostgreSQL ficaram abaixo de 1 s (máximo 462,41 ms). Os picos de armazenamento observados nas outras janelas impedem transformar isso numa garantia permanente. A meta foi atingida na verificação HTTP focal de 50/200 linhas; a primeira abertura completa do editor tem custo separado.


## Repetição com datas obrigatórias explícitas

Cenário separado da tabela padrão: WPA_DATA_INICIAL=2026-10-01, WPA_DATA_FINAL=2026-10-28; no 33 e suas referências, data_referencia=2026-10-28. Consultas Oracle comuns completam, mas são lentas na origem; não foram classificadas como PostgreSQL local. O 28 segue bloqueado por configuração de conexão, e o 310 rejeita um período que mistura homologação/produção. No 33, observam-se timeouts; a repetição foi interrompida após confirmação, sem encerrar processos alheios. Não preencher artificialmente as linhas que não foram executadas.

| Relatório/fonte → origem | HTTP | API ms | Consulta ms | Conexão ms | Fetch ms | Linhas devolvidas |
|---|---:|---:|---:|---:|---:|---:|
| 28/dados → 28 | 400 | 85.25 | — | — | — | 0 |
| 28/resumo → 28 | 400 | 28.48 | — | — | — | 0 |
| 268/dados → 268 | 200 | 17094.62 | 16673.45 | 273.65 | 9.53 | 50 |
| 269/dados → 269 | 200 | 12182.65 | 12101.91 | 31.44 | 0.89 | 6 |
| 274/dados → 274 | 200 | 15311.32 | 15220.26 | 27.39 | 3.15 | 50 |
| 276/dados → 276 | 200 | 12313.69 | 12245.12 | 29.65 | 0.71 | 7 |
| 277/dados → 277 | 200 | 12261.62 | 12189.68 | 32.15 | 0.75 | 6 |
| 278/dados → 278 | 200 | 12258.91 | 12188.15 | 30.37 | 1.18 | 8 |
| 279/dados → 279 | 200 | 12334.90 | 12247.85 | 33.12 | 1.22 | 5 |
| 280/dados → 280 | 200 | 12031.36 | 11958.88 | 29.33 | 1.16 | 8 |
| 281/dados → 281 | 200 | 12184.96 | 12119.28 | 28.58 | 1.59 | 6 |
| 282/dados → 282 | 200 | 12211.85 | 12135.52 | 29.28 | 0.72 | 7 |
| 283/dados → 283 | 200 | 12318.40 | 12249.49 | 27.94 | 1.00 | 6 |
| 284/dados → 284 | 200 | 12023.25 | 11961.94 | 27.95 | 0.69 | 6 |
| 285/dados → 285 | 200 | 12066.11 | 11999.73 | 27.54 | 0.79 | 7 |
| 286/dados → 286 | 200 | 12313.70 | 12234.86 | 28.57 | 0.92 | 10 |
| 287/dados → 287 | 200 | 12078.45 | 11987.44 | 38.69 | 1.23 | 9 |
| 310/dados → 310 | 400 | 81.56 | — | — | — | 0 |
| 311/dados → 311 | 200 | 7832.00 | 7576.61 | 30.82 | 71.63 | 50 |
| 316/dados → 316 | 200 | 11990.32 | 11907.61 | 33.12 | 0.04 | 0 |
| 33/metadata → 33 | 400 | 31216.30 | 30012.08 | 131.82 | 17.51 | 0 |
| 33/general → 33 | 400 | 30778.34 | 30125.93 | 25.43 | 11.22 | 0 |
| 33/sus → 33 | 400 | 30355.01 | 29823.46 | 32.71 | 10.78 | 0 |
| 65/metadata → 33 | 400 | 26343.91 | 25227.95 | 128.13 | — | 0 |
| 65/general → 33 | 400 | 32637.97 | 31883.85 | 38.41 | 11.41 | 0 |
| 65/sus → 33 | 400 | 32010.11 | 31518.71 | 25.13 | 11.31 | 0 |
| 65/convenio → 33 | 400 | 31948.96 | 31108.06 | 40.89 | 15.48 | 0 |
| 65/sectors → 33 | 400 | 31826.37 | 31149.19 | 34.91 | 15.07 | 0 |

Evidências da repetição: [required-dates.json](canvas-task21-evidencias/required-dates.json). O teste usa endpoint interno, portanto “HTTP” nesta tabela é o código de status retornado pelo endpoint, sem transporte real.

## HTTP real em staging

API Gunicorn com dois workers, sessão temporária de administrador removida ao final, somente prévia e leituras. Porta interna 8000, publicada em 127.0.0.1:18021. Os tempos abaixo incluem middleware/sessão/CSRF, transporte local e resposta JSON. 323/326 retornaram zero linhas nesse período; o 6 e o 59 retornaram as 50/200 pedidas.

| Relatório | Limite | Repetição | HTTP ms | Linhas | Cache de página | Conexão ms | Consulta ms | Fetch ms | Serialização ms |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|
| 323 | 50 | 0 | 996.46 | 0 | False | 24.91 | 51.93 | 0.01 | 0.07 |
| 323 | 50 | 1 | 23.00 | 0 | True | — | — | — | 0.10 |
| 323 | 200 | 0 | 214.25 | 0 | False | 16.05 | 50.88 | 0.15 | 0.07 |
| 323 | 200 | 1 | 33.56 | 0 | True | — | — | — | 0.04 |
| 326 | 50 | 0 | 941.85 | 0 | False | 25.87 | 58.53 | 0.01 | 0.08 |
| 326 | 50 | 1 | 46.46 | 0 | True | — | — | — | 0.04 |
| 326 | 200 | 0 | 256.99 | 0 | False | 31.00 | 43.78 | 0.02 | 0.06 |
| 326 | 200 | 1 | 34.23 | 0 | True | — | — | — | 0.05 |
| 6 | 50 | 0 | 122.51 | 50 | False | 17.11 | 28.10 | 0.18 | 1.08 |
| 6 | 50 | 1 | 29.26 | 50 | True | — | — | — | 0.99 |
| 6 | 200 | 0 | 122.57 | 200 | False | 17.37 | 27.18 | 0.31 | 3.41 |
| 6 | 200 | 1 | 36.68 | 200 | True | — | — | — | 3.32 |
| 59 | 50 | 0 | 328.22 | 50 | False | 16.49 | 98.11 | 0.09 | 1.24 |
| 59 | 50 | 1 | 29.26 | 50 | True | — | — | — | 1.28 |
| 59 | 200 | 0 | 291.65 | 200 | False | 15.40 | 108.20 | 0.25 | 5.82 |
| 59 | 200 | 1 | 44.80 | 200 | True | — | — | — | 5.81 |

## Frontend observado, sem alterações

Staging próprio em http://127.0.0.1:8092, API orbita-canvas-stage-api-t21. As portas 8091 (tarefa 20) e 8093 (legados) já estavam ocupadas: foram preservadas. Foi usado scripts/canvas-stage.sh up com STAGE_NAME=orbita-canvas-stage-t21, STAGE_PORT=8092 e API_UPSTREAM=orbita-canvas-stage-api-t21:8000. Somente a API criada por esta tarefa foi reiniciada para carregar o código.

Playwright real, relatório 6, sem mock de dados: abertura inicial 1.794 ms; amostra de 50 linhas em 229 ms do evento de clique à resposta e 148 ms até o quadro seguinte, cerca de 377 ms ao todo. A requisição de prévia levou 151 ms no navegador. A automação completa levou 440 ms e não tentou salvar/ativar relatório. JS/CSS locais ficaram em 35–91 ms. Em uma abertura anterior, duas folhas de fontes externas levaram 2,1–2,2 s e a navegação completa 6,7 s: isso é carregamento do front, não duração da consulta SQL. Hospedar as fontes localmente é recomendação para a tarefa de frontend, sem modificação aqui.

A medição de clique captura o evento DOM para excluir o tempo em que o Playwright espera o botão estar acionável. response_to_frame inclui o custo da instrumentação e dois requestAnimationFrame; não é medição isolada do React. Consultar browser.jsonl.

## EXPLAIN (ANALYZE, BUFFERS), somente SELECT

Nos primeiros planos de 323/326, os índices de unidade de cases, sourceevents e messages já são usados; várias ramificações nem executam porque não há linhas no filtro. No 6, seq scan de cerca de 2.473 casos/eventos e dois usuários custa apenas 7,90 ms: índice adicional não se justifica por esse plano.

Nos indicadores mais caros, a CTE selected é reutilizada e a ligação das mensagens usa OR com fallback correlacionado. Há scans de 2–4 mil linhas, sem derramamento em arquivos temporários. A reescrita substitui a junção de OR por dois caminhos: case_id presente e fallback por appointment_id somente quando case_id é nulo. O mapeamento tem no máximo uma linha por appointment_id. Não há N+1 de rede demonstrado nesses SELECTs; há trabalho repetido dentro do plano e coleta nativa repetida entre requisições. SELECT * é usado nas CTEs/encapsulamento preservando o contrato; o desperdício principal da amostra foi corrigido com limite no banco.

Repetição de planos para toda origem que ultrapassou 100 ms em execute na linha de base:
| Origem | Consulta antes ms | Consulta depois ms | Planejamento antes/depois ms | Hits antes/depois | Leituras físicas antes/depois | Temporários escritos antes/depois |
|---|---:|---:|---|---|---|---|
| 57 | 414.29 | 55.04 | 6.43/5.14 | 1007/1009 | 0/0 | 0/0 |
| 58 | 406.85 | 61.48 | 4.49/6.68 | 1007/1009 | 0/0 | 0/0 |
| 59 | 438.67 | 57.90 | 5.84/5.39 | 1007/1009 | 0/0 | 0/0 |
| 90 | 574.43 | 93.39 | 7.96/10.14 | 1061/1063 | 0/0 | 0/0 |
| 92 | 454.21 | 71.03 | 7.65/5.86 | 1061/1063 | 0/0 | 0/0 |

As consultas Oracle dos componentes externos não suportam EXPLAIN (ANALYZE, BUFFERS) de PostgreSQL. Não foram criadas plan tables, índices ou alterados objetos externos para forçar essa análise. Recomenda-se plano de execução com o responsável pelo Oracle para os componentes 366/367/368 e as consultas de exames; a autorização desta tarefa restringe correções ao Orbita.

## PostgreSQL

| Item | Observação |
|---|---|
| Banco | 80 MB, PostgreSQL 17 |
| shared_buffers | 128 MiB |
| work_mem | 4 MiB por operação |
| effective_cache_size | 4 GiB, estimativa do planejador |
| max_connections | 100 |
| Container | Memory=0, NanoCpus=0, CpuQuota=0: sem limite explícito; ainda compartilha a VM |
| Atividade inicial | 3 idle; 5 processos internos esperando Activity; somente a coleta ativa |
| Nova amostra | 6 idle; zero sessões bloqueadas por outro PID |
| Extensões | apenas plpgsql; pg_stat_statements ausente, shared_preload_libraries vazio |

Recomendar pg_stat_statements numa manutenção coordenada (exige configuração/restart se não carregado), não habilitar agora. Sem evidência de spill para subir work_mem, nem esgotamento para aumentar max_connections. shared_buffers de 128 MiB é conservador; testar 256–512 MiB com orçamento da VM compartilhada, não alterar por palpite ou pelo tamanho do banco.

pg_stat_user_tables: messaging_message tinha 3.527 tuplas vivas/491 mortas, scheduling_appointment 2.718/181, operations_reportdefinition 396/54, operations_reportconnection 31/47 e core_unit 6/30. Autovacuum/analyze recentes nas tabelas maiores (24–27/10). Os números são estimativas e não medem bloat físico; não há fundamento para VACUUM FULL/REINDEX ou mudança global de autovacuum. Acompanhar as tabelas pequenas com churn; não se executou vacuum manual.

## Servidor, disco e E/S

Raiz: 48 GiB, 38 GiB usados, 7,9 GiB disponíveis, 83%. Inodes 23% usados (706.036 de 3.145.728). RAM total 9,7 GiB, vários GiB disponíveis; swap usada aproximadamente 452 MiB sem entrada/saída relevante durante vmstat. A amostra vmstat teve 60–62% de CPU ociosa e 14–15% em iowait. O load 19 foi relato anterior, não prova de saturação constante.

iostat/sysstat não estão instalados. Foram usados vmstat e diferença de /proc/diskstats por dois segundos: sda 85,43% ocupado, await médio 41,46 ms, leitura 0,189 MiB/s e escrita 0,098 MiB/s. É uma amostra curta com outras sessões trabalhando, inclusive nossas inspeções; não mede um SLA nem permite atribuir tudo ao PostgreSQL. A baixa vazão com espera alta justifica investigar datastore/IOPS/latência do host VMware. O diagnóstico paralelo [da tarefa 23](canvas-task23-servidor.md) deve ser consultado pelo administrador se disponível; a coleta desta tarefa não mudou infraestrutura.

Processos: não havia orbita-tests-run ativo ao iniciar pytest. Os dois processos Node antigos observados (4094175 e 4094183, pai 4094161) pertencem a vigilant_allen, com /home/sti/build/dnv-preenchimento montado em /app e comando node --test testes/*.test.js; estavam há seis dias. O container mostrou cerca de 10% de CPU numa amostra, não CPU total saturada. Nenhum processo desse container ou de terceiros foi interrompido. Apenas uma repetição de diagnóstico desta tarefa foi interrompida para evitar repetir nove vezes o mesmo timeout externo de 30 s.

### Limpeza proposta — nenhuma exclusão executada

Tamanhos são instantâneos, parcialmente compartilhados, não somar como espaço garantido. A decisão de limpeza é do Danilo.

| Item | Tamanho observado | Proposta após aprovação |
|---|---:|---|
| Imagens Docker | 85 imagens, 15,27 GB; 9,577 GB reportados recuperáveis | Listar imagens sem container e tags antigas de staging/build; preservar produção e versões de rollback. Remover somente IDs aprovados. |
| Containers Docker | 44 totais/25 ativos; 1,807 GB, 1,422 GB recuperáveis | Revisar containers parados e artefatos de testes já terminados; preservar evidências necessárias. |
| Cache de build | 1,657 GB totais; 130,2 MB recuperáveis na coleta | Remover apenas cache de build não utilizado após aprovação; reconstruções podem ficar mais lentas. |
| Volumes | 647,4 MB totais; 83,46 MB marcados recuperáveis | Não remover por “unused”: identificar dono/conteúdo e ter backup antes. Volumes de Postgres, Redis e sessões não são limpeza segura. |
| /var/lib/containerd | cerca de 15 GB | Principalmente imagens/snapshots geridos pelo Docker; não apagar diretórios manualmente. Sobrepõe o inventário de imagens. |
| /var/lib/docker/containers | 27 MB | Logs de containers são parcela pequena; confirmar retenção e rotação na manutenção. |
| /var/log | 216 MB; journal 212,7 MB | Definir retenção com Danilo; teto de 100 MB liberaria aproximadamente 113 MB, perdendo histórico antigo. |
| /var/lib/docker/buildkit | 128 MB | Não somar automaticamente ao cache de build acima. |
| Backup legado existente | /root/backup-legado-2026-10-28-040110.sql, 58.799.013 bytes (~56 MiB) | Manter; retenção/remoção só após política e backup alternativo verificado. |
| Arquivos do projeto | files 22 MB; artifacts 5,7 MB | Pouco ganho; preservar anexos/evidências. |
| Outros caches | /root/.cache 7,5 MB; apt archives 40 KB | Ganho irrelevante; não priorizar. |

Não executar docker system prune/volume prune genérico. Não tocar chatwoot, tuya-iot, dnv-preenchimento ou whats-monit.

## Validação e reprodução

87 testes passaram em staging/test DB ([registro](canvas-task21-evidencias/tests.txt)), incluindo testes de limite SQL com comentário após delimitador, exportação sem limite de amostra, correspondência estrita da reescrita, paginação e última página, cache de objetos nativos com chaves tupla, entrada alterada, autorização revogada, conexão revogada e timeout sem persistir configuração. Suites: test_canvas_task21_performance.py, test_canvas_source_preview.py, test_canvas_preview_columns.py, test_report_canvas.py, test_report_canvas_ports.py. Antes de cada pytest foi verificado que não havia orbita-tests-run ativo. Não houve alteração de frontend desta tarefa; o build do staging passou com os arquivos compartilhados presentes.

- scripts/canvas-task21-measure.py: executar via python manage.py shell em container de staging, nunca em paralelo com carga pesada. Saída contém somente IDs, contagens e tempos, sem células/credenciais. O inventário usa defaults; ajustar parâmetros obrigatórios para uma segunda medição identificada.
- scripts/canvas-task21-compare.py: copiar before.json para /tmp/t21-baseline.json no container de staging, executar via manage.py shell e recolher /tmp/t21-compare.json. Somente SELECT/EXPLAIN em conexão read-only.
- Evidências completas: [antes](canvas-task21-evidencias/before.json), [depois](canvas-task21-evidencias/after.json), [comparação e planos](canvas-task21-evidencias/compare.json), [HTTP](canvas-task21-evidencias/http.json), [navegador](canvas-task21-evidencias/browser.jsonl).
- Não houve deploy em produção. A ativação do código exige a rotina de deploy do responsável; reiniciar/reconstruir produção foi expressamente proibido nesta tarefa.
- Pendências recomendadas: investigar I/O do host, revisar consultas Oracle com o responsável da origem (inclui 268/269 e indicadores com datas), homologar conexões desativadas, fornecer datas obrigatórias e integrar controles de paginação/total aproximado na interface pela sessão de frontend.

## Tempos por fonte — antes e depois

Unidade: ms. Identificação “relatório/fonte → origem”; a origem é o relatório consultado. “API” é endpoint interno renderizado; SQL/conn/fetch vêm do driver, não substituem EXPLAIN. O antes “erro*” deve ser lido com a limitação do medidor acima. Dados completos preservam também elapsed_ms/status/handler/cache_hit/reused.

| Relatório/fonte → origem | Motor declarado | API antes | API depois | SQL antes/depois | Conexão antes/depois | Fetch antes/depois | Serialização depois | Estado antes/depois |
|---|---|---:|---:|---|---|---|---:|---|
| 1/dados → 1 | postgres | 844.16 | 370.79 | 20.07/20.81 | 24.64/34.22 | 0.05/0.03 | 0.28 | 200/200 |
| 2/dados → 2 | postgres | 840.33 | 85.25 | 30.47/18.13 | 22.31/19.48 | 0.03/0.09 | 0.17 | 200/200 |
| 3/dados → 3 | postgres | 752.50 | 174.21 | 29.15/31.52 | 18.14/18.13 | 3.22/0.08 | 1.00 | 200/200 |
| 4/dados → 4 | postgres | 423.22 | 95.03 | 20.53/21.07 | 15.30/23.50 | 0.02/0.01 | 0.06 | 200/200 |
| 5/dados → 5 | postgres | 372.13 | 105.36 | 25.86/28.37 | 24.50/18.93 | 0.01/0.02 | 0.09 | 200/200 |
| 6/dados → 6 | postgres | 244.81 | 96.62 | 30.28/28.25 | 23.24/16.39 | 2.98/0.07 | 1.56 | 200/200 |
| 8/dados → 8 | postgres | 272.73 | 110.07 | 35.72/29.68 | 16.35/17.65 | 2.87/0.08 | 1.00 | 200/200 |
| 9/dados → 9 | postgres | 184.08 | 97.10 | 28.05/28.16 | 19.50/19.49 | 3.76/0.23 | 1.35 | 200/200 |
| 10/dados → 10 | postgres | 276.74 | 86.65 | 22.13/16.99 | 19.40/19.40 | 0.02/0.01 | 0.19 | 200/200 |
| 11/dados → 11 | postgres | 93.28 | 92.96 | 22.82/20.36 | 18.04/20.77 | 0.02/0.01 | 0.05 | 200/200 |
| 12/dados → 12 | postgres | 101.32 | 80.85 | 19.14/19.54 | 22.75/19.74 | 0.02/0.02 | 0.07 | 200/200 |
| 13/dados → 13 | postgres | 733.99 | 106.95 | 28.40/37.57 | 23.31/19.17 | 0.01/0.01 | 0.05 | 200/200 |
| 14/dados → 14 | postgres | 71.63 | 107.57 | 17.46/21.93 | 15.99/24.16 | 0.01/0.01 | 0.13 | 200/200 |
| 15/dados → 15 | postgres | 90.80 | 116.87 | 22.86/20.16 | 17.01/21.10 | 0.02/0.01 | 0.12 | 200/200 |
| 16/dados → 16 | postgres | 104.81 | 105.11 | 25.60/25.38 | 20.13/21.15 | 0.02/0.01 | 0.07 | 200/200 |
| 17/dados → 17 | postgres | 451.99 | 94.91 | 22.60/20.69 | 18.25/21.47 | 0.02/0.01 | 0.09 | 200/200 |
| 19/dados → 19 | postgres | 105.50 | 99.45 | 20.89/25.01 | 17.72/18.66 | 0.02/0.01 | 0.08 | 200/200 |
| 20/dados → 20 | postgres | 96.49 | 108.31 | 22.86/24.02 | 19.37/21.86 | 0.04/0.07 | 0.21 | 200/200 |
| 21/dados → 21 | postgres | 106.54 | 128.55 | 23.63/27.79 | 18.68/25.07 | 0.44/0.12 | 2.66 | 200/200 |
| 22/dados → 22 | postgres | 135.24 | 164.58 | 34.38/42.09 | 19.19/36.22 | 1.17/0.12 | 1.65 | 200/200 |
| 23/dados → 23 | postgres | 110.13 | 112.63 | 24.06/25.23 | 26.72/30.50 | 0.57/0.12 | 1.67 | 200/200 |
| 24/dados → 24 | postgres | 458.52 | 111.98 | 19.89/28.78 | 21.94/19.81 | 0.02/0.02 | 0.20 | 200/200 |
| 25/dados → 25 | postgres | 112.22 | 102.53 | 30.83/24.58 | 21.39/22.28 | 0.19/0.02 | 0.18 | 200/200 |
| 26/dados → 26 | postgres | 111.17 | 98.58 | 20.56/23.40 | 22.20/21.63 | 0.42/0.10 | 1.65 | 200/200 |
| 28/dados → 28 | oracle | 28.57 | 210.76 | —/— | —/— | —/— | — | erro*/400 |
| 28/resumo → 28 | oracle | 24.26 | 22.88 | —/— | —/— | —/— | — | erro*/400 |
| 33/metadata → 33 | oracle | 43.13 | 720.24 | —/— | —/— | —/— | — | erro*/400 |
| 33/general → 33 | oracle | 34.12 | 400.04 | —/— | —/— | —/— | — | erro*/400 |
| 33/sus → 33 | oracle | 34.21 | 400.07 | —/— | —/— | —/— | — | erro*/400 |
| 33/convenio → 33 | oracle | 29.65 | 317.66 | —/— | —/— | —/— | — | erro*/400 |
| 33/sectors → 33 | oracle | 40.76 | 443.36 | —/— | —/— | —/— | — | erro*/400 |
| 33/attendances → 33 | oracle | 35.30 | 333.06 | —/— | —/— | —/— | — | erro*/400 |
| 33/elective → 33 | oracle | 25.89 | 436.78 | —/— | —/— | —/— | — | erro*/400 |
| 33/urgent → 33 | oracle | 27.89 | 365.03 | —/— | —/— | —/— | — | erro*/400 |
| 33/surgeries → 33 | oracle | 26.63 | 401.03 | —/— | —/— | —/— | — | erro*/400 |
| 50/metadata → 50 | oracle | 49.74 | 840.50 | —/— | —/— | —/— | — | erro*/400 |
| 50/stays → 50 | oracle | 59.25 | 114.62 | —/— | —/— | —/— | — | erro*/400 |
| 50/specialties → 50 | oracle | 41.23 | 78.61 | —/— | —/— | —/— | — | erro*/400 |
| 50/ratios → 50 | oracle | 45.63 | 108.96 | —/— | —/— | —/— | — | erro*/400 |
| 50/counts → 50 | oracle | 64.82 | 109.50 | —/— | —/— | —/— | — | erro*/400 |
| 50/daily → 50 | oracle | 58.85 | 112.21 | —/— | —/— | —/— | — | erro*/400 |
| 50/opinions_months → 50 | oracle | 52.55 | 95.61 | —/— | —/— | —/— | — | erro*/400 |
| 50/opinions_days → 50 | oracle | 52.45 | 110.54 | —/— | —/— | —/— | — | erro*/400 |
| 57/dados → 57 | postgres | 1167.67 | 312.17 | 980.53/120.39 | 16.21/19.30 | 0.03/0.04 | 0.62 | 200/200 |
| 58/dados → 58 | postgres | 723.70 | 462.41 | 453.22/128.86 | 17.38/16.53 | 0.02/0.03 | 0.46 | 200/200 |
| 59/dados → 59 | postgres | 685.77 | 269.42 | 437.59/94.54 | 19.81/18.64 | 4.45/0.09 | 1.73 | 200/200 |
| 60/part0 → 59 | postgres | 675.23 | 222.25 | 454.74/104.22 | 19.49/19.40 | 1.90/0.12 | 1.27 | 200/200 |
| 60/part1 → 57 | postgres | 627.72 | 213.63 | 502.69/100.30 | 17.31/17.26 | 0.04/0.03 | 0.42 | 200/200 |
| 63/metadata → 63 | native | 19587.79 | 9718.39 | 9595.37/9204.11 | 7867.48/165.58 | 37.33/53.30 | 0.18 | 200/200 |
| 63/overview → 63 | native | 9309.22 | 54.19 | 9090.17/— | 28.21/— | 42.40/— | 0.30 | 200/200 |
| 63/chart → 63 | native | 10184.31 | 44.06 | 9314.93/— | 24.16/— | 52.25/— | 0.34 | 200/200 |
| 63/providers → 63 | native | 10044.95 | 47.70 | 9371.18/— | 27.81/— | 38.45/— | 2.09 | 200/200 |
| 65/metadata → 33 | oracle | 43.13 | 720.24 | —/— | —/— | —/— | — | erro*/400 |
| 65/general → 33 | oracle | 34.12 | 400.04 | —/— | —/— | —/— | — | erro*/400 |
| 65/sus → 33 | oracle | 34.21 | 400.07 | —/— | —/— | —/— | — | erro*/400 |
| 65/convenio → 33 | oracle | 29.65 | 317.66 | —/— | —/— | —/— | — | erro*/400 |
| 65/sectors → 33 | oracle | 40.76 | 443.36 | —/— | —/— | —/— | — | erro*/400 |
| 65/attendances → 33 | oracle | 35.30 | 333.06 | —/— | —/— | —/— | — | erro*/400 |
| 65/surgeries → 33 | oracle | 26.63 | 401.03 | —/— | —/— | —/— | — | erro*/400 |
| 89/dados → 89 | postgres | 253.23 | 193.57 | 40.37/40.43 | 21.23/18.26 | 0.02/0.02 | 0.07 | 200/200 |
| 90/dados → 90 | postgres | 653.86 | 286.22 | 448.50/111.41 | 15.78/23.70 | 0.03/0.03 | 0.16 | 200/200 |
| 91/dados → 91 | postgres | 217.15 | 183.07 | 47.30/38.51 | 20.16/17.55 | 0.02/0.02 | 0.07 | 200/200 |
| 92/dados → 92 | postgres | 626.79 | 261.77 | 467.45/116.40 | 18.36/15.09 | 0.03/0.02 | 0.17 | 200/200 |
| 93/part0 → 90 | postgres | 597.04 | 207.44 | 495.86/101.38 | 17.80/18.92 | 0.06/0.03 | 0.17 | 200/200 |
| 93/part1 → 91 | postgres | 158.22 | 143.36 | 42.16/40.56 | 19.07/24.88 | 0.02/0.02 | 0.06 | 200/200 |
| 93/part2 → 92 | postgres | 573.98 | 199.45 | 471.54/97.97 | 19.75/17.11 | 0.03/0.02 | 0.19 | 200/200 |
| 94/dados → 94 | postgres | 241.35 | 211.02 | 78.53/60.00 | 19.54/18.12 | 0.03/0.04 | 0.14 | 200/200 |
| 95/dados → 95 | postgres | 206.73 | 198.87 | 39.88/40.08 | 18.37/22.73 | 0.02/0.02 | 0.08 | 200/200 |
| 96/dados → 96 | postgres | 240.49 | 324.52 | 60.26/69.78 | 23.39/18.68 | 0.02/0.08 | 0.16 | 200/200 |
| 97/dados → 97 | postgres | 298.98 | 206.00 | 47.59/42.77 | 15.41/18.00 | 0.02/0.06 | 0.09 | 200/200 |
| 98/part0 → 94 | postgres | 463.27 | 177.45 | 85.05/63.20 | 20.11/20.11 | 0.03/0.03 | 0.18 | 200/200 |
| 98/part1 → 97 | postgres | 313.84 | 152.25 | 39.12/41.07 | 18.64/21.12 | 0.02/0.01 | 0.06 | 200/200 |
| 98/part2 → 96 | postgres | 165.98 | 161.92 | 68.12/59.77 | 18.76/17.15 | 0.02/0.02 | 0.18 | 200/200 |
| 98/part3 → 95 | postgres | 139.88 | 157.55 | 39.08/44.38 | 25.76/19.05 | 0.02/0.01 | 0.07 | 200/200 |
| 99/part0 → 90 | postgres | 597.04 | 207.44 | 495.86/101.38 | 17.80/18.92 | 0.06/0.03 | 0.17 | 200/200 |
| 99/part1 → 94 | postgres | 161.00 | 198.52 | 63.68/85.94 | 17.35/20.55 | 0.03/0.03 | 0.24 | 200/200 |
| 100/dados → 100 | postgres | 199.91 | 204.64 | 46.06/45.20 | 17.49/19.36 | 0.02/0.01 | 0.06 | 200/200 |
| 101/part0 → 100 | postgres | 136.96 | 160.48 | 41.40/47.06 | 16.36/19.30 | 0.01/0.02 | 0.06 | 200/200 |
| 101/part1 → 103 | postgres | 182.63 | 201.18 | 38.91/53.14 | 19.92/17.92 | 0.03/0.01 | 0.07 | 200/200 |
| 102/dados → 102 | postgres | 180.70 | 216.62 | 41.58/54.22 | 20.30/20.23 | 0.02/0.02 | 0.32 | 200/200 |
| 103/dados → 103 | postgres | 166.59 | 189.78 | 45.56/51.91 | 28.87/17.33 | 0.02/0.02 | 0.07 | 200/200 |
| 104/part0 → 105 | postgres | 222.07 | 232.53 | 47.34/48.50 | 22.66/25.76 | 0.02/0.02 | 0.10 | 200/200 |
| 104/part1 → 107 | postgres | 201.13 | 220.61 | 42.07/54.49 | 17.59/23.09 | 0.01/0.02 | 0.09 | 200/200 |
| 105/dados → 105 | postgres | 166.04 | 215.94 | 58.74/67.61 | 16.57/19.37 | 0.02/0.02 | 0.16 | 200/200 |
| 106/dados → 106 | postgres | 202.25 | 282.72 | 56.00/59.29 | 20.10/22.94 | 0.02/0.02 | 0.19 | 200/200 |
| 107/dados → 107 | postgres | 154.00 | 180.70 | 43.58/51.41 | 28.18/19.54 | 0.01/0.02 | 0.07 | 200/200 |
| 108/part0 → 100 | postgres | 136.96 | 160.48 | 41.40/47.06 | 16.36/19.30 | 0.01/0.02 | 0.06 | 200/200 |
| 108/part1 → 103 | postgres | 182.63 | 201.18 | 38.91/53.14 | 19.92/17.92 | 0.03/0.01 | 0.07 | 200/200 |
| 108/part2 → 105 | postgres | 156.44 | 163.02 | 42.67/54.32 | 18.18/22.53 | 0.02/0.02 | 0.06 | 200/200 |
| 108/part3 → 107 | postgres | 133.54 | 142.92 | 37.53/41.93 | 16.24/18.60 | 0.03/0.02 | 0.13 | 200/200 |
| 108/part4 → 110 | postgres | 196.20 | 224.11 | 48.58/51.46 | 14.78/20.39 | 0.02/0.02 | 0.07 | 200/200 |
| 108/part5 → 112 | postgres | 198.29 | 250.23 | 53.77/39.65 | 18.25/24.16 | 0.01/0.02 | 0.07 | 200/200 |
| 108/part6 → 114 | postgres | 188.23 | 219.97 | 46.94/47.58 | 16.23/16.36 | 0.02/0.02 | 0.06 | 200/200 |
| 108/part7 → 116 | postgres | 210.75 | 327.53 | 53.10/42.61 | 17.04/30.18 | 0.02/0.02 | 0.06 | 200/200 |
| 108/part8 → 118 | postgres | 198.93 | 205.02 | 43.72/46.17 | 22.20/20.56 | 0.02/0.02 | 0.06 | 200/200 |
| 108/part9 → 120 | postgres | 198.95 | 209.09 | 45.34/44.41 | 20.09/19.29 | 0.02/0.02 | 0.06 | 200/200 |
| 108/part10 → 122 | postgres | 335.96 | 203.20 | 54.41/43.86 | 23.37/17.72 | 0.02/0.02 | 0.13 | 200/200 |
| 108/part11 → 124 | postgres | 211.58 | 186.07 | 42.46/35.69 | 23.84/21.54 | 0.02/0.02 | 0.08 | 200/200 |
| 108/part12 → 164 | postgres | 234.03 | 205.93 | 58.47/49.22 | 21.05/19.26 | 0.02/0.02 | 0.08 | 200/200 |
| 108/part13 → 166 | postgres | 239.85 | 194.10 | 56.84/51.23 | 27.86/16.26 | 0.02/0.01 | 0.14 | 200/200 |
| 108/part14 → 140 | postgres | 251.98 | 231.62 | 52.16/61.56 | 22.10/19.97 | 0.05/0.02 | 0.08 | 200/200 |
| 108/part15 → 142 | postgres | 256.01 | 213.48 | 58.18/44.22 | 20.20/22.09 | 0.02/0.02 | 0.07 | 200/200 |
| 108/part16 → 136 | postgres | 357.03 | 210.63 | 53.26/45.47 | 32.49/19.84 | 0.03/0.02 | 0.13 | 200/200 |
| 108/part17 → 138 | postgres | 233.29 | 207.38 | 44.42/50.56 | 18.82/15.53 | 0.02/0.02 | 0.07 | 200/200 |
| 108/part18 → 148 | postgres | 253.74 | 226.93 | 59.67/52.64 | 30.40/25.58 | 0.03/0.02 | 0.07 | 200/200 |
| 108/part19 → 150 | postgres | 250.41 | 215.88 | 50.35/51.97 | 23.94/23.77 | 0.01/0.02 | 0.09 | 200/200 |
| 108/part20 → 152 | postgres | 245.14 | 248.29 | 57.26/51.08 | 24.19/25.65 | 0.02/0.01 | 0.08 | 200/200 |
| 108/part21 → 154 | postgres | 212.81 | 244.81 | 53.27/38.27 | 18.34/24.94 | 0.03/0.02 | 0.07 | 200/200 |
| 108/part22 → 160 | postgres | 237.59 | 212.37 | 44.36/50.66 | 28.76/17.67 | 0.02/0.01 | 0.06 | 200/200 |
| 108/part23 → 162 | postgres | 202.48 | 344.93 | 49.31/45.06 | 17.73/20.85 | 0.02/0.02 | 0.13 | 200/200 |
| 108/part24 → 156 | postgres | 210.82 | 209.57 | 44.04/47.24 | 32.02/19.83 | 0.01/0.03 | 0.09 | 200/200 |
| 108/part25 → 158 | postgres | 198.71 | 199.86 | 45.08/39.07 | 23.80/19.39 | 0.03/0.02 | 0.14 | 200/200 |
| 108/part26 → 144 | postgres | 194.42 | 213.04 | 44.79/50.15 | 15.53/19.26 | 0.01/0.02 | 0.08 | 200/200 |
| 108/part27 → 146 | postgres | 331.02 | 210.94 | 53.31/41.68 | 17.70/19.02 | 0.02/0.02 | 0.16 | 200/200 |
| 108/part28 → 265 | postgres | 215.03 | 197.54 | 47.48/46.11 | 17.45/15.99 | 0.02/0.03 | 0.08 | 200/200 |
| 108/part29 → 267 | postgres | 189.36 | 184.57 | 39.36/42.74 | 20.88/15.41 | 0.02/0.02 | 0.07 | 200/200 |
| 109/part0 → 110 | postgres | 147.97 | 152.34 | 44.67/47.26 | 19.92/16.46 | 0.02/0.02 | 0.07 | 200/200 |
| 109/part1 → 112 | postgres | 1547.33 | 143.24 | 39.64/52.55 | 18.55/15.79 | 0.02/0.02 | 0.10 | 200/200 |
| 110/dados → 110 | postgres | 1430.58 | 156.78 | 55.86/51.87 | 19.56/16.29 | 0.01/0.02 | 0.08 | 200/200 |
| 111/dados → 111 | postgres | 613.47 | 200.76 | 56.97/50.11 | 17.30/21.66 | 0.02/0.02 | 0.32 | 200/200 |
| 112/dados → 112 | postgres | 260.95 | 144.07 | 51.42/38.44 | 38.31/16.78 | 0.01/0.02 | 0.08 | 200/200 |
| 113/part0 → 114 | postgres | 165.49 | 150.21 | 56.43/48.54 | 21.96/17.99 | 0.02/0.01 | 0.06 | 200/200 |
| 113/part1 → 116 | postgres | 158.82 | 179.48 | 51.25/69.92 | 16.03/19.49 | 0.02/0.02 | 0.08 | 200/200 |
| 114/dados → 114 | postgres | 148.52 | 183.52 | 44.21/45.62 | 17.08/17.51 | 0.05/0.18 | 0.08 | 200/200 |
| 115/dados → 115 | postgres | 219.09 | 262.83 | 45.46/62.38 | 19.34/42.30 | 0.02/0.02 | 0.13 | 200/200 |
| 116/dados → 116 | postgres | 142.94 | 147.48 | 44.75/39.24 | 17.38/20.83 | 0.01/0.02 | 0.06 | 200/200 |
| 117/part0 → 118 | postgres | 1375.19 | 176.85 | 55.63/52.08 | 23.68/24.71 | 0.01/0.02 | 0.08 | 200/200 |
| 117/part1 → 120 | postgres | 279.19 | 151.99 | 46.94/39.38 | 20.46/20.84 | 0.02/0.01 | 0.06 | 200/200 |
| 118/dados → 118 | postgres | 171.83 | 186.96 | 45.46/67.91 | 20.40/18.06 | 0.02/0.02 | 0.08 | 200/200 |
| 119/dados → 119 | postgres | 297.59 | 213.47 | 43.73/47.46 | 23.37/21.20 | 0.02/0.02 | 0.15 | 200/200 |
| 120/dados → 120 | postgres | 158.20 | 168.45 | 46.57/42.72 | 16.48/20.40 | 0.02/0.01 | 0.06 | 200/200 |
| 121/part0 → 122 | postgres | 285.54 | 185.63 | 46.81/58.60 | 15.94/18.37 | 0.02/0.02 | 0.08 | 200/200 |
| 121/part1 → 124 | postgres | 145.40 | 180.06 | 46.84/49.24 | 18.07/22.84 | 0.01/0.02 | 0.39 | 200/200 |
| 122/dados → 122 | postgres | 155.64 | 175.96 | 52.90/53.27 | 17.58/20.45 | 0.02/0.02 | 0.08 | 200/200 |
| 123/dados → 123 | postgres | 199.06 | 223.10 | 50.84/60.08 | 20.71/19.50 | 0.03/0.02 | 0.27 | 200/200 |
| 124/dados → 124 | postgres | 139.35 | 308.45 | 40.73/41.46 | 16.93/21.87 | 0.02/0.01 | 0.09 | 200/200 |
| 125/dados → 125 | postgres | 1048.04 | 227.19 | 59.30/46.61 | 15.63/17.41 | 0.02/0.02 | 0.06 | 200/200 |
| 126/part0 → 125 | postgres | 136.17 | 192.43 | 45.19/64.32 | 15.01/17.10 | 0.01/0.02 | 0.08 | 200/200 |
| 126/part1 → 129 | postgres | 371.44 | 261.93 | 67.51/64.84 | 24.29/23.47 | 0.02/0.01 | 0.09 | 200/200 |
| 126/part2 → 128 | postgres | 208.25 | 218.90 | 45.55/59.76 | 19.10/19.23 | 0.02/0.02 | 0.13 | 200/200 |
| 126/part3 → 127 | postgres | 256.74 | 243.01 | 52.71/50.91 | 23.57/29.12 | 0.02/0.02 | 0.07 | 200/200 |
| 127/dados → 127 | postgres | 2714.91 | 164.26 | 50.86/51.92 | 20.52/20.34 | 0.02/0.02 | 0.10 | 200/200 |
| 128/dados → 128 | postgres | 203.64 | 170.15 | 53.45/55.96 | 18.22/23.91 | 0.02/0.02 | 0.12 | 200/200 |
| 129/dados → 129 | postgres | 200.62 | 149.29 | 50.13/39.26 | 23.31/15.80 | 0.01/0.02 | 0.11 | 200/200 |
| 130/dados → 130 | postgres | 998.76 | 207.99 | 57.09/47.16 | 20.11/18.88 | 0.02/0.01 | 0.06 | 200/200 |
| 131/part0 → 130 | postgres | 339.53 | 150.98 | 61.03/42.60 | 19.54/15.67 | 0.02/0.02 | 0.06 | 200/200 |
| 131/part1 → 134 | postgres | 355.73 | 208.70 | 48.21/40.18 | 19.48/16.02 | 0.03/0.02 | 0.06 | 200/200 |
| 131/part2 → 133 | postgres | 460.77 | 185.76 | 47.33/42.37 | 21.60/18.03 | 0.02/0.02 | 0.13 | 200/200 |
| 131/part3 → 132 | postgres | 306.78 | 182.99 | 35.66/40.49 | 16.93/20.83 | 0.02/0.02 | 0.08 | 200/200 |
| 132/dados → 132 | postgres | 403.08 | 150.57 | 44.70/48.70 | 18.60/16.97 | 0.02/0.02 | 0.08 | 200/200 |
| 133/dados → 133 | postgres | 446.54 | 155.41 | 43.41/50.60 | 18.52/19.17 | 0.04/0.02 | 0.15 | 200/200 |
| 134/dados → 134 | postgres | 684.46 | 156.05 | 44.01/45.15 | 18.23/18.47 | 0.01/0.01 | 0.08 | 200/200 |
| 135/part0 → 90 | postgres | 597.04 | 207.44 | 495.86/101.38 | 17.80/18.92 | 0.06/0.03 | 0.17 | 200/200 |
| 135/part1 → 94 | postgres | 161.00 | 198.52 | 63.68/85.94 | 17.35/20.55 | 0.03/0.03 | 0.24 | 200/200 |
| 135/part2 → 130 | postgres | 341.47 | 147.61 | 45.63/48.13 | 20.27/15.85 | 0.01/0.02 | 0.08 | 200/200 |
| 135/part3 → 125 | postgres | 282.10 | 152.54 | 52.57/48.39 | 23.45/16.81 | 0.01/0.02 | 0.09 | 200/200 |
| 136/dados → 136 | postgres | 271.56 | 150.55 | 56.84/48.13 | 18.02/16.20 | 0.02/0.02 | 0.12 | 200/200 |
| 137/dados → 137 | postgres | 239.77 | 246.29 | 47.41/51.02 | 17.93/28.84 | 2.76/0.02 | 0.20 | 200/200 |
| 138/dados → 138 | postgres | 147.41 | 161.57 | 48.28/54.17 | 20.53/18.90 | 0.01/0.09 | 0.07 | 200/200 |
| 139/part0 → 136 | postgres | 163.52 | 180.09 | 49.98/51.44 | 19.19/17.76 | 0.02/0.02 | 0.09 | 200/200 |
| 139/part1 → 138 | postgres | 143.91 | 173.81 | 37.81/54.21 | 19.80/18.62 | 0.02/0.01 | 0.06 | 200/200 |
| 140/dados → 140 | postgres | 219.13 | 187.30 | 71.67/58.59 | 19.26/27.23 | 0.02/0.02 | 0.09 | 200/200 |
| 141/dados → 141 | postgres | 317.31 | 223.32 | 47.54/60.40 | 22.62/16.90 | 0.02/0.07 | 0.24 | 200/200 |
| 142/dados → 142 | postgres | 135.69 | 163.25 | 34.26/44.96 | 19.74/21.68 | 0.01/0.02 | 0.08 | 200/200 |
| 143/part0 → 140 | postgres | 268.77 | 319.84 | 40.78/62.54 | 14.17/16.78 | 0.02/0.02 | 0.14 | 200/200 |
| 143/part1 → 142 | postgres | 220.64 | 179.73 | 37.49/46.78 | 14.26/23.46 | 0.01/0.02 | 0.06 | 200/200 |
| 144/dados → 144 | postgres | 218.44 | 198.18 | 34.60/62.55 | 19.59/17.94 | 0.01/0.02 | 0.09 | 200/200 |
| 145/dados → 145 | postgres | 302.29 | 224.77 | 53.11/45.25 | 19.24/17.66 | 0.02/0.02 | 0.30 | 200/200 |
| 146/dados → 146 | postgres | 360.95 | 166.30 | 45.75/43.45 | 21.35/23.22 | 0.01/0.02 | 0.09 | 200/200 |
| 147/part0 → 144 | postgres | 175.46 | 164.44 | 44.39/47.17 | 23.42/19.23 | 0.01/0.02 | 0.09 | 200/200 |
| 147/part1 → 146 | postgres | 151.62 | 164.02 | 43.70/48.08 | 17.28/20.67 | 0.02/0.02 | 0.08 | 200/200 |
| 148/dados → 148 | postgres | 148.58 | 163.88 | 38.65/52.59 | 18.35/21.50 | 0.01/0.02 | 0.08 | 200/200 |
| 149/dados → 149 | postgres | 204.25 | 208.53 | 42.03/47.95 | 29.68/21.09 | 0.02/0.02 | 0.13 | 200/200 |
| 150/dados → 150 | postgres | 179.84 | 150.72 | 43.93/39.34 | 17.63/17.89 | 0.02/0.01 | 0.06 | 200/200 |
| 151/part0 → 148 | postgres | 353.94 | 145.11 | 52.70/44.78 | 18.55/15.50 | 0.02/0.02 | 0.19 | 200/200 |
| 151/part1 → 150 | postgres | 155.95 | 146.30 | 38.64/41.73 | 18.14/19.53 | 0.02/0.01 | 0.06 | 200/200 |
| 152/dados → 152 | postgres | 183.64 | 158.90 | 49.76/53.91 | 26.34/17.33 | 0.03/0.02 | 0.06 | 200/200 |
| 153/dados → 153 | postgres | 201.44 | 212.56 | 48.08/64.08 | 20.94/15.55 | 0.02/0.02 | 0.12 | 200/200 |
| 154/dados → 154 | postgres | 163.81 | 145.36 | 45.99/38.82 | 21.37/15.78 | 0.01/0.02 | 0.06 | 200/200 |
| 155/part0 → 152 | postgres | 196.12 | 171.09 | 39.44/55.03 | 19.77/20.16 | 0.01/0.02 | 0.07 | 200/200 |
| 155/part1 → 154 | postgres | 572.74 | 139.44 | 42.94/39.86 | 20.33/16.48 | 0.01/0.02 | 0.06 | 200/200 |
| 156/dados → 156 | postgres | 294.25 | 181.24 | 51.90/56.26 | 17.02/25.99 | 0.04/0.02 | 0.06 | 200/200 |
| 157/dados → 157 | postgres | 453.24 | 203.51 | 40.06/46.91 | 19.73/16.16 | 0.02/0.02 | 0.16 | 200/200 |
| 158/dados → 158 | postgres | 214.01 | 139.08 | 55.57/40.61 | 26.06/18.12 | 0.02/0.01 | 0.07 | 200/200 |
| 159/part0 → 156 | postgres | 386.08 | 177.91 | 47.29/50.58 | 20.46/28.76 | 0.01/0.01 | 0.24 | 200/200 |
| 159/part1 → 158 | postgres | 183.53 | 176.16 | 38.50/50.46 | 22.38/25.77 | 0.02/0.01 | 0.09 | 200/200 |
| 160/dados → 160 | postgres | 230.32 | 169.37 | 54.68/58.18 | 17.96/16.40 | 0.01/0.02 | 0.08 | 200/200 |
| 161/dados → 161 | postgres | 266.56 | 231.27 | 60.63/64.39 | 22.61/20.36 | 0.03/0.02 | 0.19 | 200/200 |
| 162/dados → 162 | postgres | 206.45 | 171.40 | 67.61/37.50 | 28.33/19.30 | 0.02/0.02 | 0.06 | 200/200 |
| 163/part0 → 160 | postgres | 180.31 | 160.61 | 51.82/52.19 | 35.43/16.79 | 0.02/0.02 | 0.07 | 200/200 |
| 163/part1 → 162 | postgres | 149.02 | 150.59 | 47.17/48.74 | 21.60/20.10 | 0.02/0.02 | 0.06 | 200/200 |
| 163/part2 → 161 | postgres | 137.80 | 273.12 | 39.90/49.36 | 16.72/16.29 | 0.02/0.02 | 0.30 | 200/200 |
| 164/dados → 164 | postgres | 187.92 | 148.80 | 43.85/49.03 | 32.45/19.25 | 0.02/0.01 | 0.07 | 200/200 |
| 165/dados → 165 | postgres | 224.96 | 201.51 | 54.65/67.76 | 19.87/15.24 | 0.03/0.02 | 0.12 | 200/200 |
| 166/dados → 166 | postgres | 148.48 | 162.38 | 49.33/59.03 | 17.25/16.34 | 0.06/0.02 | 0.08 | 200/200 |
| 167/part0 → 164 | postgres | 204.23 | 186.39 | 41.84/59.04 | 23.83/17.48 | 0.02/0.01 | 0.07 | 200/200 |
| 167/part1 → 166 | postgres | 173.11 | 153.75 | 53.36/50.50 | 18.50/19.78 | 0.02/0.02 | 0.07 | 200/200 |
| 264/part0 → 265 | postgres | 170.81 | 148.72 | 55.76/45.67 | 20.27/16.38 | 0.01/0.01 | 0.09 | 200/200 |
| 264/part1 → 267 | postgres | 135.24 | 134.27 | 43.12/41.80 | 16.70/20.88 | 0.02/0.02 | 0.06 | 200/200 |
| 265/dados → 265 | postgres | 133.40 | 154.61 | 39.28/52.61 | 17.35/16.75 | 0.01/0.12 | 0.09 | 200/200 |
| 266/dados → 266 | postgres | 303.87 | 217.64 | 45.37/46.36 | 23.81/28.85 | 0.01/0.01 | 0.12 | 200/200 |
| 267/dados → 267 | postgres | 141.57 | 145.38 | 39.61/43.33 | 18.06/17.74 | 0.01/0.01 | 0.07 | 200/200 |
| 268/dados → 268 | oracle | 68.04 | 63.37 | —/— | —/31.86 | —/— | — | erro*/400 |
| 269/dados → 269 | oracle | 70.44 | 61.42 | —/— | —/28.32 | —/— | — | erro*/400 |
| 273/metadata → 273 | native | 2342.34 | 1693.63 | 1884.48/1247.37 | 24.16/25.84 | 8.31/7.21 | 0.10 | 200/200 |
| 273/lives → 273 | native | 2201.17 | 45.64 | 1231.62/— | 23.73/— | 8.52/— | 0.27 | 200/200 |
| 274/dados → 274 | oracle | 62.77 | 57.80 | —/— | —/28.14 | —/— | — | erro*/400 |
| 276/dados → 276 | oracle | 67.18 | 55.03 | —/— | —/23.77 | —/— | — | erro*/400 |
| 277/dados → 277 | oracle | 54.01 | 56.86 | —/— | —/28.51 | —/— | — | erro*/400 |
| 278/dados → 278 | oracle | 50.83 | 68.74 | —/— | —/30.36 | —/— | — | erro*/400 |
| 279/dados → 279 | oracle | 51.95 | 62.47 | —/— | —/29.76 | —/— | — | erro*/400 |
| 280/dados → 280 | oracle | 73.30 | 70.21 | —/— | —/35.02 | —/— | — | erro*/400 |
| 281/dados → 281 | oracle | 57.51 | 64.38 | —/— | —/28.50 | —/— | — | erro*/400 |
| 282/dados → 282 | oracle | 60.15 | 61.23 | —/— | —/27.78 | —/— | — | erro*/400 |
| 283/dados → 283 | oracle | 55.41 | 70.83 | —/— | —/36.67 | —/— | — | erro*/400 |
| 284/dados → 284 | oracle | 60.18 | 54.05 | —/— | —/23.82 | —/— | — | erro*/400 |
| 285/dados → 285 | oracle | 82.39 | 66.04 | —/— | —/30.81 | —/— | — | erro*/400 |
| 286/dados → 286 | oracle | 55.40 | 70.47 | —/— | —/28.45 | —/— | — | erro*/400 |
| 287/dados → 287 | oracle | 75.00 | 61.42 | —/— | —/29.04 | —/— | — | erro*/400 |
| 289/dados → 289 | oracle | 55.02 | 60.28 | —/— | —/28.04 | —/— | — | erro*/400 |
| 290/dados → 290 | oracle | 64.12 | 61.24 | —/— | —/28.35 | —/— | — | erro*/400 |
| 291/dados → 291 | oracle | 2424.34 | 316.40 | 2313.50/222.33 | 26.72/26.71 | 10.65/6.32 | 1.37 | 200/200 |
| 292/dados → 292 | oracle | 1651.50 | 116.92 | 1583.70/55.66 | 29.94/26.26 | 1.55/0.83 | 0.55 | 200/200 |
| 293/dados → 293 | oracle | 1672.09 | 123.72 | 1607.89/61.95 | 26.31/23.91 | 1.04/1.06 | 1.20 | 200/200 |
| 294/dados → 294 | oracle | 54.54 | 60.03 | —/— | —/27.22 | —/— | — | erro*/400 |
| 296/dados → 296 | oracle | 49.66 | 75.86 | —/— | —/40.35 | —/— | — | erro*/400 |
| 297/dados → 297 | oracle | 56.31 | 61.13 | —/— | —/31.77 | —/— | — | erro*/400 |
| 298/dados → 298 | oracle | 51.06 | 59.36 | —/— | —/31.59 | —/— | — | erro*/400 |
| 299/dados → 299 | oracle | 55.56 | 54.56 | —/— | —/25.92 | —/— | — | erro*/400 |
| 300/dados → 300 | oracle | 48.65 | 58.90 | —/— | —/27.88 | —/— | — | erro*/400 |
| 301/dados → 301 | oracle | 47.74 | 50.41 | —/— | —/25.51 | —/— | — | erro*/400 |
| 302/dados → 302 | oracle | 48.40 | 55.53 | —/— | —/27.19 | —/— | — | erro*/400 |
| 303/dados → 303 | oracle | 45.45 | 57.58 | —/— | —/31.58 | —/— | — | erro*/400 |
| 304/dados → 304 | oracle | 56.15 | 63.05 | —/— | —/28.26 | —/— | — | erro*/400 |
| 305/dados → 305 | oracle | 55.19 | 72.84 | —/— | —/29.32 | —/— | — | erro*/400 |
| 306/dados → 306 | oracle | 50.76 | 59.68 | —/— | —/26.54 | —/— | — | erro*/400 |
| 307/metadata → 307 | native | 1628.64 | 1606.80 | 1320.63/1270.20 | 24.77/28.19 | 7.34/8.10 | 0.37 | 200/200 |
| 307/goals → 307 | native | 1684.29 | 50.83 | 1285.51/— | 28.76/— | 7.37/— | 0.16 | 200/200 |
| 309/metadata → 309 | native | 1709.00 | 1573.91 | 1284.31/1224.38 | 28.79/23.72 | 8.69/6.57 | 0.11 | 200/200 |
| 309/lives → 309 | native | 1627.49 | 56.07 | 1250.41/— | 27.29/— | 6.67/— | 0.34 | 200/200 |
| 309/goals → 309 | native | 1594.68 | 57.12 | 1203.39/— | 27.86/— | 8.44/— | 0.21 | 200/200 |
| 309/origins → 309 | native | 1861.47 | 49.73 | 1300.27/— | 27.87/— | 8.29/— | 0.19 | 200/200 |
| 310/dados → 310 | native | 28.16 | 76.11 | —/— | —/— | —/— | — | erro*/400 |
| 311/dados → 311 | oracle | 56.09 | 71.60 | —/— | —/30.32 | —/— | — | erro*/400 |
| 312/part0 → 334 | postgres | 182.53 | 378.81 | 41.93/57.44 | 20.19/21.93 | 0.02/0.01 | 0.06 | 200/200 |
| 312/part1 → 340 | postgres | 145.83 | 149.35 | 47.10/54.02 | 19.51/18.75 | 0.02/2.12 | 0.08 | 200/200 |
| 314/dados → 314 | postgres | 173.84 | 178.85 | 31.67/36.73 | 19.34/15.56 | 0.19/0.02 | 0.09 | 200/200 |
| 315/dados → 315 | postgres | 190.57 | 243.07 | 45.50/51.46 | 16.23/22.29 | 0.02/0.02 | 0.11 | 200/200 |
| 316/dados → 316 | oracle | 65.27 | 71.47 | —/— | —/32.71 | —/— | — | erro*/400 |
| 317/dados → 317 | postgres | 212.99 | 254.00 | 46.03/58.77 | 18.25/17.83 | 0.10/0.03 | 0.08 | 200/200 |
| 318/dados → 318 | postgres | 222.61 | 255.68 | 67.07/51.81 | 19.57/21.27 | 0.02/0.02 | 0.08 | 200/200 |
| 319/dados → 319 | postgres | 217.81 | 285.30 | 40.84/56.78 | 19.31/25.32 | 0.02/0.05 | 0.09 | 200/200 |
| 320/dados → 320 | postgres | 241.77 | 259.66 | 84.53/53.31 | 21.81/21.63 | 0.02/0.01 | 0.06 | 200/200 |
| 321/dados → 321 | postgres | 190.88 | 160.29 | 81.73/54.09 | 19.01/19.51 | 0.02/0.01 | 0.06 | 200/200 |
| 322/part0 → 346 | postgres | 175.11 | 187.10 | 71.45/78.08 | 19.92/19.75 | 0.02/0.02 | 0.07 | 200/200 |
| 322/part1 → 321 | postgres | 195.02 | 173.38 | 81.37/61.69 | 17.39/18.66 | 0.03/0.01 | 0.08 | 200/200 |
| 323/dados → 323 | postgres | 183.75 | 183.20 | 58.13/51.24 | 26.36/30.77 | 0.03/0.02 | 0.09 | 200/200 |
| 324/dados → 324 | postgres | 171.08 | 148.23 | 44.08/42.93 | 18.84/15.84 | 0.02/0.01 | 0.08 | 200/200 |
| 325/dados → 325 | postgres | 159.35 | 164.30 | 52.35/63.09 | 18.83/17.75 | 0.02/0.02 | 0.14 | 200/200 |
| 326/dados → 326 | postgres | 162.30 | 173.57 | 57.00/41.45 | 24.63/19.96 | 0.01/0.02 | 0.06 | 200/200 |
| 327/part0 → 326 | postgres | 165.32 | 187.01 | 41.41/53.00 | 29.69/23.87 | 0.02/0.26 | 0.14 | 200/200 |
| 328/dados → 328 | postgres | 1787.66 | 245.88 | 72.18/49.24 | 21.24/23.86 | 0.02/0.14 | 0.15 | 200/200 |
| 329/dados → 329 | postgres | 378.32 | 149.80 | 44.71/43.53 | 22.60/18.34 | 0.02/0.01 | 0.06 | 200/200 |
| 330/dados → 330 | postgres | 215.88 | 203.84 | 50.65/50.75 | 20.77/17.23 | 0.03/0.02 | 0.09 | 200/200 |
| 331/dados → 331 | postgres | 210.17 | 206.51 | 45.23/56.71 | 23.90/22.12 | 0.02/0.02 | 0.07 | 200/200 |
| 333/dados → 333 | postgres | 783.53 | 234.42 | 43.58/42.88 | 28.58/21.17 | 0.02/0.01 | 0.08 | 200/200 |
| 334/dados → 334 | postgres | 166.17 | 177.38 | 49.11/47.06 | 21.09/32.83 | 0.02/0.01 | 0.07 | 200/200 |
| 335/dados → 335 | postgres | 181.91 | 343.56 | 42.57/60.13 | 19.09/24.32 | 0.02/0.02 | 0.15 | 200/200 |
| 336/dados → 336 | postgres | 555.00 | 254.30 | 47.60/46.21 | 19.21/33.73 | 0.01/0.02 | 0.11 | 200/200 |
| 337/dados → 337 | postgres | 628.69 | 141.21 | 41.05/43.05 | 23.83/15.91 | 0.01/0.02 | 0.10 | 200/200 |
| 338/dados → 338 | postgres | 879.12 | 189.47 | 40.87/44.95 | 19.60/17.40 | 0.02/0.01 | 0.06 | 200/200 |
| 339/part0 → 115 | postgres | 199.13 | 155.03 | 54.85/51.15 | 22.99/22.56 | 0.03/0.03 | 0.17 | 200/200 |
| 339/part1 → 123 | postgres | 555.40 | 178.71 | 51.76/57.73 | 25.71/21.86 | 0.03/0.09 | 0.57 | 200/200 |
| 339/part2 → 118 | postgres | 185.73 | 167.25 | 65.69/62.30 | 20.22/16.55 | 0.03/0.02 | 0.14 | 200/200 |
| 339/part3 → 122 | postgres | 254.66 | 193.26 | 50.75/70.88 | 18.44/15.54 | 0.02/0.02 | 0.09 | 200/200 |
| 340/dados → 340 | postgres | 190.26 | 144.85 | 53.38/47.33 | 16.95/17.50 | 0.02/0.01 | 0.06 | 200/200 |
| 341/dados → 341 | postgres | 286.30 | 191.52 | 41.79/52.44 | 16.32/20.77 | 0.02/0.01 | 0.09 | 200/200 |
| 342/dados → 342 | postgres | 217.86 | 217.96 | 41.82/55.81 | 22.44/19.32 | 0.02/0.10 | 0.33 | 200/200 |
| 343/dados → 343 | postgres | 238.29 | 270.66 | 77.93/55.36 | 16.86/19.80 | 0.01/0.01 | 0.08 | 200/200 |
| 344/dados → 344 | postgres | 267.58 | 225.97 | 80.77/62.00 | 17.09/16.06 | 0.12/0.15 | 1.43 | 200/200 |
| 345/dados → 345 | postgres | 180.51 | 152.00 | 72.04/46.53 | 19.20/20.01 | 0.02/0.06 | 0.06 | 200/200 |
| 346/dados → 346 | postgres | 193.06 | 150.95 | 82.81/54.48 | 18.70/17.68 | 0.02/0.02 | 0.09 | 200/200 |
| 347/part0 → 346 | postgres | 175.11 | 187.10 | 71.45/78.08 | 19.92/19.75 | 0.02/0.02 | 0.07 | 200/200 |
| 347/part1 → 321 | postgres | 195.02 | 173.38 | 81.37/61.69 | 17.39/18.66 | 0.03/0.01 | 0.08 | 200/200 |
| 347/part2 → 345 | postgres | 209.75 | 145.29 | 80.52/44.88 | 26.68/19.87 | 0.02/0.01 | 0.07 | 200/200 |
| 348/dados → 348 | postgres | 152.02 | 155.79 | 41.93/41.91 | 21.45/19.84 | 0.14/0.02 | 0.09 | 200/200 |
| 369/dados → 369 | postgres | 93.76 | 84.44 | 18.97/19.48 | 21.77/18.02 | 0.02/0.02 | 0.10 | 200/200 |
| 370/dados → 370 | postgres | 95.43 | 86.49 | 21.66/20.71 | 18.07/20.76 | 0.02/0.02 | 0.06 | 200/200 |
| 371/dados → 371 | postgres | 259.66 | 80.43 | 18.59/18.03 | 25.18/17.46 | 0.01/0.02 | 0.07 | 200/200 |
| 372/dados → 372 | postgres | 108.99 | 87.61 | 25.45/23.92 | 17.59/15.94 | 0.02/0.02 | 0.07 | 200/200 |
| 373/dados → 373 | postgres | 77.54 | 81.10 | 20.02/28.76 | 16.81/16.25 | 0.02/0.01 | 0.09 | 200/200 |
| 374/dados → 374 | postgres | 87.68 | 90.98 | 18.54/18.97 | 18.23/17.22 | 0.02/0.01 | 0.08 | 200/200 |
| 375/dados → 375 | postgres | 118.57 | 111.99 | 27.23/34.90 | 24.64/17.69 | 0.02/0.02 | 0.10 | 200/200 |
| 376/dados → 376 | postgres | 90.22 | 87.39 | 20.36/22.22 | 20.24/17.92 | 0.02/0.01 | 0.07 | 200/200 |
| 378/dados → 378 | postgres | 91.93 | 91.35 | 21.94/26.94 | 18.13/15.23 | 0.03/0.02 | 0.07 | 200/200 |
| 379/dados → 379 | postgres | 100.26 | 91.62 | 28.22/21.01 | 19.14/16.70 | 0.02/0.01 | 0.06 | 200/200 |
| 380/dados → 380 | postgres | 414.63 | 100.86 | 26.09/23.92 | 19.54/17.10 | 0.02/0.03 | 0.15 | 200/200 |
| 381/dados → 381 | postgres | 125.17 | 120.10 | 39.01/33.18 | 23.10/19.99 | 0.02/0.02 | 0.16 | 200/200 |
| 382/dados → 382 | postgres | 110.48 | 83.54 | 23.58/22.49 | 30.04/20.05 | 0.02/0.02 | 0.07 | 200/200 |
| 383/dados → 383 | postgres | 98.52 | 92.13 | 21.62/23.87 | 21.63/18.86 | 0.02/0.02 | 0.22 | 200/200 |
| 384/dados → 384 | postgres | 185.28 | 99.14 | 33.24/26.53 | 19.51/19.37 | 0.02/0.01 | 0.09 | 200/200 |
| 385/dados → 385 | postgres | 82.91 | 119.53 | 21.75/25.90 | 16.63/29.47 | 0.01/0.02 | 0.12 | 200/200 |
| 387/dados → 387 | postgres | 174.47 | 116.94 | 21.11/27.87 | 18.24/24.66 | 0.01/0.04 | 0.10 | 200/200 |
| 388/dados → 388 | postgres | 116.76 | 97.02 | 21.69/25.04 | 26.10/16.83 | 0.02/0.01 | 0.10 | 200/200 |
| 389/dados → 389 | postgres | 129.54 | 107.02 | 25.41/24.78 | 23.31/22.24 | 0.02/0.02 | 0.09 | 200/200 |
| 390/dados → 390 | postgres | 450.67 | 128.48 | 28.30/28.82 | 24.80/23.10 | 0.02/0.02 | 0.19 | 200/200 |
| 391/dados → 391 | postgres | 85.81 | 100.34 | 21.77/27.53 | 16.57/21.12 | 0.02/0.02 | 0.08 | 200/200 |
| 392/dados → 392 | postgres | 188.85 | 117.79 | 27.36/23.44 | 23.77/26.85 | 0.03/0.02 | 0.07 | 200/200 |
| 393/dados → 393 | postgres | 106.02 | 109.78 | 25.71/30.63 | 21.28/19.07 | 0.02/0.02 | 0.07 | 200/200 |
| 394/dados → 394 | postgres | 106.94 | 130.51 | 19.64/50.28 | 26.82/25.52 | 0.02/0.06 | 0.10 | 200/200 |
