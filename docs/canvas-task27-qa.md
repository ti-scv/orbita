# Tarefa 27 — QA7 (parcial)

No servidor scv59, branch feature/canvas-redesign. As alterações de Login.tsx e a auditoria preexistentes foram preservadas.

Foram aplicadas correções parciais: seleção e exclusão de parâmetros com uso identificado bloqueadas; usos exibidos em selo com detalhe no tooltip; formatação de células compartilhada pela tabela do palco, gaveta e prévia do editor de fonte; aviso de parâmetros em estilo neutro; disposição e tooltip do botão Origem; horário de rascunho com formato de 24 horas explícito. A contagem do selo refere-se aos locais identificados, que podem incluir consultas e fontes, não apenas blocos. O painel de parâmetros ainda não foi alargado.

Validação: scripts/canvas-check.sh passou com 519 testes, lint de hooks, TypeScript e build (log /tmp/canvas-task27-check-final.log). O script cobre frontend, não backend. Não houve mudança de backend.

Pendências: contagem total limitada no backend e texto padronizado; etapas e medição de abertura; origem e nome amigável completos; entrada de data brasileira; contraste do inspetor; investigação do zoom e expiração de rascunhos; script Playwright e matriz de larguras, temas e painéis; capturas e validação visual. Não foi validado o botão Descartar nem se há outros horários com AM/PM. Não há resultados de larguras a relatar. A tarefa não está concluída.

## Continuação 27c — andamento parcial

- Fontes PostgreSQL fazem contagem limitada a 10.001 linhas, com teto exibido de 10.000. A contagem e sua indicação de limite são usadas no chip, palco, gaveta e teste da fonte. Se a consulta de contagem falhar, a resposta conserva o limite inferior anterior; nesse caso, ele ainda pode mudar entre páginas. A contagem adicional também precisa de medição em dados reais para avaliar o custo.
- A prévia aceita e exibe datas DD/MM/AAAA e envia AAAA-MM-DD. O inspetor de página somente leitura recebeu regras para manter os valores legíveis; falta revisão visual nos dois temas.
- Rascunhos de versões diferentes são removidos ao consultar o rascunho da versão atual; rascunhos com mais de sete dias ou horário futuro são descartados. Testes cobrem expiração e versões. A ação Descartar ainda não foi validada no navegador.
- O código do zoom usa a mesma variável para o número da barra e a escala da página. Falta reproduzir a divergência relatada no navegador. No código do Canvas, os dois relógios encontrados usam hora de 24 horas; falta validar a interface integralmente.
- Foi escrito `scripts/canvas-task27c-qa.cjs`, que aceita `CANVAS_QA_SESSION`, permite GET e apenas POST de prévia, registra medidas e captura os quatro painéis nas larguras e temas pedidos. A sintaxe foi verificada, mas o roteiro não foi executado: não foi localizada uma sessão de QA disponível. Não há capturas nem resultados de larguras a declarar; seletores e critérios do roteiro ainda precisam de validação em execução real.

Validação: 7 testes de backend passaram com banco de testes SQLite isolado (`/tmp/canvas-task27c-backend-final.log`). `scripts/canvas-check.sh` passou com 522 testes, lint, TypeScript e build (`/tmp/canvas-task27c-check-verified.log`, dois workers e limite de 60 s). Antes disso, uma rodada falhou com três tempos esgotados e um mock de armazenamento incompleto; o mock foi corrigido. O staging 8091 foi reconstruído com `orbita-canvas-task26-api`, e somente essa API foi reiniciada. O curl confirmou o bundle `/assets/ReportCanvas-DtOUW1Wk.js`, contendo os textos novos. Login.tsx e a auditoria preexistentes continuam fora dos commits.

Pendências: etapas e medição de abertura dos relatórios 1 e 6 e meta de desempenho; origem e nome amigável completos; validação visual do contraste e do botão Descartar; reprodução do zoom e busca visual de horários; execução e correção da matriz Playwright com capturas. A contagem real e o custo da consulta limitada ainda precisam ser conferidos no staging. A tarefa não está concluída.
