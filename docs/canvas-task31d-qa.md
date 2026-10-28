# Revisão 31d

## Lote A–D

Trabalho exclusivo no worktree `/opt/orbita-t31d`, branch `feature/canvas-t31d`. Sem push, alteração da main, aplicação da 0031 ou exclusão real. Banco descartável próprio `orbita-t31d-test-db`, rede de testes, sem acesso à rede do banco real.

- A: a 31c reiniciou o Gunicorn em 28/10/2026 às 15:30 UTC. As quatro URLs exatas da revisão, com sessão existente, `unit=ame`, `removidos=1&page=1`, responderam 200 antes das alterações 31d: 97/22/13/11 ms. A indisponibilidade é indicada por `remocao_disponivel:false`. O processo em memória precisava acompanhar o código montado: a imagem antiga tem bind mount do checkout principal, portanto olhar apenas sua tag não informa o código carregado. Os 503 da captura não se repetiram após a integração/reinício da 31c. Teste adicional cobre ambas as rotas de dependências e listas com os parâmetros exatos. Indicadores 282 ms e Agendamentos 165 ms, ambos 200, sem reinício espontâneo observado.
- B: listener de pointerdown em captura fecha o menu inclusive quando o canvas interrompe a propagação; Esc e clique fora devolvem foco ao acionador. Resumo com papel de botão, menu e item com papéis explícitos. Teste reproduz propagação interrompida e verifica foco.
- C/D: colunas semânticas de estados e contatos formatadas nas tabelas frontend, PDF e planilha, inclusive aba de dados completos. O adaptador de origem mantém valores originais para filtros e cálculos. Planilhas mantêm datas e números não relacionados a contatos. Banco mostra tipo legível, sem o hostname `db`; nomes da lista começam com maiúscula. Agendamentos também formata os contatos.
- Responsável: `local_report_data` usa `Case.assignee.username`, com select_related de assignee; a origem SQL faz a junção equivalente. Consulta agregada somente leitura nesta execução: 2.352 casos AME nos últimos 30 dias, zero com responsável atribuído. O travessão representa vazio real nessa amostra, sem alteração artificial dos dados.

Validação inicial: frontend completo com 586 testes, tipos, hooks e build; compatibilidade e formatação com 10 testes aprovados em PostgreSQL isolado. A primeira suíte ampla revelou ausência da chave sintética Oracle e montagem dos arquivos médicos no caminho errado; a execução foi corrigida. Também detectou conversão indevida de datas textuais da planilha: corrigida restringindo a formatação às colunas semânticas. A repetição completa e os testes dos renderizadores são registrados ao final.

## Medições anteriores à 31d

Chromium no servidor, porta 8091, cache desativado por CDP, cinco aberturas reais, somente GET. Relatórios 471–1.187 ms; Conexões 292–402 ms; vínculos de relatório 112–161 ms, conexão 54–118 ms; editor até exemplos 926–970 ms. Sem resposta 4xx/5xx. Essas medidas já atendem às metas e não são comparáveis diretamente ao túnel da revisão.

Perfil de consultas somente leitura: Relatórios nove consultas (43 ms somados; chamada fria incluindo imports 917 ms), Conexões seis (14 ms; 30 ms total), vínculos relatório oito (34 ms; 56 ms), conexão sete (7 ms; 25 ms), configuração do editor sete (22 ms; 130 ms). Nenhuma consulta individual acima de 14 ms nessa amostra. Não há evidência que justifique criar índices no banco real.
