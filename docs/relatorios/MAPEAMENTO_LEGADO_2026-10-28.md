# Mapeamento do legado ? 28/10/2026

## Escopo e resultado

Compara??o da extra??o de leitura de 24/10/2026 (`whatsreport-sql-live-20261024/definitions.json`) com o PostgreSQL do SCV em 28/10/2026. A extra??o cont?m **321 cadastros**, todos presentes: **128 relat?rios e 193 componentes**. N?o ? uma lista de 321 relat?rios efetivamente enviados. A extra??o n?o comprova mudan?as posteriores no legado.

H? **279 cadastros com layout Canvas**, **164 com fonte homologada e contrato dispon?vel**, e **157 sem a combina??o fonte homologada + Canvas**. Estes 157 incluem componentes e rotinas de manuten??o que n?o devem ser convertidos em envios. ?Fonte: sim? inclui fontes validadas em entregas anteriores; n?o afirma que todos foram executados novamente nem que unidades sem dados possuem hist?rico importado.

Nesta entrega foram completados **nove Canvas de componentes j? homologados**, sem criar novos cadastros. Foram preservados SQL, par?metros, permiss?es, unidade, formatos de exporta??o, coletas e flags de ativa??o. O coletor continua consumindo SQL; criar o Canvas n?o altera uma coleta CSV para PDF. Nenhuma mensagem foi criada nas verifica??es e nenhuma programa??o foi ativada.

O cat?logo legado permanece sob a unidade administrativa SCV (id 2), como j? cadastrado. Origem dos dados ? independente: unidades locais 1 AME, 2 SCV, 3 Sansa?de, 4 AME Jales, 5 AME Santa F?, 6 NAS. As consultas operacionais usam as conex?es/vis?es isoladas da unidade de origem; n?o mudamos cadastros de unidade para deduzir a origem pelo nome do relat?rio.

## Canvas completados e amostras

As consultas abaixo j? estavam homologadas. A confer?ncia repetiu o SELECT existente, validou colunas, registrou tipos observados e renderizou PDF em mem?ria. N?o armazenou linhas reais no layout nem em arquivos versionados. N?o houve nova compara??o de valores hist?ricos do Firebird para estas consultas: permanece a valida??o num?rica anterior, sem altera??o do SQL.

| ID SCV | C?digo | Linhas na amostra | Tempo consulta + PDF (s) | Abertura padr?o no staging | Canvas |
|---:|---|---:|---:|---|---|
| 45 | legacy123-33 | 546 | 6.292 | Exemplo; dados reais sob demanda (desempenho pendente) | [/relatorios/45/canvas?unit=scv](/relatorios/45/canvas?unit=scv) |
| 47 | legacy123-35 | 737 | 7.644 | Exemplo; dados reais sob demanda (desempenho pendente) | [/relatorios/47/canvas?unit=scv](/relatorios/47/canvas?unit=scv) |
| 354 | bed-position-oracle | 14 | 0.082 | Dados reais | [/relatorios/354/canvas?unit=scv](/relatorios/354/canvas?unit=scv) |
| 362 | exams-attendance-exams-source | 276 | 6.953 | Exemplo; dados reais sob demanda (desempenho pendente) | [/relatorios/362/canvas?unit=scv](/relatorios/362/canvas?unit=scv) |
| 363 | exams-attendance-visits-source | 250 | 1.688 | Dados reais | [/relatorios/363/canvas?unit=scv](/relatorios/363/canvas?unit=scv) |
| 365 | vidas-sansaude-production-oracle | 4 | 1.221 | Dados reais | [/relatorios/365/canvas?unit=scv](/relatorios/365/canvas?unit=scv) |
| 366 | occupancy-patients-production | 741 | 25.331 | Exemplo; dados reais sob demanda (desempenho pendente) | [/relatorios/366/canvas?unit=scv](/relatorios/366/canvas?unit=scv) |
| 367 | occupancy-attendances-production | 334 | 5.173 | Exemplo; dados reais sob demanda (desempenho pendente) | [/relatorios/367/canvas?unit=scv](/relatorios/367/canvas?unit=scv) |
| 368 | occupancy-surgeries-production | 88 | 0.438 | Dados reais | [/relatorios/368/canvas?unit=scv](/relatorios/368/canvas?unit=scv) |

A amostra de datas usa os 30 dias anteriores at? hoje, respeitando fim exclusivo quando declarado na consulta. Fontes sem data usam a posi??o atual. O per?odo ? apenas da pr?via, n?o ? salvo como uma data fixa no cadastro. N?o inventamos identificadores obrigat?rios. Rascunhos existentes foram preservados.

**Limita??o de desempenho:** cinco fontes superaram cinco segundos na valida??o. A mais pesada, pacientes-dia (366), levou 25,3 s; n?o est? atendido o aceite de poucos segundos para essas fontes. Foram mantidas sem consulta autom?tica ao abrir. A pr?via solicita dados reais explicitamente e o seletor identifica o modo de exemplo. Exige otimizar a consulta/autoriza??o de coleta antes de ativar pr?via autom?tica; n?o adicionamos ?ndices, jobs ou cache externo sem valida??o.

Verifica??o da API do staging: IDs 354/365/368 retornaram HTTP 200 no Canvas e na pr?via, com respectivamente 14/4/88 registros e 4/4/6 colunas, sem criar mensagens. A consulta de restri??es 81 retornou 337 registros e 24 colunas nos ?ltimos 30 dias, em 30,84 s; n?o foi promovida: ENVIAR=N n?o comprova recusa ou falta de confirma??o pelo WhatsApp.

## Fontes pendentes consultadas em leitura

Consultas recuperadas do legado foram validadas sintaticamente e consultadas com transa??o READ ONLY, sem chamar procedures. A prova verifica nomes e tipos atuais no Oracle e at? cinco linhas; n?o ? prova de equival?ncia num?rica com um cache Firebird de outra data. Limite de chamada de leitura de oito segundos; a dura??o total pode superar isso pela conex?o e cancelamento.

