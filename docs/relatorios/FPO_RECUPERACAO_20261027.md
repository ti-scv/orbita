# FPO — recuperação de cotas, classificação e fórmula

Investigação em 27/10/2026. Fonte: GLDADOS.FDB no 172.16.0.123. A conexão usou transação SNAPSHOT somente de leitura, comprovada por MON$READ_ONLY = 1, com no_db_triggers e no_gc. Nenhuma procedure de negócio foi executada.

## Referências preservadas no PostgreSQL

- FPO_COTA_DRS_PROCEDIMENTOS: 14.206 linhas, em 17 competências de janeiro/2022 a maio/2023. Todas as 19 colunas foram preservadas, inclusive valores, agrupamentos, tipos e complexidade.
- FPO_DEPARA_MUTIRAO: sete linhas; a fotografia foi capturada em 27/10/2026. A data de captura não é data de início de vigência das regras.
- Registros acessíveis em Relatórios → Componentes → Coleta → Histórico. As duas referências estão desativadas para coleta automática; a origem legada é documental, não uma conexão permanente.
- A importação é transacional e idempotente. Hashes por competência, origem, data de captura e ambiente são registrados; alterações divergentes em uma competência existente são bloqueadas. Nenhum dado de paciente faz parte da importação.
- Não existem cotas de 2026 nessa fonte. Os valores antigos não são copiados para competências posteriores.

## Classificação legada da produção

O código textual dos gatilhos FPO_AMBULATORIAL_BI0 e FPO_AIH_BI0 foi lido no catálogo, sem executá-los. O ambulatorial procura agrupamento e financiamento por competência e código do procedimento nas cotas. Sem correspondência, o financiamento recebe Sem contrato. A AIH procura o agrupamento pela mesma chave; o financiamento pode vir de FPO_PROCEDIMENTO_SUS. Ambos usam SELECT FIRST 1 sem ORDER BY. Há 46 combinações competência/código com agrupamentos ou financiamentos distintos no cadastro: é necessário resolver a ambiguidade para reproduzir a classificação sem escolha arbitrária.

Em 10/2026, as 1.283 linhas financeiras e as 1.283 físicas de FPO_AMBULATORIAL estão sem agrupamento e em Sem contrato. Na AIH, as 626 linhas financeiras e 626 físicas estão sem agrupamento; quatro de cada não têm financiamento. Isso é uma observação do cache no momento da consulta, não prova de ausência de cota em todos os outros sistemas.

## Comparação de fontes, 10/2026

| Fonte e critério | Firebird cache | Consulta Oracle atual | Observação |
|---|---:|---:|---|
| Ambulatorial financeiro, contagem | 1.283 | 1.236 | Consulta 69, agregação da mesma competência |
| Ambulatorial financeiro, soma QTD | 495.647,27 | 542.536,19 | Resultados a reconciliar; dados podem ter sido atualizados em momentos diferentes |
| AIH financeiro, contagem | 626 | 685 | Consulta 70, agregação da mesma competência |
| AIH financeiro, soma VL_TOTAL_CONTA | 1.257.583,25 | 1.420.287,80 | Resultados a reconciliar; não equiparar automaticamente |

As consultas Oracle foram realizadas em transação de leitura e somente agregados foram registrados. Comparações não garantem identidade temporal dos dois bancos.

## Fórmula recuperada

O Firebird client desassemblou o BLR arquivado de PROC_FPO_CALCULA_PERCENTUAL sem executar a procedure. Para cada grupo total/AC/MC/NA-AB, com cota > 0 e dia atual > 0, a rotina calcula ROUND(((produção / dia atual) × dias do mês / cota) × 100, 0). O resultado zero é exibido como texto vazio; valores nulos de produção ou total de dias propagam nulo quando o teste inicial passa. A função equivalente foi implementada e testada em operations/fpo_reference.py. Falta comparar uma saída real completa da procedure ou um PDF legado com dados da mesma competência, além de mapear os ramos de consolidação de PROC_FPO.

## Bloqueios antes de ativar os relatórios 75 e 81

1. Localizar e validar a fonte de cotas das competências posteriores a 05/2023, sem extrapolação.
2. Reconciliar os agregados Oracle/Firebird com recortes, atualização e chaves de grupo equivalentes.
3. Resolver as 46 chaves ambíguas; não repetir SELECT FIRST 1 sem critério explícito.
4. Concluir a análise dos ramos compilados de PROC_FPO e validar resultados e layout completo com amostra histórica.

Os relatórios permanecem em rascunho, sem programação ou envio automático novos. Evidências e arquivos controlados: /opt/backups/orbita/fpo-reconstruction-20261027/.
