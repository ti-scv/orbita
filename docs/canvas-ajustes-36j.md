# Ajustes da release 36j

Base: `ab337e7`, branch `feature/canvas-release-merge`. A marca no login escuro usa a mesma máscara clara da barra lateral. Os filtros de data das telas solicitadas reutilizam `PtBrDateInput`; o placeholder do autoagendamento tem contraste no tema escuro. Catálogo e prazos exibem estados vazios, as contagens usam a mesma tipografia do título e a auditoria é recarregada ao abrir o modal. A importação já recarrega a lista após a operação.

Validação: frontend em Node 24, 77 arquivos e 673 testes aprovados; build aprovado. Backend em PostgreSQL isolado e envio simulado: 1.299 aprovados e 5 ignorados. Os resultados coincidem com a base documentada em `canvas-merge-36.md`. Logs: `/tmp/orbita-36j-frontend-final.log`, `/tmp/orbita-36j-build24.log` e `/tmp/orbita-36j-backend.log`. Uma tentativa inicial no Node do host falhou por incompatibilidade de dependências e outra foi interrompida após tempos excedidos sob carga; a execução final usou um worker e timeout de 60 segundos. Chromium verificou a marca escura e a requisição da auditoria ao abrir o modal (`/tmp/orbita-36j-browser.log`).

Staging: painéis de 8110 e 8111 atualizados para `orbita-36j-panel`; painéis anteriores preservados parados com sufixo `-36j-backup`. O painel de 8115 recebeu o mesmo build. As três portas responderam HTTP 200 e serviram o mesmo HTML; APIs e bancos fictícios existentes foram preservados. Não houve migrações nem alteração do compose.

## Tarefa 36k — remoção de relatórios desligada

Por decisão de Danilo, `compose.yaml` define `REPORT_REMOVAL_ENABLED=0` no ambiente compartilhado do backend; o padrão em `config/settings.py` também é desligado. Não foi encontrada outra ativação nos arquivos compose ou env do worktree. A API bloqueia remoção e restauração com HTTP 503 e retorna disponibilidade falsa para dependências e listagem de removidos.

Validação direcionada em contêineres isolados, sem rede: backend com SQLite e flag desligada, 11 aprovados e 5 ignorados (os testes de remoção habilitada); com flag ligada apenas no processo de teste, 5 aprovados; frontend em Node 24, 7 aprovados em `ReportRemoval.test.tsx`. Sem suítes completas. Os testes backend emitiram avisos de diretório staticfiles ausente e de cache pytest sem permissão.

Pendência: o frontend não esconde os botões de remoção quando a flag está desligada. O diálogo consulta a disponibilidade, apresenta o aviso de desativação e bloqueia a confirmação; “Relatórios removidos” também apresenta o aviso. Portanto, a exigência de ocultar as ações não está satisfeita pela alteração de configuração. Nenhum serviço de staging foi recriado e nenhuma alteração foi aplicada à produção.