| SCV / c?digo | Resultado | Colunas conferidas | Linhas da amostra | Tempo (s) |
|---|---|---|---:|---:|
| 29 / legacy123-16 | Pendente: leitura n?o concluiu no limite | sim | ? | 10.16 |
| 30 / legacy123-17 | Fonte respondeu | sim | 5 | 0.05 |
| 42 / legacy123-30 | Fonte respondeu | sim | 5 | 2.96 |
| 67 / legacy123-57 | Fonte respondeu | sim | 5 | 0.71 |
| 70 / legacy123-60 | Fonte respondeu | sim | 5 | 5.56 |
| 79 / legacy123-69 | Pendente: leitura n?o concluiu no limite | sim | ? | 9.12 |
| 80 / legacy123-70 | Pendente: leitura n?o concluiu no limite | sim | ? | 9.46 |
| 82 / legacy123-72 | Fonte respondeu | sim | 5 | 0.17 |
| 83 / legacy123-74 | Fonte respondeu | sim | 5 | 0.04 |
| 81 / legacy123-71 | Fonte respondeu | sim | 5 | 4.76 |

Os demais pendentes possuem consulta ausente, conex?o desativada/n?o validada, procedure n?o reconstru?da, composi??o com depend?ncias ou arquivo externo. N?o foram executados para ?descobrir? efeitos. A tabela final registra o motivo de cada cadastro; rascunho com campos recuperados n?o equivale a fonte pronta.

## Bloqueios preservados

- **FPO 75/81 e auxiliares:** cotas preservadas apenas at? 05/2023, 46 chaves amb?guas, agregados Oracle e cache divergentes. Consultar `FPO_RECUPERACAO_20261027.md`. Nenhuma extrapola??o de cotas.
- **ACS/eSUS:** conex?o limitada cadastrada, mas desativada; valida??o por unidade/profissional e reconstru??o de `proc_indicadores_esus` incompletas. Contagem global compat?vel n?o valida os relat?rios por UBS. Composi??o geral ultrapassa limites do Canvas. Consultar `ESUS_ORIGEM_POSTGRESQL.md`.
- **Altas at? 10h / variante M?dicos 56:** f?rmulas e componentes sem equival?ncia conclu?da. N?o substituir pela outra variante de Indicadores M?dicos por ter nome parecido. A vers?o homologada de M?dicos permanece separada.
- **PDFs publicados:** arquivo pronto dispon?vel n?o recupera gerador, layout e fonte. C?pias edit?veis precisam de origem comprovada.
- **Rotinas de limpar/sincronizar:** n?o habilitar como relat?rio nem executar para valida??o.
- **Origens operacionais sem registros:** n?o importar hist?rico inexistente nem fabricar pacientes. Manter fonte e unidade identificadas.
- **Relat?rio de teste por identificador:** sem par?metro seguro, consulta autom?tica bloqueada; fora da sele??o de migra??o.

## Seguran?a, simula??o e implanta??o

- Branch confirmada: `feature/canvas-redesign`. Commits somente locais, sem push/merge.
- Backup antes da aplica??o: `/root/backup-legado-2026-10-28-040110.sql`, acesso 0600, t?rmino do dump conferido.
- SHA256 do backup: `3c0b2b335729cc86e49235d13543cb3c8fe8b7e5c6902f23221a31b096a09a60`.
- Evid?ncia privada: `/opt/backups/orbita/legado-20261028/`: `dry-run-final/result.json`, `applied/result.json`, `idempotency/result.json`, `source-probes.json` e logs de testes. Esses arquivos n?o s?o versionados.
- Dry-run: nove candidatos validados, zero altera??es. Apply: IDs 45, 47, 354, 362, 363, 365, 366, 367, 368. Repeti??o do apply: zero altera??es (idempotente).
- Migra??o 0030 j? estava aplicada; n?o houve migra??o nova nesta entrega.
- Painel de produ??o n?o foi reconstru?do. Staging criado por `scripts/canvas-stage.sh up`, nome `orbita-canvas-stage-legado`, porta local **8093**, API separada `orbita-canvas-stage-api-legado`, com envios desativados. A porta padr?o 8091 e os arquivos de desempenho em edi??o por outra sess?o foram preservados.
- A interface nova requer a futura publica??o do painel/API. Os layouts j? est?o no banco compartilhado. Login customizado preservado, hash `646b7e51bf8d20143a93502ad730b628641b26410feb558c3aef5d46c0e6a1d5`.
- OpenAPI gerado sem erros (quatro avisos preexistentes). Resultados finais das su?tes na se??o de testes abaixo.

Comando reproduz?vel (no ambiente com acesso aos arquivos de evid?ncia):

```sh
python manage.py complete_legacy_canvases \
  --archive /evidence/whatsreport-sql-live-20261024/definitions.json \
  --output /evidence/legado-20261028/nova-simulacao
# Aplicar somente ap?s conferir a simula??o e concluir um novo pg_dump:
python manage.py complete_legacy_canvases \
  --archive /evidence/whatsreport-sql-live-20261024/definitions.json \
  --output /evidence/legado-20261028/nova-aplicacao \
  --apply --backup /backup.sql \
  --approved-plan /evidence/legado-20261028/nova-simulacao/result.json
```

## Revers?o

Fazer novo `pg_dump` antes de qualquer revers?o. N?o restaurar o dump completo sobre produ??o para desfazer nove layouts: isso apagaria interven??es posteriores de outros m?dulos. `operations.legacy_delivery.revert_canvases` restaura somente `canvas_layout` e metadados anteriores dos IDs desta entrega e incrementa vers?o; recusa edi??o posterior ou altera??o na consulta.

Na shell Django, primeiro simular; depois aplicar os mesmos IDs, ap?s o backup:

