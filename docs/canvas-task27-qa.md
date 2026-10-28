# Tarefa 27 — QA7 (parcial)

No servidor scv59, branch feature/canvas-redesign. As alterações de Login.tsx e a auditoria preexistentes foram preservadas.

Foram aplicadas correções parciais: seleção e exclusão de parâmetros com uso identificado bloqueadas; usos exibidos em selo com detalhe no tooltip; formatação de células compartilhada pela tabela do palco, gaveta e prévia do editor de fonte; aviso de parâmetros em estilo neutro; disposição e tooltip do botão Origem; horário de rascunho com formato de 24 horas explícito. A contagem do selo refere-se aos locais identificados, que podem incluir consultas e fontes, não apenas blocos. O painel de parâmetros ainda não foi alargado.

Validação: scripts/canvas-check.sh passou com 519 testes, lint de hooks, TypeScript e build (log /tmp/canvas-task27-check-final.log). O script cobre frontend, não backend. Não houve mudança de backend.

Pendências: contagem total limitada no backend e texto padronizado; etapas e medição de abertura; origem e nome amigável completos; entrada de data brasileira; contraste do inspetor; investigação do zoom e expiração de rascunhos; script Playwright e matriz de larguras, temas e painéis; capturas e validação visual. Não foi validado o botão Descartar nem se há outros horários com AM/PM. Não há resultados de larguras a relatar. A tarefa não está concluída.
