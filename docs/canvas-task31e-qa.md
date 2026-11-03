# QA da tarefa 31e

## Acessibilidade

Antes, o axe da 31c registrou 50/49 violações sérias de contraste em Relatórios e 32/31 em Conexões (claro/escuro), além de título principal ausente e marcos duplicados nos diálogos. O arquivo `canvas-task31e-evidencias/t31e-axe-antes.json` conserva esse resultado.

Foram ajustados os tokens de texto, o título principal das listas e do editor, o cabeçalho do diálogo e o confinamento de foco quando o controle focado deixa de estar disponível. As abas de cadastro agora aceitam setas, Home e End e têm uma única parada de Tab. O estado no cabeçalho do editor passou a refletir se o relatório está ativo, que é também o estado usado para bloquear a edição; a publicação do Canvas continua controlada separadamente. Não houve troca de ícones.

Os resultados e as capturas `t31e-*` estão em `canvas-task31e-evidencias/`. A matriz usa dados e respostas sintéticos, cache desativado, viewport 1440 × 900 e CSS zoom. Ela não mede consultas reais nem substitui inspeção visual humana de todos os elementos. O relatório de axe completo por tela e tema está nos JSONs dos roteiros. As verificações de cadastro cobrem Escape e devolução de foco, Tab e Shift+Tab no diálogo de relatório, cancelamento do diálogo de conexão e setas nas abas; não demonstram todos os caminhos de teclado do produto.

## Remoção de componentes

O teste `canvas-task31e-remocao-e2e.cjs` usa um backend próprio e PostgreSQL descartável, com dois relatórios sintéticos. Nenhum salvamento ou remoção de relatório é feito. Delete, Backspace, ação Remover do menu do bloco, seleção múltipla com Shift/Ctrl e Desfazer foram verificados no rascunho. No ativo, as duas teclas e a ação do menu foram verificadas como bloqueadas após seleção. Resultados e capturas: `t31e-remocao-*` e `t31e-removido-*`. O teste não prova todos os modos de seleção ou telas de diálogo.

## Reprodução

Requer Docker, a imagem local `orbita-tests`, a imagem de navegador `orbita-t31b-qa` com Playwright e axe, e portas livres. Não use o banco de staging nem credenciais reais. No exemplo o banco é criado exclusivamente para este teste:
```sh
docker run -d --name orbita-t31e-test-db --network orbita_default -e POSTGRES_USER=orbita -e POSTGRES_PASSWORD=synthetic -e POSTGRES_DB=orbita_t31e postgres:17-alpine
```
Após `pg_isready`, rode no container `orbita-tests` com `DATABASE_HOST=orbita-t31e-test-db`, `DATABASE_NAME=orbita_t31e`, `DATABASE_USER=orbita`, `DATABASE_PASSWORD=synthetic`, `DJANGO_SECRET_KEY=t31e-isolated-tests-only` e `REPORT_REMOVAL_ENABLED=0`, montando `backend:/app`. Execute `python manage.py migrate operations 0030 --noinput` e depois `python manage.py migrate <app> --noinput` para cada um de `admin auth scheduling sessions`; confirme que nenhuma dependência seleciona 0031. Monte `/tmp:/out`, defina `CANVAS_QA_ISOLATED=1` e execute `python manage.py shell < /tmp/seed.py`. O roteiro recusa outro host de banco.

Suba a API desse banco em container isolado e o frontend apontando para ela em 8096. Com o arquivo de sessão criado em `/tmp/t31e-e2e-session`, execute o Playwright com `CANVAS_QA_ISOLATED=1`, `CANVAS_QA_URL=http://127.0.0.1:8096`, `CANVAS_SESSION_FILE=/session`, montando a sessão em `/session`, as evidências em `/prints` e o roteiro em `/qa/test.cjs`. Para a matriz sintética, sirva o frontend em 8095, monte cada roteiro `canvas-task31e-{cadastros,editor}-qa.cjs` em `/qa/test.cjs`, defina `CANVAS_QA_PRINTS=/prints` e execute `docker run --rm --network host ... orbita-t31b-qa node /qa/test.cjs`. Os roteiros interceptam as respostas da API; o de cadastros não executa remoção real.

## Registro de segurança e limites

A primeira suíte completa do backend criou automaticamente um banco de testes descartável com as migrações, incluindo 0031. Isso contrariou a instrução literal de não aplicar a 0031, embora tenha ocorrido apenas no banco de testes, nunca no banco real. A suíte posterior foi executada com `--nomigrations`. O banco do teste de navegador foi migrado somente até 0030. O banco real não foi usado para criar, editar ou remover dados, e nenhuma exclusão real foi executada.

A matriz automatizada verifica condições específicas de dimensões, botões, axe e foco; não estabelece ausência de todos os cortes ou sobreposições, nem cobre integralmente navegação por teclado em prévia e menus. O fluxo de prévia da matriz usa respostas simuladas. Os assuntos atribuídos à 31d permanecem fora desta alteração.

## Resultados finais

| Zoom | Claro | Escuro |
| --- | --- | --- |
| 80% | Passou nas verificações automatizadas | Passou nas verificações automatizadas |
| 100% | Passou nas verificações automatizadas | Passou nas verificações automatizadas |
| 125% | Passou nas verificações automatizadas | Passou nas verificações automatizadas |
| 150% | Passou nas verificações automatizadas | Passou nas verificações automatizadas |

Nos oito casos, axe não registrou violações nas listas, nos diálogos de remoção, no editor, na prévia simulada ou em Testar relatório; as verificações de botões, rolagem e foco implementadas nos roteiros passaram. A prévia de dados reais foi simulada. Os testes de remoção isolados passaram nos seis cenários do JSON. Esses resultados estão sujeitos às limitações descritas acima.

Após o rebase: `scripts/canvas-check.sh` passou (588 testes frontend, tipos, hooks e build). A suíte completa do backend com `--nomigrations` passou com 1.011 testes e um ignorado em PostgreSQL descartável. A execução anterior com migrações teve 1.003 aprovados e um ignorado, com a ressalva de 0031 registrada acima.