```python
from operations.legacy_delivery import revert_canvases
ids = [45, 47, 354, 362, 363, 365, 366, 367, 368]
revert_canvases(ids)              # simula??o, nenhuma altera??o
revert_canvases(ids, apply=True)  # somente depois do backup e da revis?o
```

Para parar o staging: `STAGE_NAME=orbita-canvas-stage-legado scripts/canvas-stage.sh down` e remover somente o container `orbita-canvas-stage-api-legado`. N?o usar remo??o global de ?rf?os nem tocar nos demais servi?os.

## Testes

- Backend completo: **960 testes passaram**, incluindo isolamento de unidade, concorr?ncia, migra??o SQL, importa??o FPO, contratos de Canvas, aus?ncia de escrita no dry-run e revers?o protegida.
- Frontend completo com Node 24: **471 testes passaram**. Depois foram adicionadas e aprovadas **duas verifica??es** do modo inicial real/exemplo (arquivo com sete testes passou). O Node 18 do host n?o ? compat?vel com o ambiente de testes atual; os testes finais usaram a mesma vers?o 24 do Dockerfile.
- Um teste antigo esperava p?gina de 50 registros; foi alinhado ao contrato existente de 25. A API n?o teve sua pagina??o alterada.
- Build TypeScript/Vite conclu?do por `scripts/canvas-stage.sh up`, sem reconstruir produ??o.
- OpenAPI: zero erros, quatro avisos preexistentes.
- Dry-run/aplica??o/repeti??o confirmados; nenhuma mensagem criada nos testes de API; leitura externa sem procedures de neg?cio.
- Revers?o testada no banco de testes: preserva formatos, permiss?es, SQL e bloqueia desfazer uma edi??o posterior.


## Invent?rio completo

?Canvas? indica layout existente, inclusive rascunho; ?Fonte? indica contrato homologado dispon?vel, n?o mera exist?ncia de conex?o ou nome de procedure. Programa??es e permiss?es permanecem como estavam.

