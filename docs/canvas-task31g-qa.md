# QA 31g

Trabalho em `feature/canvas-redesign`, sem push, sem exclusão real e sem aplicar a migração 0031 ao banco real. Os testes de prévia usam 8097 e PostgreSQL descartável; o staging 8091 compartilha o banco real e só recebeu GETs. `Login.tsx`, a auditoria estática e `teste.bin` foram preservados fora do commit.

| Item | Antes | Depois e evidência |
| --- | --- | --- |
| 1 | Nome cortado a 150%. | Cabeçalho cresce com o nome e desloca ações; título completo em `title`. Matriz Chromium em 80, 100, 125 e 150%, temas claro e escuro, com nomes curto e longo, usando `--force-device-scale-factor` desde a abertura. Ver resultados em `canvas-task31g-evidencias/`. |
| 2 | Diálogo chamado “JSON do canvas”. | “Código do relatório (avançado)”; rótulos, confirmação, erro, limite de tamanho e ação de desfazer usam “código do relatório”; “canvas” no controle de publicação virou “modelo”; campos de componentes e execução usam “código e parâmetros” e “avançado”; exemplo SQL não usa `schema`. Identificadores técnicos internos e o próprio conteúdo editável permanecem intactos. |
| 3 | Motivo para relatório ativo só no diálogo. | Texto visível pede para desativar, botão fica desabilitado e lixeira tem título e nome acessível com motivo. Mensagem de ambiente orienta procurar o administrador. Teste em `ReportRemoval.test.tsx`. |
| 4 | Tipo PostgreSQL repetido. | Tipo aparece na coluna Banco e, quando conhecido, o destino Orbita aparece sem repetir o tipo. |
| 5 | Ctrl+ e Ctrl− interceptados em todo o editor. | Zoom da prancha só é capturado com foco ou ponteiro sobre ela; fora, o navegador recebe os atalhos. Ctrl+0 segue a mesma regra. |
| 6 | Capitalização alterava nomes exibidos. | Os nomes de dados são exibidos como recebidos; textos de ação usam frases completas e aspas quando necessário. |
| 7 | Contagem de pendências pouco explicativa. | O resumo tem indicação para clicar e mostra a lista de ações necessárias ao expandir. |
| D/K | Faltava evidência real na revisão. | PDF real de prévia de 24 colunas gerado no banco descartável, com telefone `+55 (17) 99127-9767` formatado (quebra de linha na coluna estreita); `xyz=1` mostra aviso amigável. Matriz registra as telas e o PDF. |
| Removidos | Verificar listas sem 503. | No ambiente isolado, ambas seções abrem e exibem que a remoção está desativada, com orientação ao administrador. As URLs de listagem com `removidos=1` já retornaram 200 na matriz 31f; o estado desativado não lista registros. |
| E | 31f sem túnel: lista 383–1.116 ms e editor 939–1.044 ms, cinco amostras. | A página do editor passou a ser carregada sob demanda. Build: arquivo principal 599,07 kB (169,96 kB gzip) antes, 592,12 kB (168,26 kB gzip) depois; página separada 7,53 kB (2,26 kB gzip), além do editor já dividido. Valores gzip são do build, não uma medição de rede. Não foi demonstrado se os 13 s relatados vieram de API fria ou transferência; a comparação de tempo depois deve ser feita no servidor. |

A matriz usa fator de escala no lançamento e viewport proporcional, verifica ausência de rolagem horizontal da página e integridade do título. Isso não substitui inspeção de todos os elementos ou medição do controle de zoom do navegador. Não foram alterados os dados reais.
