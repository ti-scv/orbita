# Tarefa 26 — revisão QA6 do Canvas

Execução em 28/10/2026, exclusivamente em /opt/orbita, servidor scv59, branch feature/canvas-redesign. Commits locais; sem push, alteração de main, salvamento/ativação de relatórios ou deploy em produção.

## Correções

1. Editor de parâmetros: faltavam classes e regras no código, portanto um rebuild sozinho não resolveria. Incluídos contêiner rolável, linhas compactas, checkbox sem estilo de input de texto, estados e ações compactas. Usa variáveis dos temas. Removido o contador “0 selecionado(s): nenhum” e seu role=status.
2. Origem: texto visível fonte › conjunto › coluna; dados manuais identificados como fixos e metas como calculadas. O botão continua abrindo os detalhes e a consulta somente para leitura. A seção recolhível tem altura máxima de 150 px, sem consumir indefinidamente a grade.
3. Gaveta: tabela de metadados com Coluna, Exemplo (primeiro valor não vazio da página) e Origem; nome amigável do relatório/conjunto quando disponível. Anterior, Próxima e 25/50/100/200 linhas usam limit/offset e os indicadores has_more/next_offset da tarefa 21, com erro e carregamento próprios. Busca e ordenação continuam locais à página; o total aproximado é identificado como “pelo menos”.
4. Vazio inclui null, string vazia e espaços, tanto nos metadados do backend como na gaveta. Datas usam a formatação brasileira compartilhada (meia-noite aparece só como data, outros horários são preservados). Estados conhecidos recebem rótulos em português; valores desconhecidos são preservados. Copiar TSV preserva os valores originais.
5. Horário do chip em pt-BR, 24 horas; contagem do chip e palco usa linhas exibidas de total conhecido ou mínimo conhecido.
6. Mudar/remover parâmetro invalida a confirmação da prévia e solicita novo teste. Resposta de teste que chegue após edição dos parâmetros não confirma o formulário antigo.
7. JSON inválido informa linha e coluna com orientação em português, sem expor a mensagem inglesa do parser. Validação identifica page ausente e page.width/height/columns/background inválidos.
8. A expansão da fonte agora é um botão nativo separado das ações, sem botões dentro de role=button. Rascunho/seleção de parâmetros não ocupam role=status. Nomes title/data usados como rótulos padrão de remoção viram Título/Dados.
9. Inspetor explica “Relatório ativo: crie uma nova versão para editar” quando não há ação de edição disponível.
10. Datas da prévia usam input date e convertem valores existentes DD/MM/AAAA para o valor ISO do controle. O editor de fonte reconhece tipos/chaves de data e oferece o mesmo seletor. A dica explicita DD/MM/AAAA na tela e AAAA-MM-DD ao enviar.
11. Consultada docs/canvas-task21-desempenho.md: relatório 6 já tinha consulta/HTTP rápidos e a abertura estava separada do tempo da consulta. Preservado o carregamento paralelo de metadados e Canvas. A rota informa a etapa de carregamento. As fontes externas que custaram 2,1–2,2 s na medição da tarefa 21 foram hospedadas no próprio frontend; removidos os dois carregamentos externos. Fontes e licenças OFL estão em frontend/public/fonts. Não se reimplementou consulta, cache ou limite da tarefa 21.

## Preservação de trabalho compartilhado

Antes de editar foram lidos AGENTS.md, git status, git diff --stat e processos codex/agy. A sessão agy ativa executava tarefa 25, cuja instrução é auditoria somente leitura de código. As alterações pré-existentes dos componentes efetivamente trabalhados nesta tarefa foram preservadas e incorporadas conscientemente nesses arquivos. Login.tsx não foi editado, adicionado ao índice nem commitado. Demais alterações alheias foram mantidas; nenhum reset, checkout ou stash foi feito.

## Validação

