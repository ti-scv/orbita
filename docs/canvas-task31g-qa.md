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

## Fechamento após integração

- `canvas-check.sh`: hooks, tipos, 594 testes e build passaram. Backend com PostgreSQL descartável, `--nomigrations`, chaves sintéticas e remoção habilitada somente no processo de teste: 1.012 passaram, um ignorado. A primeira tentativa carecia de chaves sintéticas; foi repetida em banco de teste novo.
- Após corrigir uma sobreposição descoberta na inspeção do nome longo, as duas matrizes finais passaram em oito pares de escala e tema cada, com nome curto e longo. Os arquivos `final-curto/matriz.json` e `final-longo/matriz.json` registram os limites do título e a ausência de rolagem horizontal da página; PDF e capturas estão no diretório de evidências. O fator de escala foi aplicado ao lançar o Chromium e a viewport foi ajustada proporcionalmente.
- Medições posteriores, no servidor sem túnel e com cache desativado: lista 1.598, 398, 368, 381 e 355 ms; editor 1.494, 965, 927, 923 e 957 ms. São navegações reais somente GET, incluindo renderização; a primeira é mais lenta. Transferência gzip do novo arquivo principal: 169.697 bytes por HTTP; o valor anterior disponível é o estimado pelo build, não uma medição de rede equivalente. Ainda não se isolou a causa da primeira carga de 13 s relatada no túnel.
- Staging 8091 reconstruído a partir de uma cópia limpa do commit integrado, API `orbita-canvas-task26-api` reiniciada; `index-S5izCFgP.js` retornou HTTP 200. A mudança local de Login ficou fora do build e do commit.

Limites da verificação: a matriz verifica limites do título e rolagem horizontal do documento, não detecta automaticamente toda possível sobreposição ou corte em todos os controles. As seções de removidos foram exercitadas com a funcionalidade desativada, não com a listagem vazia habilitada. A revisão de termos cobriu os rótulos encontrados nas telas de relatórios, mas não constitui prova exaustiva de todos os textos dinâmicos retornados pela API. Os atalhos condicionais de zoom não foram exercitados em navegador por teste automatizado. Não há comparação de transferência anterior por HTTP nem diagnóstico conclusivo para os 13 s iniciais.
