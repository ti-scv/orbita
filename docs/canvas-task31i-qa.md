# QA da tarefa 31i — ícones no redesenho

A branch de ícones foi reaplicada sobre o redesenho, incluindo a 31h. O alias do Vite e o paths do TypeScript resolvem `lucide-react` para `src/components/icons`; os controles novos de remoção, conexões, cabeçalho, menu e editor usam esse pacote. Símbolos de interface restantes foram migrados para componentes centrais. A varredura cobre bibliotecas concorrentes, SVGs manuais, símbolos conhecidos, acessibilidade de botões só com ícone, cores das definições e regras CSS de ícones. As exceções gráficas estão em `icones-inventario.md`. A cor dos ícones acompanha o contexto e os tokens do tema; WhatsApp e usuário preservam seus estados de cor.

## Verificação

- `bash scripts/canvas-check.sh`: npm ci, lint de hooks, TypeScript, 64 arquivos e 611 testes, build: sucesso. O Vite informou o aviso de chunk acima de 500 kB.
- Staging isolado `orbita-canvas-stage-icones`, porta 8094, usando `orbita-canvas-task26-api:8000`. Capturas Playwright com sessão e respostas sintéticas; requisições de API foram interceptadas. Nenhuma exclusão real ou migração foi executada.
- `scripts/icones-qa.cjs`: 26 capturas distintas (hashes diferentes), claro e escuro. Cobrem agendamentos, visão geral, mensagens, grupos, pendências, CROSS, lista de relatórios, editor, custos, configurações, diálogo, barra recolhida e lâmpada.
- Capturas adicionais em `icones-evidencias/`: conexões, confirmação de remoção, editor com painéis, menu de ações do relatório, menu do componente e toast. Os cenários de cadastro e editor passaram nos testes visuais e de acessibilidade executados em 1440 × 900, zoom 100%, nos dois temas. As operações de remoção ocorreram apenas no navegador com respostas sintéticas.

As imagens são evidências de cenários simulados; não substituem uma revisão visual com dados reais. A verificação do backend não foi executada: esta tarefa não altera o backend.