- Backend: 97 testes passaram em banco de testes isolado, incluindo as suítes de prévia, parâmetros, tarefa 21, contratos e os seis novos casos de vazios/chaves de página da tarefa 26. Log: /tmp/canvas-task26-backend.log.
- scripts/canvas-check.sh: npm ci, lint de hooks, TypeScript, 519 testes em 47 arquivos e build passaram. Log: /tmp/canvas-task26-check-final.log. A cópia temporária foi atualizada com os últimos cinco componentes antes de lint/tsc.
- A primeira rodada encontrou seis expectativas antigas: payload sem parameter_edits, texto anterior do carregamento, seletores que incluíam a nova tabela de metadados e simulação de teclado em um botão que agora é nativo. Os testes foram ajustados mantendo as verificações de valores, ordem, erro e ausência de nova consulta.
- Novos testes de frontend comprovam acesso à linha 51, retorno à primeira página, offset enviado, botão de última página e formatação de vazios/datas/estados.
- Após o ajuste final do contador do palco, verificação focada adicional: 19 testes, lint, TypeScript e build passaram; log em /tmp/canvas-task26-check-count.log.

## Limites e pendências

- O total SQL pode ser um limite inferior, conforme contrato da tarefa 21; não foi introduzido COUNT caro. Nulos/exemplos descrevem a página amostrada.
- O seletor nativo usa o formato visual do navegador/sistema; a dica informa o formato brasileiro e o valor submetido é ISO.
- O rastro visível usa a coluna disponibilizada pelo conjunto. Expressão SQL, banco e consulta detalhados continuam no botão Origem; não se inventa a tabela física de uma expressão arbitrária.
- A melhora de abertura precisa ser avaliada junto à concorrência e E/S da VM; não há promessa de que toda abertura fique abaixo de um tempo fixo.
- O script canvas-check.sh valida somente frontend nesta versão do projeto; o backend foi executado separadamente.

## Staging e navegador

- Reconstruído com API_UPSTREAM=orbita-canvas-task20-api:8000 scripts/canvas-stage.sh up, preservando o upstream isolado já usado em 8091. A API de staging foi reiniciada para carregar as alterações do backend; nenhum container de produção foi reiniciado.
- O Docker atrasou criações/remoções e registrou DeadlineExceeded ao remover um container de testes. Aguardado sem reiniciar daemon/produção. O build e a substituição do staging terminaram normalmente. Log final: /tmp/canvas-task26-stage-final.log.
- Conferência via curl no JS e nos CSS realmente servidos em 8091: todas as regras cv-parameter-row, cv-column-origins, cv-drawer-pagination e cv-origin-text presentes. CSS usa cv-line, variável existente nos dois temas. Fontes servidas localmente, sem Google no HTML/CSS.
- Bundle final: /assets/index-BH9MexqF.js; folhas: /assets/ReportCanvas-gQQISDnN.css, /assets/index-DUbV-I0b.css, /fonts/canvas-fonts.css.
- Playwright real, sem mock de dados: relatório 6 abriu em 1.583 ms e relatório 1 em 1.370 ms na rodada completa. Nenhum erro JavaScript ou pedido de fonte externa. Rodada inicial independente: 2.212/1.294 ms. São amostras locais, não SLA nem comparação controlada com os 12 s do QA6.
- Na mesma rodada, abriu Editar parâmetros, comprovou display:flex nas linhas ao alternar os três modos de tema, ausência de role=status no contador, seção de origem limitada a 150 px e colunas Coluna/Exemplo/Origem visíveis. Navegou à página iniciada na linha 51 e voltou à primeira página usando a API real. Sem tentativa de gravação ou ativação. Log: /tmp/canvas-task26-browser-final.log.
- A primeira automação da gaveta usava getByRole(columnheader), que não localizou o cabeçalho; a inspeção do DOM confirmou th visível com dimensões normais. A checagem foi ajustada para os cabeçalhos da tabela de metadados, sem retirar a asserção de visibilidade.
- Sessão administrativa temporária de QA removida ao terminar.

Todos os itens pedidos receberam correção dentro dos limites descritos. Nenhuma alteração aplicada a relatórios reais.

FIM-TAREFA-26
