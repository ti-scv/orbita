# Tarefa 12 — polimento da Prévia

Trabalho em `/opt/orbita`, no Orbita, branch `feature/canvas-redesign`.
Base encontrada: `483e84e` (abertura da Prévia com padrões). Não houve rebase,
alteração do login, push, comando migrate ou implantação na porta 8080.

## Comportamento

- Texto fixo/título no modo Prévia recebe “Texto do relatório”. “Exemplo” fica
  restrito ao modo de montagem com dados sintéticos. A tabela mantém sua
  identificação de Prévia, quantidade, período e linhagem da fonte no tooltip.
- Datas ISO aparecem como `dd/mm/aaaa`; horários diferentes de meia-noite
  aparecem como `HH:mm:ss`, preservando a data/hora da fonte, sem converter fuso.
  A regra também está no formatador de tabelas do PDF, coberta por pytest.
- Valores nulos, vazios ou só com espaços aparecem como “—”. Zero e valores
  preenchidos continuam visíveis. Os dados da fonte permanecem inalterados.
- A rota de relatórios deixa de disparar as dez consultas do painel geral
  (indicadores, agendamentos, mensagens etc.). O esqueleto desse painel também
  deixa de aparecer abaixo da lista. A sequência de carregamento invalida
  respostas antigas ao entrar na rota. A consulta de metadados do relatório
  e o download do módulo do editor começam em paralelo.

## Investigação do relatório 6

A resposta real de `canvas-source-preview` trouxe 50 linhas, com colunas
`Paciente, Telefone, Finalidade, Data, Resposta, Resultado, Atendimento, Responsável`.
Resultado (índice 5) e Responsável (índice 7) estavam vazios em todas essas
50 linhas. Em `operations/reports.py`, os valores vêm diretamente de `c.outcome`
e `c.assignee.username` (ou string vazia quando não há responsável). Não houve
inversão de colunas. Os testes exercitam reordenação com vazios e valores
preenchidos para evitar que a correção esconda dados existentes.

## Medição e validação

A demora de 20–30 s não se reproduziu na medição inicial desta sessão:
lista 1543 ms, editor 1090 ms, Prévia 478 ms; API da lista 136 ms,
metadados 61 ms e fonte da Prévia 240 ms. São medidas de navegador no próprio
Orbita, incluindo carregamento da página, sem garantia de tempo em rede remota.
O boot CSRF + sessão respondeu em 21 + 28 ms; o login não foi alterado.
A carga concorrente das consultas desnecessárias foi confirmada no navegador.

- `scripts/canvas-check.sh`: TypeScript, 456 testes e build passaram.
- `docker compose run --rm --no-deps tests pytest -q -p no:cacheprovider tests/test_report_canvas.py tests/test_report_canvas_ports.py tests/test_canvas_preview_columns.py`: 67 testes passaram, em banco de testes isolado.
- `scripts/canvas-task12-qa.cjs`: navegador autenticado, somente leitura e POST
  de consulta da Prévia; bloqueia salvamentos e qualquer outra escrita.
- Evidências locais (fora do Git): `artifacts/task12/`. A sessão reutilizada
  fica temporariamente em arquivo privado, nunca no script nem no commit.

O staging usa a API já existente. Apenas o frontend é reconstruído com
`scripts/canvas-stage.sh up`; a alteração do formatador Python fica validada
localmente pelos testes, sem atualização da API de produção.

Validação final do staging reconstruído:

- HTTP 200 em `/relatorios/6/canvas?unit=ame`, porta local 8091.
- Lista 1093 ms, editor 1030 ms, Prévia 402 ms. As dez consultas de outros
  painéis não aparecem mais nas requisições da lista. A API da lista respondeu
  em 143 ms; não foi identificada consulta pesada que justificasse 20–30 s.
- Navegador a 1100 × 900 px, temas claro e escuro: nenhum erro de JavaScript,
  nenhuma escrita em relatório, zero chips “Exemplo” na Prévia, datas formatadas,
  vazios explícitos, sem overflow horizontal nem sobreposição entre área de
  edição e inspetor. A ação de ajustar altura fica dentro do inspetor.
- Pendência de investigação: a espera original de 20–30 s não foi reproduzida;
  as medidas desta sessão não comprovam seu comportamento em outras redes ou
  sob outra carga. A API de produção e seu formatador não foram implantados.
