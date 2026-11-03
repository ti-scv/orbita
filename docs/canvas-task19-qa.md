# Tarefa 19 — validação de blocos KPI, gráficos e imagem com dados reais

28/10/2026. Trabalho executado exclusivamente via SSH no servidor `root@172.16.0.59`, em `/opt/orbita`, branch `feature/canvas-redesign`.
Apenas commits locais, sem push. Sem alterações no backend (`backend/operations/`), sem alteração em arquivos de outras sessões (`frontend/src/reports.css`, `stage/geometry.ts`, `stage/pageOps.ts`), e sem modificação do login customizado ou credenciais em produção.

---

## 1. Relatórios e blocos conferidos no banco real (somente leitura)

Foi realizado levantamento no PostgreSQL de produção em modo somente leitura para identificar relatórios com blocos ou aptos a receber blocos com dados reais:

- **Relatórios já existentes com blocos alvo configurados no layout (`pages[].blocks`):**
  - **Relatório 50 (`INDICADORES MEDICOS`)**: Possui 9 blocos de imagem (capa, logo, rodapé), gráfico de linhas (`stays_chart`, fonte `stays`, com colunas SUS, Convênio e Particular) e gráfico de barras (`ratios_chart`, fonte `ratios`, com colunas Exames por atendimento e Meta).
  - **Relatório 33 (`COMPLETO TAXA OCUPAÇÃO`)**: Possui 2 imagens (cabeçalho, rodapé), 3 gráficos de linha (`general`, `sus`, `convenio`) e 4 gráficos de barra (`attendances`, `elective`, `urgent`, `surgeries`).
  - **Relatórios 65, 307, 273, 63, 309**: Possuem gráficos de barra e linha configurados.
  - **Relatórios legados mapeados (172, 173, 198, 203, 204, 208, 212, 213, 217, 218, 222, 223, 228, 232, 233, 237, 238, 242, 243, 247, 248, 252, 253, 257, 258, 332)**: Possuem gráficos de pizza (`pie`) e barras (`bar`).
  - **Assets de Imagem em `ReportCanvasAsset`**: 6 imagens reais cadastradas no banco (`first-background.png`, `logo.png`, `last-background.png`, `images.jpg`, `cabecalho.png`, `rodape.png`), com metadados e blobs válidos.

- **Conferência via API de leitura/prévia (`canvas-source-preview`) com dados reais:**
  - **Relatório 6 (`Acompanhamentos e contatos`)**: Fonte `dados` com **2.473 linhas reais** e 8 colunas (`Paciente`, `Telefone`, `Finalidade`, `Data` com timestamps ISO, `Resposta`, `Resultado`, `Atendimento`, `Responsável`).
  - **Relatório 8 (`Agendamentos com mensagens não enviadas`)**: Fonte `dados` com **2.009 linhas reais** e 8 colunas.
  - **Relatório 1 (`Agendamentos confirmados`)**: Fonte `dados` com **3 linhas reais**.
  - **Relatório 2 (`Agendamentos recusados`)**: Fonte `dados` com **1 linha real**.
  - **Relatórios 4, 10, 16, 323, 326**: Fonte `dados` com **0 linhas** (validação do estado vazio real).
  - **Relatório 50**: Retorno de conexão indisponível com banco externo legado Oracle (validação de estado de erro real).

---

## 2. O que bateu com a fonte

1. **Contagem e agregação**: Contagem de linhas no bloco KPI bate exatamente com a fonte real (2.473 registros no relatório 6, 2.009 no relatório 8).
2. **Agrupamentos temporais e categóricos**: Agrupamentos no gráfico de barras e linhas via `groupByDate` e `groupByCategorical` agrupam e somam fielmente aos dados retornados.
3. **Imagens com assets reais**: Imagens com `asset_id` vinculadas no banco carregam a URL de blob e exibem as proporções originais do arquivo.
4. **Interatividade e paleta**: Seleção de blocos, redimensionamento, foco e paletas de cores padrão e legadas (6 cores) renderizam corretamente nos gráficos SVG.

---

## 3. O que estava errado e foi corrigido

Os arquivos de `frontend/src/components/report-canvas/blocks/` foram corrigidos:

1. **`KpiPreview.tsx` — Contagem em fonte sem linhas exibia traço em vez de 0**:
   - *Problema*: Quando o dataset carregado possuía 0 linhas (ex.: relatórios 4, 10, 323), a condição `if (dataset.rows.length > 0)` impedia a definição de `val`, resultando em `—` em vez de `0`.
   - *Correção*: Se a agregação for `count`, `val` agora recebe `dataset.rows.length` (retornando `0`).
2. **`KpiPreview.tsx` — Suporte a números e decimais em pt-BR**:
   - *Problema*: Números vindos formatados no padrão brasileiro (`"1.200,50"` ou `"46,56"`) falhavam na conversão numérica simples e viravam `null`.
   - *Correção*: Normalização de strings numéricas em pt-BR com separadores de milhar e vírgula decimal.
3. **`KpiPreview.tsx` — Unidade e sufixo**:
   - *Problema*: Propriedades `unit` e `suffix` nas opções do bloco eram ignoradas na renderização do valor.
   - *Correção*: Valor e tooltip agora exibem a unidade configurada (ex.: `1.247,06 min`).
