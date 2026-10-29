# Tarefa 34 — revisão QA16

## Regra de unidade

O catálogo continua restrito pelo backend à unidade administrativa do relatório (`ReportDefinition.unit`), inclusive na execução: a opção de outras unidades não amplia permissões nem consulta outras unidades administrativas. Dentro dessa unidade, o agrupamento usa estabelecimento comprovado em `legacy.source_location.name`, nome ou código do relatório. São reconhecidos AME Votuporanga, Jales, Santa Fé, CECAP, UBS e Santa Casa; outros nomes ROB8 são normalizados e, na ausência de indício reconhecido, usa-se o nome da unidade administrativa. O estabelecimento do relatório aberto é o filtro inicial; a opção desligada por padrão inclui os demais estabelecimentos do mesmo catálogo autorizado. Os grupos ordenam por estabelecimento, nome e ID; nomes repetidos ficam adjacentes e recebem ID e situação legíveis.

Esta classificação é uma aproximação: o legado não fornece uma relação universal e inequívoca de estabelecimento. A identificação por nome pode ser incompleta, e origens sem indícios ficam no grupo da unidade administrativa, fora do filtro de um estabelecimento específico. O botão permite encontrá-las. Para a prévia, a unidade do canvas é preferida quando admitida; se não for, usa-se o estabelecimento correspondente conhecido quando consta nas opções, ou o padrão permitido da fonte, com aviso. A proximidade para estabelecimentos sem correspondência conhecida ainda não é comprovada.

## Verificação e evidências

As imagens são do navegador contra dados sintéticos em PostgreSQL descartável `orbita_task34`; não retratam dados reais. Rotas equivalentes `/relatorios/57/canvas?unit=scv` e `/relatorios/1/canvas?unit=ame`. `scripts/canvas-task34-seed.py` recusa outro banco; os três scripts de navegador usam apenas a porta isolada 8098. Os arquivos `resultados.json` e `medicoes.json` acompanham as medições. As imagens da lista cobrem os dois temas com escala 100%/150% (nomes `1` e `1.5`), simulada por viewport e fator de escala; não foi medido o zoom nativo do navegador.

| Item | Teste ou verificação | Evidência |
|---|---|---|
| 1 | `test_canvas_task34.py::test_establishment_uses_legacy_location_and_canvas_unit_fallback`; teste de filtro e opção em `task34.test.tsx`; navegador confere Jales oculto e exibido | `canvas-task34-evidencias/c57-light-1-lista.png` e demais imagens de lista |
| 2 | teste de filtro confere nomes repetidos, ID, estado e outra unidade | `canvas-task34-evidencias/c57-dark-1-lista.png` |
| 3 | teste de prévia automática após preenchimento e botão Recarregar; navegador aguarda prévia sem clicar em testar | `canvas-task34-evidencias/c1-claro-100-previa.png` |
| 4 | teste de seleção da unidade do canvas e estabelecimento permitido, tradução de nome e erro; alerta para alternativa | `canvas-task34-evidencias/c1-claro-100-previa.png`; falta evidência de todas as fontes reais |
| 5 | testes de Esc com modal superior e retorno de foco; navegador fecha gaveta com Esc | `canvas-task34-evidencias/c1-claro-100-gaveta.png` |
| 6 | contrato nativo local e teste da gaveta com texto vazio e tipo estimado | `canvas-task34-evidencias/c1-claro-100-gaveta.png`; fixture sem linhas |
| 7 | `test_local_schema_describes_empty_responsavel_and_dates` e prévia vazia no navegador | `canvas-task34-evidencias/c1-claro-100-previa.png`; suporte limitado ao esquema nativo local |
| 8 | `canvas-task34-style.cjs` mede 11 px no cabeçalho e no elemento de parâmetros inserido no DOM para a medição | sem print do elemento real: a fixture nativa não retorna parâmetros efetivos |
| 9 | `canvas-task34-style.cjs` mede cor e fundo computados e exige contraste ≥ 4,5 | `canvas-task34-evidencias/c1-light-1-lista.png`; valores em `medicoes.json` |
| 10 | `task34.test.tsx` compara rascunho igual, alterado e com propriedades reordenadas; botões existentes Restaurar/Descartar foram preservados | sem print do rascunho real do navegador anterior; verificação em navegador pendente |

Contraste medido na aba inativa clara: `rgb(15, 36, 56)` sobre `rgb(248, 250, 252)`, **15,09:1**, fórmula de luminância WCAG. O navegador mediu 11 px para o cabeçalho da prévia e para um elemento de parâmetros inserido especificamente para medir o estilo; não é uma captura de parâmetros reais.

Frontend completo com Node 24 e dois workers: 633 testes aprovados em 69 arquivos; após ajustes posteriores, testes direcionados da tarefa e tarefa 32f: 12 aprovados. Backend completo no PostgreSQL descartável, flag de remoção desligada, chaves descartáveis e arquivos montados somente para leitura: 1.015 passaram e cinco falharam, todas as falhas conhecidas em `test_report_removal.py`: `test_report_remove_restore_and_permissions`, `test_connection_with_report_is_blocked_and_keeps_secret`, `test_report_with_schedules_and_canvas_references_cannot_be_removed`, `test_app_connection_restore_preserves_previous_inactive_state`, `test_other_unit_cannot_remove_report`. Elas esperam remoção ativa e recebem 503. Testes de classificação/esquema da tarefa: 2 passaram. A primeira execução sem chaves/arquivos teve falhas de ambiente e foi repetida com a configuração completa.

Após reconstruir 8091, `curl` na rota HTML do canvas 57: servidor **0,001565 s**; túnel local **0,998898 s**, HTTP 200 em ambos. Isso mede apenas a resposta inicial HTML, não as chamadas autenticadas nem a renderização do editor. A API do staging foi reiniciada e a flag de remoção continua desligada.

## Pendências

- O esquema de fontes SQL e dos demais adaptadores nativos ainda não declara tipos para todos os campos: com zero linhas ou coluna vazia, essas fontes podem continuar como tipo desconhecido. O tipo estimado foi implementado para o contrato nativo local, não para todos os esquemas.
- A classificação de estabelecimento depende dos metadados legados e precisa de uma relação explícita e auditada para todos os casos; quando não há correspondência conhecida não é possível garantir a alternativa permitida mais próxima.
- Faltam testes específicos completos e capturas para todos os dez itens, especialmente zoom nativo de 150%, parâmetros efetivos reais, rascunho preexistente e os campos vazios de fontes não locais. O rascunho da sessão anterior não estava disponível no navegador isolado; a comparação e as ações foram verificadas por teste, sem declarar o rascunho antigo como lixo.