| ID legado | Relatorio / componente | Existe no SCV | ID SCV / unidade | Canvas | Fonte | Observacao |
|---:|---|---|---|---|---|---|
| 1 | ESTOQUE - ENTRADA E SAIDA DE EMPRESTIMOS | sim | 28 / scv | sim | n?o | Conexao desativada ou nao validada. Recuperado em homologação; liberação operacional e validação em produção pendentes. |
| 16 | PACIENTES_DIA | sim | 29 / scv | sim | n?o | Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 17 | LEITOS_SISTEMA | sim | 30 / scv | sim | n?o | Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 18 | TAXA DE OCUPAÇÃO POR SETOR | sim | 31 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 19 | PACIENTE DIA E TAXA DE OCUPAÇÃO - GERAL | sim | 32 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 20 | COMPLETO TAXA OCUPAÇÃO | sim | 33 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 22 | LIMPAR_PACIENTES_DIA | sim | 34 / scv | n?o | n?o | Revis?o/manuten??o: n?o executar como relat?rio. Conexao desativada ou nao validada. Converter procedure Firebird para consulta direta no Oracle: PROC_LIMPAR_PACIENTES_DIA; Rotina interna; não executar como relatório de leitura |
| 23 | GERAR_LEITOS_DISPONIVEIS | sim | 35 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Converter procedure Firebird para consulta direta no Oracle: PROC_LEITOS_DISPONIVEIS |
| 24 | PACIENTE DIA E TAXA DE OCUPAÇÃO - SUS | sim | 36 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 25 | PACIENTE DIA E TAXA DE OCUPAÇÃO - CONVENIO | sim | 37 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 26 | CONSULTAS_MEDICAS_AME_VOTU | sim | 38 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 27 | EXAMES_MEDICOS_AME_VOTU | sim | 39 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 28 | 52 - LIMPAR_CONSULTAS_MEDICAS_AME_VOTU | sim | 40 / scv | n?o | n?o | Revis?o/manuten??o: n?o executar como relat?rio. Conexao desativada ou nao validada. Converter procedure Firebird para consulta direta no Oracle: PROC_LIMPAR_CONSULTAS_MEDICAS; Rotina interna; não executar como relatório de leitura |
| 29 | 53 - LIMPAR_EXAMES_MEDICAS_AME_VOTU | sim | 41 / scv | n?o | n?o | Revis?o/manuten??o: n?o executar como relat?rio. Conexao desativada ou nao validada. Converter procedure Firebird para consulta direta no Oracle: PROC_LIMPAR_EXAMES_MEDICAS; Rotina interna; não executar como relatório de leitura |
| 30 | INTERNACAO_USUARIO | sim | 42 / scv | sim | n?o | Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 31 | LIMPAR_INTERNACAO_USUARIO | sim | 43 / scv | n?o | n?o | Revis?o/manuten??o: n?o executar como relat?rio. Conexao desativada ou nao validada. Converter procedure Firebird para consulta direta no Oracle: PROC_LIMPAR_INTERNACAO_USUARIO; Rotina interna; não executar como relatório de leitura |
| 32 | LIMPAR_ATENDIMENTOS | sim | 44 / scv | n?o | n?o | Revis?o/manuten??o: n?o executar como relat?rio. Conexao desativada ou nao validada. Converter procedure Firebird para consulta direta no Oracle: PROC_LIMPAR_ATENDIMENTOS; Rotina interna; não executar como relatório de leitura |
| 33 | ATENDIMENTOS | sim | 45 / scv | sim | sim | Canvas edit?vel ligado ? fonte homologada; formato e coleta existentes preservados. |
| 34 | LIMPAR_EXAMES | sim | 46 / scv | n?o | n?o | Revis?o/manuten??o: n?o executar como relat?rio. Conexao desativada ou nao validada. Converter procedure Firebird para consulta direta no Oracle: PROC_LIMPAR_EXAMES; Rotina interna; não executar como relatório de leitura |
| 35 | EXAMES | sim | 47 / scv | sim | sim | Canvas edit?vel ligado ? fonte homologada; formato e coleta existentes preservados. |
| 38 | ALTAS ATE AS 10 HORAS - GERAL | sim | 48 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 39 | ALTAS ATE AS 10 HORAS - META | sim | 49 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 40 | INDICADORES MEDICOS | sim | 50 / scv | sim | n?o | Conexao desativada ou nao validada.  |
| 41 | ALTAS ATE AS 10 HORAS - NUMERO DE ALTAS | sim | 51 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 42 | EXAMES POR ATENDIMENTO - GERAL | sim | 52 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 43 | TAXA DE OCUPAÇÃO - CABECALHO  | sim | 53 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Substituir consulta ao cache Firebird por consulta Oracle |
| 44 | TAXA DE OCUPAÇÃO - RODAPE | sim | 54 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Substituir consulta ao cache Firebird por consulta Oracle |
| 45 | ALTAS ATE AS 10 HORAS - CABECALHO | sim | 55 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Substituir consulta ao cache Firebird por consulta Oracle |
| 46 | ALTAS ATE AS 10 HORAS - RODAPE | sim | 56 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Substituir consulta ao cache Firebird por consulta Oracle |
| 47 | CONSULTAS E EXAMES - NAO CONFIRMADOS | sim | 57 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 48 | CONSULTAS E EXAMES - CONFIRMADOS | sim | 58 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 49 | CONSULTAS E EXAMES - MENSAGENS NÃO ENVIADAS | sim | 59 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 50 | CONSULTAS E EXAMES - MENSAGENS NÃO ENVIADAS / NÃO CONFIRMADAS | sim | 60 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 51 | EXAMES POR ATENDIMENTO - TABELA | sim | 61 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 52 | EXAMES POR ATENDIMENTO - DESEMPENHO INDIVIDUAL | sim | 62 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 53 | EXAMES POR ATENDIMENTO - COMPLETO | sim | 63 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 54 | TEMPO MEDIO PERMANENCIA - GERAL | sim | 64 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 55 | COMPLETO TAXA OCUPAÇÃO | sim | 65 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 56 | INDICADORES MEDICOS | sim | 66 / scv | sim | n?o | Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 57 | CIRURGIAS | sim | 67 / scv | sim | n?o | Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 58 | MEDIA DE CIRURGIAS - TOTAL | sim | 68 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 59 | 00 - SINCRINIZAR COMPLETO PARTE 1 | sim | 69 / scv | n?o | n?o | Revis?o/manuten??o: n?o executar como relat?rio. Revisar componentes e fórmulas do relatório composto; Rotina interna; não executar como relatório de leitura |
| 60 | ATENDIMENTOS_PS | sim | 70 / scv | sim | n?o | Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 61 | 00 - SINCRINIZAR COMPLETO PARTE 2 | sim | 71 / scv | n?o | n?o | Revis?o/manuten??o: n?o executar como relat?rio. Revisar componentes e fórmulas do relatório composto; Rotina interna; não executar como relatório de leitura |
| 62 | MEDIA ATENDIMENTOS | sim | 72 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar. |
| 63 | TEMPO MEDIO PERMANENCIA - ESPECIALIDADES SUS | sim | 73 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Converter procedure Firebird para consulta direta no Oracle: PROC_ALTAS_ATE_AS_10 |
| 64 | MEDIA DE CIRURGIAS - ELETIVAS | sim | 74 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Converter procedure Firebird para consulta direta no Oracle: PROC_ALTAS_ATE_AS_10 |
| 65 | MEDIA DE CIRURGIAS - URGENCIA E EMERGENCIA | sim | 75 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Converter procedure Firebird para consulta direta no Oracle: PROC_ALTAS_ATE_AS_10 |
| 66 | PARECER | sim | 76 / scv | n?o | n?o | Falta homologar consulta, tipos, per?odo e equival?ncia num?rica. |
| 67 | PARECER_ATENDIMENTOS | sim | 77 / scv | n?o | n?o | Falta homologar consulta, tipos, per?odo e equival?ncia num?rica. |
| 68 | PARECER MEDICO POR ESPECIALIDADE | sim | 78 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Converter procedure Firebird para consulta direta no Oracle: PROC_ALTAS_ATE_AS_10 |
| 69 | FPO_AMBULATORIAL | sim | 79 / scv | sim | n?o | Migrar FPO_COTA_DRS_PROCEDIMENTOS e FPO_DEPARA_MUTIRAO; reconciliar projeções, cotas e decêndios. |
| 70 | FPO_AIH | sim | 80 / scv | sim | n?o | Migrar FPO_COTA_DRS_PROCEDIMENTOS e FPO_DEPARA_MUTIRAO; reconciliar projeções, cotas e decêndios. |
| 71 | AGENDAMENTOS NAO CONFIRMADOS - RESTRICOES | sim | 81 / scv | sim | n?o | Validar resultado e filtro ENVIAR = N da consulta original; esse critério não comprova confirmação/recusa WhatsApp. |
| 72 | FPO_PROCEDIMENTO_SUS | sim | 82 / scv | sim | n?o | Migrar FPO_COTA_DRS_PROCEDIMENTOS e FPO_DEPARA_MUTIRAO; reconciliar projeções, cotas e decêndios. |
| 74 | FPO_COMPLEXIDADE_AMB | sim | 83 / scv | sim | n?o | Migrar FPO_COTA_DRS_PROCEDIMENTOS e FPO_DEPARA_MUTIRAO; reconciliar projeções, cotas e decêndios. |
| 75 | FPO - MAC DECENDIO FINANCEIRO | sim | 84 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Cotas e de/para históricos importados; cotas recuperadas apenas de 01/2022 a 05/2023. Localizar cotas atuais e reconciliar produção e cálculos antes de habilitar. |
| 78 | LIMPAR TABELAS AMB E AIH | sim | 85 / scv | n?o | n?o | Revis?o/manuten??o: n?o executar como relat?rio. Conexao desativada ou nao validada. Rotina de coleta/manutenção; não executar como relatório. Migrar FPO_COTA_DRS_PROCEDIMENTOS e FPO_DEPARA_MUTIRAO; reconciliar projeções, cotas e decêndios. |
| 79 | ATUALIZAR FPO | sim | 86 / scv | n?o | n?o | Rotina de coleta/manutenção; não executar como relatório. Migrar FPO_COTA_DRS_PROCEDIMENTOS e FPO_DEPARA_MUTIRAO; reconciliar projeções, cotas e decêndios. |
| 80 | FPO_AIH | sim | 87 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Migrar FPO_COTA_DRS_PROCEDIMENTOS e FPO_DEPARA_MUTIRAO; reconciliar projeções, cotas e decêndios. |
| 81 | FPO - MAC DECENDIO FISICO | sim | 88 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Cotas e de/para históricos importados; cotas recuperadas apenas de 01/2022 a 05/2023. Localizar cotas atuais e reconciliar produção e cálculos antes de habilitar. |
| 82 | AME VOTUPORANGA - MÉDIA DE LIGAÇÕES POR ATENDENTE | sim | 89 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 83 | AME VOTUPORANGA - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 90 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 84 | AME VOTUPORANGA - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 91 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 85 | AME VOTUPORANGA - QUANTIDADE DE PACIENTES CONTATADOS | sim | 92 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 86 | AME VOTUPORANGA - INDICADORES | sim | 93 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 87 | SANSAUDE - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 94 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 88 | SANSAUDE - MÉDIA DE LIGAÇÕES POR ATENDENTE | sim | 95 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 89 | SANSAUDE - QUANTIDADE DE PACIENTES CONTATADOS | sim | 96 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 90 | SANSAUDE - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 97 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 91 | SANSAUDE - INDICADORES | sim | 98 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 92 | INDICADORES AME E SANSAUDE | sim | 99 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 93 | PRO POVO - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 100 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 94 | PRO POVO - INDICADORES | sim | 101 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 96 | PRO POVO - QUANTIDADE DE PACIENTES CONTATADOS | sim | 102 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 97 | PRO POVO - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 103 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 98 | COLINAS - INDICADORES | sim | 104 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 99 | COLINAS - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 105 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 100 | COLINAS - QUANTIDADE DE PACIENTES CONTATADOS | sim | 106 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 101 | COLINAS - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 107 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 102 | NAS - INDICADORES | sim | 108 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 103 | PARQUE DAS NAÇÕES - INDICADORES | sim | 109 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 104 | PARQUE DAS NAÇÕES - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 110 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 105 | PARQUE DAS NAÇÕES - QUANTIDADE DE PACIENTES CONTATADOS | sim | 111 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 106 | PARQUE DAS NAÇÕES - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 112 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 107 | VILA PAES - INDICADORES | sim | 113 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 108 | VILA PAES - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 114 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 109 | VILA PAES - QUANTIDADE DE PACIENTES CONTATADOS | sim | 115 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 110 | VILA PAES - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 116 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 111 | DONA NINA - INDICADORES | sim | 117 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 112 | DONA NINA - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 118 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 113 | DONA NINA - QUANTIDADE DE PACIENTES CONTATADOS | sim | 119 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 114 | DONA NINA - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 120 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 115 | SÃO COSME - INDICADORES | sim | 121 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 116 | SÃO COSME - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 122 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 117 | SÃO COSME - QUANTIDADE DE PACIENTES CONTATADOS | sim | 123 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 118 | SÃO COSME - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 124 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 119 | AME SANTA FE - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 125 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 120 | AME SANTA FE - INDICADORES | sim | 126 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 121 | AME SANTA FE - MÉDIA DE LIGAÇÕES POR ATENDENTE | sim | 127 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 122 | AME SANTA FE - QUANTIDADE DE PACIENTES CONTATADOS | sim | 128 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 123 | AME SANTA FE - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 129 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 124 | AME JALES - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 130 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 125 | AME JALES - INDICADORES | sim | 131 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 126 | AME JALES - MÉDIA DE LIGAÇÕES POR ATENDENTE | sim | 132 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 127 | AME JALES - QUANTIDADE DE PACIENTES CONTATADOS | sim | 133 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 128 | AME JALES - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 134 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 129 | GRUPO SANTA CASA - INDICADORES | sim | 135 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 130 | JARDIM MARIN - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 136 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 131 | JARDIM MARIN - QUANTIDADE DE PACIENTES CONTATADOS | sim | 137 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 132 | JARDIM MARIN - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 138 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 133 | JARDIM MARIN - INDICADORES | sim | 139 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 134 | CECAP - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 140 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 135 | CECAP - QUANTIDADE DE PACIENTES CONTATADOS | sim | 141 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 136 | CECAP - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 142 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 137 | CECAP - INDICADORES | sim | 143 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 138 | VILA AMÉRICA - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 144 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 139 | VILA AMÉRICA - QUANTIDADE DE PACIENTES CONTATADOS | sim | 145 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 140 | VILA AMÉRICA - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 146 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 141 | VILA AMÉRICA - INDICADORES | sim | 147 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 142 | PAINEIRAS - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 148 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 143 | PAINEIRAS - QUANTIDADE DE PACIENTES CONTATADOS | sim | 149 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 144 | PAINEIRAS - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 150 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 145 | PAINEIRAS - INDICADORES | sim | 151 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 146 | PALMEIRAS - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 152 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 147 | PALMEIRAS - QUANTIDADE DE PACIENTES CONTATADOS | sim | 153 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 148 | PALMEIRAS - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 154 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 149 | PALMEIRAS - INDICADORES | sim | 155 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 150 | SÃO JOÃO - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 156 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 151 | SÃO JOÃO - QUANTIDADE DE PACIENTES CONTATADOS | sim | 157 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 152 | SÃO JOÃO - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 158 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 153 | SÃO JOÃO - INDICADORES | sim | 159 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 154 | SIMONSEN - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 160 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 155 | SIMONSEN - QUANTIDADE DE PACIENTES CONTATADOS | sim | 161 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 156 | SIMONSEN - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 162 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 157 | SIMONSEN - INDICADORES | sim | 163 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 158 | CAROBEIRAS - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 164 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 159 | CAROBEIRAS - QUANTIDADE DE PACIENTES CONTATADOS | sim | 165 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 160 | CAROBEIRAS - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 166 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 161 | CAROBEIRAS - INDICADORES | sim | 167 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 162 | INDICADORES GERENCIAIS | sim | 168 / scv | n?o | n?o | PDF pronto: arquivo dispon?vel n?o comprova gerador ou Canvas edit?vel.  |
| 163 | INDICADORES ESTRATEGICOS | sim | 169 / scv | n?o | n?o | PDF pronto: arquivo dispon?vel n?o comprova gerador ou Canvas edit?vel.  |
| 164 | PRODUCAO_AGENTE | sim | 170 / scv | n?o | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 165 | UBS VILA PAES - PRODUÇÃO ACS | sim | 171 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 166 | GRAFICO POR DESFECHO DE VISITA | sim | 172 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 167 | UBS VILA PAES - PRODUÇÃO ACS | sim | 173 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 168 | GRAFICO FICHAS SEM CPF | sim | 174 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 169 | GRAFICO VISITAS POR MICRO AREA | sim | 175 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 170 | RANKING MÉDIA VISITAS ACS POR UNIDADE DE SAUDE | sim | 176 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 171 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 177 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 173 | PRODUCAO_AGENTE | sim | 178 / scv | n?o | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 174 | ESUS - GERAR TABELA MENSAL | sim | 179 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 175 | UBS GERAL - PRODUÇÃO ACS | sim | 180 / scv | n?o | n?o | Conexao desativada ou nao validada. Composição excede limites atuais do Canvas (30 fontes/30 páginas/100 blocos); componentes completos preservados separadamente. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 176 | UBS GERAL - PRODUÇÃO ACS | sim | 181 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 177 | UBS PAINEIRAS - PRODUÇÃO ACS | sim | 182 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 178 | UBS CECAP - PRODUÇÃO ACS | sim | 183 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 179 | UBS PARQUE DAS NACOES - PRODUÇÃO ACS | sim | 184 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 180 | UBS VILA AMERICA - PRODUÇÃO ACS | sim | 185 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 181 | UBS SAO JOAO - PRODUÇÃO ACS | sim | 186 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 182 | UBS VILA MARIN - PRODUÇÃO ACS | sim | 187 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 183 | UBS CAROBEIRAS - PRODUÇÃO ACS | sim | 188 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 184 | UBS COLINAS - PRODUÇÃO ACS | sim | 189 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 185 | UBS PRO-POVO - PRODUÇÃO ACS | sim | 190 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 186 | UBS PALMEIRAS - PRODUÇÃO ACS | sim | 191 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 187 | UBS SAO COSME - PRODUÇÃO ACS | sim | 192 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 188 | UBS SIMONSEN - PRODUÇÃO ACS | sim | 193 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 189 | UBS DONA NINA - PRODUÇÃO ACS | sim | 194 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 190 | GRAFICO FICHAS SEM CPF | sim | 195 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 191 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 196 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 192 | GRAFICO POR DESFECHO DE VISITA | sim | 197 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 193 | GRAFICO VISITAS POR MICRO AREA | sim | 198 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 194 | UBS CAROBEIRAS - PRODUÇÃO ACS | sim | 199 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 195 | GRAFICO FICHAS SEM CPF | sim | 200 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 196 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 201 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 197 | GRAFICO POR DESFECHO DE VISITA | sim | 202 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 198 | GRAFICO VISITAS POR MICRO AREA | sim | 203 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 199 | UBS CECAP - PRODUÇÃO ACS | sim | 204 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 200 | GRAFICO FICHAS SEM CPF | sim | 205 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 201 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 206 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 202 | GRAFICO POR DESFECHO DE VISITA | sim | 207 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 203 | GRAFICO VISITAS POR MICRO AREA | sim | 208 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 204 | UBS COLINAS - PRODUÇÃO ACS | sim | 209 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 205 | GRAFICO FICHAS SEM CPF | sim | 210 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 206 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 211 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 207 | GRAFICO POR DESFECHO DE VISITA | sim | 212 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 208 | GRAFICO VISITAS POR MICRO AREA | sim | 213 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 209 | UBS DONA NINA - PRODUÇÃO ACS | sim | 214 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 210 | GRAFICO FICHAS SEM CPF | sim | 215 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 211 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 216 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 212 | GRAFICO POR DESFECHO DE VISITA | sim | 217 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 213 | GRAFICO VISITAS POR MICRO AREA | sim | 218 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 214 | UBS PAINEIRAS - PRODUÇÃO ACS | sim | 219 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 215 | GRAFICO FICHAS SEM CPF | sim | 220 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 216 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 221 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 217 | GRAFICO POR DESFECHO DE VISITA | sim | 222 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 218 | GRAFICO VISITAS POR MICRO AREA | sim | 223 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 219 | UBS PALMEIRAS - PRODUÇÃO ACS | sim | 224 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 220 | GRAFICO FICHAS SEM CPF | sim | 225 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 221 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 226 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 222 | GRAFICO POR DESFECHO DE VISITA | sim | 227 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 223 | GRAFICO VISITAS POR MICRO AREA | sim | 228 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 224 | UBS PARQUE DAS NACOES - PRODUÇÃO ACS | sim | 229 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 225 | GRAFICO FICHAS SEM CPF | sim | 230 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 226 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 231 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 227 | GRAFICO POR DESFECHO DE VISITA | sim | 232 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 228 | GRAFICO VISITAS POR MICRO AREA | sim | 233 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 229 | UBS PRO-POVO - PRODUÇÃO ACS | sim | 234 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 230 | GRAFICO FICHAS SEM CPF | sim | 235 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 231 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 236 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 232 | GRAFICO POR DESFECHO DE VISITA | sim | 237 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 233 | GRAFICO VISITAS POR MICRO AREA | sim | 238 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 234 | UBS SAO COSME - PRODUÇÃO ACS | sim | 239 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 235 | GRAFICO FICHAS SEM CPF | sim | 240 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 236 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 241 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 237 | GRAFICO POR DESFECHO DE VISITA | sim | 242 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 238 | GRAFICO VISITAS POR MICRO AREA | sim | 243 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 239 | UBS SAO JOAO - PRODUÇÃO ACS | sim | 244 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 240 | GRAFICO FICHAS SEM CPF | sim | 245 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 241 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 246 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 242 | GRAFICO POR DESFECHO DE VISITA | sim | 247 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 243 | GRAFICO VISITAS POR MICRO AREA | sim | 248 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 244 | UBS SIMONSEN - PRODUÇÃO ACS | sim | 249 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 245 | GRAFICO FICHAS SEM CPF | sim | 250 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 246 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 251 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 247 | GRAFICO POR DESFECHO DE VISITA | sim | 252 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 248 | GRAFICO VISITAS POR MICRO AREA | sim | 253 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 249 | UBS VILA AMERICA - PRODUÇÃO ACS | sim | 254 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 251 | GRAFICO FICHAS SEM CPF | sim | 255 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 252 | GRAFICO FICHAS SEM NOME PACIENTE | sim | 256 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 253 | GRAFICO POR DESFECHO DE VISITA | sim | 257 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 254 | GRAFICO VISITAS POR MICRO AREA | sim | 258 / scv | sim | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 255 | UBS VILA MARIN - PRODUÇÃO ACS | sim | 259 / scv | sim | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 256 | LIMPAR_PRODUCAO_AGENTE | sim | 260 / scv | n?o | n?o | Revis?o/manuten??o: n?o executar como relat?rio. Conexao desativada ou nao validada. Rotina de coleta/manutenção; não executar como relatório. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 257 | ESUS - SINCRONIZAR COMPLETO | sim | 261 / scv | n?o | n?o | Revis?o/manuten??o: n?o executar como relat?rio. Rotina de sincronização eSUS; não executar como relatório. Validar produção no PostgreSQL e regras do cache legado. |
| 258 | ALTERAR MES PRODUCAO ACS | sim | 262 / scv | n?o | n?o | Conexao desativada ou nao validada. Rotina de coleta/manutenção; não executar como relatório. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 259 | PRODUCAO_AGENTE | sim | 263 / scv | n?o | n?o | Conexao desativada ou nao validada. Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada. |
| 260 | POLICLINICA - INDICADORES | sim | 264 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 261 | POLICLINICA - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP | sim | 265 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 262 | POLICLINICA - QUANTIDADE DE PACIENTES CONTATADOS | sim | 266 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 263 | POLICLINICA - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 267 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 265 | RELATORIO DE CONSULTAS | sim | 268 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 266 | RELATORIO DE CONSULTAS - CM PRO POVO | sim | 269 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 268 | SAN_VIDAS_TEMP | sim | 270 / scv | n?o | n?o | Vincular conjuntos de vidas/metas ao provedor validado do Canvas 310; preservar fotografias e metas. |
| 269 | INDICADORES VIDAS SANSAUDE | sim | 271 / scv | n?o | n?o | PDF pronto: arquivo dispon?vel n?o comprova gerador ou Canvas edit?vel. Conexao desativada ou nao validada. Recuperar gerador e arquivo-fonte; PDF pronto não permite reconstruir blocos editáveis sem a origem. |
| 270 | INDICADORES INTERNACOES PS | sim | 272 / scv | n?o | n?o | PDF pronto: arquivo dispon?vel n?o comprova gerador ou Canvas edit?vel. Recuperar gerador e arquivo-fonte; PDF pronto não permite reconstruir blocos editáveis sem a origem. |
| 271 | VIDAS SANSAUDE | sim | 273 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 272 | RELATORIO DE CONSULTAS POR PROCEDIMENTO | sim | 274 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 275 | RELATORIO DE CONSULTAS - CM PAINEIRAS | sim | 275 / scv | n?o | n?o | Falta homologar consulta, tipos, per?odo e equival?ncia num?rica. |
| 276 | RELATORIO DE CONSULTAS - CM JARDIM MARIN | sim | 276 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 277 | RELATORIO DE CONSULTAS - CM SAO JOAO | sim | 277 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 278 | RELATORIO DE CONSULTAS - CM PALMEIRAS | sim | 278 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 279 | RELATORIO DE CONSULTAS - CM COLINAS | sim | 279 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 280 | RELATORIO DE CONSULTAS - CM VILA AMERICA | sim | 280 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 281 | RELATORIO DE CONSULTAS - CM CECAP | sim | 281 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 282 | RELATORIO DE CONSULTAS - CM CAROBEIRAS | sim | 282 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 283 | RELATORIO DE CONSULTAS - CM SAO COSME | sim | 283 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 284 | RELATORIO DE CONSULTAS - CM SIMONSEN | sim | 284 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 285 | RELATORIO DE CONSULTAS - CM PARQUE DAS NACOES | sim | 285 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 286 | RELATORIO DE CONSULTAS - CM VILA PAES | sim | 286 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 287 | RELATORIO DE CONSULTAS - CM NINA | sim | 287 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 288 | RELATORIO DE CONSULTAS - POLICLINICA | sim | 288 / scv | n?o | n?o | Falta homologar consulta, tipos, per?odo e equival?ncia num?rica. |
| 289 | RELATORIO SAIDA DE MEDICAMENTOS | sim | 289 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 290 | RELATORIO SAIDA DE MEDICAMENTOS - CAROBEIRAS | sim | 290 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 291 | RELATORIO GESTANTES POR UNIDADE | sim | 291 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 292 | RELATORIO GESTANTES - CM  CAROBEIRAS | sim | 292 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 293 | RELATORIO GESTANTES - CM  PRO POVO | sim | 293 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 294 | RELATORIO SAIDA DE MEDICAMENTOS -  PRO POVO | sim | 294 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 295 | RELATORIO SAIDA DE MEDICAMENTOS -  PAINEIRAS | sim | 295 / scv | n?o | n?o | Falta homologar consulta, tipos, per?odo e equival?ncia num?rica. |
| 296 | RELATORIO SAIDA DE MEDICAMENTOS - JARDIM MARIN | sim | 296 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 297 | RELATORIO SAIDA DE MEDICAMENTOS -  SAO JOAO | sim | 297 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 298 | RELATORIO SAIDA DE MEDICAMENTOS -  PALMEIRAS | sim | 298 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 299 | RELATORIO SAIDA DE MEDICAMENTOS -  COLINAS | sim | 299 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 300 | RELATORIO SAIDA DE MEDICAMENTOS -  VILA AMERICA | sim | 300 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 301 | RELATORIO SAIDA DE MEDICAMENTOS -  CECAP | sim | 301 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 302 | RELATORIO SAIDA DE MEDICAMENTOS -  SAO COSME | sim | 302 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 303 | RELATORIO SAIDA DE MEDICAMENTOS -  SIMONSEN | sim | 303 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 304 | RELATORIO SAIDA DE MEDICAMENTOS -  PARQUE DAS NACOES | sim | 304 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 305 | RELATORIO SAIDA DE MEDICAMENTOS -  VILA PAES | sim | 305 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 306 | RELATORIO SAIDA DE MEDICAMENTOS - NINA | sim | 306 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 308 | VIDAS SANSAUDE - METAS | sim | 307 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 309 | INDICADORES - PAINEL LEITOS | sim | 308 / scv | n?o | n?o | PDF pronto: arquivo dispon?vel n?o comprova gerador ou Canvas edit?vel.  |
| 310 | INDICADORES - VIDAS SANSAUDE | sim | 309 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 311 | EXPORTAR TABELA LEITOS | sim | 310 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 312 | RELATORIO DE EXAMES REGULADOS UPA-PA | sim | 311 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 315 | INDICADORES - RANKING FALTANTES | sim | 312 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 317 | CONSULTAS_MEDICAS | sim | 313 / scv | n?o | n?o | Consulta SELECT ainda ausente. Conexao desativada ou nao validada. Validar objeto de origem (view/procedure a identificar): SINCRONIZAR_ROB8 |
| 319 | GESTÃO DE MENSAGENS | sim | 314 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 320 | CAMPANHAS: CATARATA E GLAUCOMA | sim | 315 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 321 | RELATORIO DE CONSULTAS - DENGARIO | sim | 316 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 323 | CAMPANHA RH | sim | 317 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 325 | BUSCA ATIVA ANALITICA POR RESPOSTA | sim | 318 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 326 | BUSCA ATIVA ANALITICA POR DATA DE RESPOSTA | sim | 319 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 327 | RANKING GRAFICO BUSCA ATIVA | sim | 320 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 328 | RANKING POR TIPO DE RESPOSTA | sim | 321 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 329 | INDICADORES - BUSCA ATIVA | sim | 322 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 331 | AME JALES - ESTATÍSTICA DE RESPOSTAS POR WHATSAPP PÓS CIRÚGICO | sim | 323 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 332 | AME JALES - MÉDIA DE LIGAÇÕES POR ATENDENTE PÓS CIRÚGICO | sim | 324 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 333 | AME JALES - QUANTIDADE DE PACIENTES CONTATADOS PÓS CIRÚGICO | sim | 325 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 334 | AME JALES - QUANTIDADE DE RESPOSTAS POR WHATSAPP PÓS CIRÚGICO | sim | 326 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 335 | AME JALES - INDICADORES PÓS CIRÚGICO | sim | 327 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 336 | AME JALES - POS CIRURGICO | sim | 328 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 337 | CECAP - QUANTIDADE DE RESPOSTAS POR WHATSAPP | sim | 329 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 338 | CAMPANHAS: EXAMES | sim | 330 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 400 | FALTANTES POR ESPECIALIDADE - GERAL | sim | 331 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 401 | INDICADORES - BUSCA ATIVA | sim | 332 / scv | sim | n?o | Conexao desativada ou nao validada. Composição legada mistura componentes ACS e mensagens (203/114/200/115); confirmar os vínculos antes da reconstrução. |
| 402 | FALTANTES ANALITICA POR DATA DE RESPOSTA | sim | 333 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 403 | RANKING POR TIPO DE RESPOSTA - GERAL | sim | 334 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 404 | FALTANTES ANALITICA POR DATA DE RESPOSTA | sim | 335 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 410 | FALTANTES ANALITICA POR DATA DE RESPOSTA | sim | 336 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 411 | FALTANTES ANALITICA POR DATA DE RESPOSTA | sim | 337 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 412 | FALTANTES POR ESPECIALIDADE | sim | 338 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 413 | INDICADORES - BUSCA ATIVA | sim | 339 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 414 | RANKING POR TIPO DE RESPOSTA | sim | 340 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 415 | RANKING POR TIPO DE RESPOSTA | sim | 341 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 416 | RANKING POR TIPO DE RESPOSTA | sim | 342 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 551 | BUSCA ATIVA ANALITICA POR RESPOSTA | sim | 343 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 552 | FALTANTES - PACIENTES IMPORTADOS | sim | 344 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 554 | BUSCA ATIVA POR ESPECIALIDADE | sim | 345 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 555 | RANKING POR TIPO DE RESPOSTA | sim | 346 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 556 | INDICADORES - BUSCA ATIVA | sim | 347 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
| 557 | BUSCA ATIVA ANALITICA POR DATA DE RESPOSTA | sim | 348 / scv | sim | sim | Integrado; valida??o num?rica anterior preservada. |