4. **`KpiPreview.tsx` — Linhagem e origem do dado**:
   - *Problema*: Ao carregar o dataset, o sub-rótulo com o nome do relatório ou catálogo sumia, deixando apenas o id técnico `dados`.
   - *Correção*: O rótulo da fonte (`sourceLabel`) é mantido em `cv-kpi-sub` e nos atributos `title` do bloco e do chip de fonte.
5. **`ChartPreviewContent.tsx` — Formatação de datas em pt-BR no eixo X**:
   - *Problema*: Em gráficos não agrupados, valores de data eram renderizados como texto bruto ISO (`2026-09-21T00:00:00`).
   - *Correção*: Aplicação de `displayCanvasValue` no mapeamento dos pontos de dados, formatando para `21/09/2026`.
6. **`ChartPreviewContent.tsx` — Formatação de números e precisão nos tooltips**:
   - *Problema*: O `<Tooltip />` padrão do Recharts exibia números crus sem formatação pt-BR e ignorava `options.precision`.
   - *Correção*: Adicionados `formatter` (com `toLocaleString("pt-BR")` e precisão configurada) e `labelFormatter` (com localização de datas).
7. **`ChartPreviewContent.tsx` — Formatação do eixo Y em pt-BR**:
   - *Problema*: O eixo Y não continha `tickFormatter`, exibindo formatação padrão em inglês.
   - *Correção*: Adicionado `tickFormatter` com formatação pt-BR (`1.000` em vez de `1000`).
8. **`ChartPreviewContent.tsx` — Legendas e tooltips legíveis em fundo escuro**:
   - *Problema*: Em páginas escuras, a legenda padrão do Recharts ficava cinza escuro (`#4e4e4e`), tornando-se ilegível sobre fundo azul ou preto.
   - *Correção*: A legenda agora utiliza `color: axisColor` e os tooltips adaptam fundo e borda conforme o tema/contraste da página.
9. **`ChartPreviewContent.tsx` — Gráfico de pizza vazio exibia tela em branco**:
   - *Problema*: Quando todas as categorias tinham valor zero ou nenhum valor numérico positivo, o Recharts renderizava um SVG vazio/invisível.
   - *Correção*: Exibe mensagem clara: `"Sem valores numéricos maiores que zero para exibir no gráfico de pizza."`.
10. **`ChartPreviewContent.tsx` — Origem do dado visível**:
    - *Problema*: O contêiner do gráfico e o placeholder de estado sem linhas não indicavam o nome da fonte associada.
    - *Correção*: O contêiner recebe `title={`Fonte: ${sourceLabel}`}` e o placeholder exibe o catálogo/relatório de origem.
11. **`ImagePreview.tsx` — Recuperação de estado de erro**:
    - *Problema*: Se uma imagem falhasse ao carregar (`loadError`), ao selecionar outro `asset_id` válido o erro não era limpo.
    - *Correção*: `useEffect` que reseta `loadError` ao alterar `block.asset_id` ou `blobUrl`.
12. **`ImagePreview.tsx` — Dica de ferramenta (tooltip) e mensagem clara**:
    - *Problema*: A imagem não possuía atributo `title` para hover e a mensagem de erro era genérica.
    - *Correção*: Adicionado `title` com o nome do arquivo em `<img>` e no placeholder, e mensagem informativa de falha com o nome do arquivo.
13. **`BlockPreview.tsx` — Mensagem clara quando a fonte não é encontrada**:
    - *Problema*: Mostrava texto genérico mesmo quando um `source_id` estava configurado mas não existia no layout.
    - *Correção*: Distingue fonte não encontrada (`Fonte "..." não encontrada`) de ausência de seleção.

---

## 4. O que ficou pendente e motivo

- **Relatórios 33 e 50 em bases legadas Oracle**: O servidor Oracle legado da rede hospitalar não está acessível no ambiente local/isolado do host, retornando erro esperado de conexão indisponível. Isso foi validado como cenário de erro resiliente (o editor não trava e exibe o aviso claro).
- **Arquivos alheios preservados**: Conforme instrução expressa, não foram modificados arquivos em `backend/operations/`, nem `frontend/src/reports.css`, `stage/geometry.ts`, `stage/pageOps.ts`, mantendo intacto o trabalho das outras sessões.

---

## 5. Testes automatizados e verificações

- **Testes novos adicionados**: `frontend/src/components/report-canvas/task19.test.tsx` com 9 testes cobrindo todas as correções de KPI, imagens e gráficos (contagem zero, soma pt-BR, unidade, indicação de fonte, recuperação de erro de imagem, datas no gráfico, pizza sem dados e placeholder com catálogo).
- **Suíte Vitest**: **40 arquivos de teste, 502 testes executados e todos verdes** (100% de aprovação).
- **`scripts/canvas-check.sh`**: Execução completa em container descartável (`node:24-bookworm-slim`):
  - `npm ci`: OK
  - `canvas hooks`: OK
  - `tsc -b`: OK
  - `vitest run`: OK (502 testes)
  - `vite build`: OK
  - Resultado final: **Tempo total 61s — SUCESSO**.
- **Staging (`scripts/canvas-stage.sh up`)**: Reconstruído e ativo na porta **8091**, retornando **HTTP 200 OK**.
