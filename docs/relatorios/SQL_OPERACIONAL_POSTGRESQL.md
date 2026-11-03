# Consultas SQL operacionais do SCV

Foram convertidas 141 fontes operacionais locais (93 adaptadas e 48 padrões), com 28 composições atualizadas. As consultas SELECT são editáveis em Relatórios → Editar → Consulta SQL. Os blocos e páginas do Canvas são preservados. Os relatórios hospitalares Oracle, eSUS e demais fontes externas mantêm suas conexões próprias.

## Conexões e isolamento

Cada unidade de origem recebe uma conexão PostgreSQL de leitura, com senha criptografada, um usuário próprio sem privilégios administrativos e um schema scv_rpt_<id>. O usuário possui SELECT somente nas cinco visões desse schema: casos, mensagens, respostas, ligacoes e contatos. Cada visão tem security_barrier e filtra uma unidade literal. Não são concedidas permissões sobre tabelas da aplicação nem visões de outras unidades. A consulta é executada em transação de leitura, com timeout, limites de linhas e tamanho e validação das tabelas e funções permitidas.

A definição do relatório pertence à unidade administradora, mas sua conexão identifica a unidade de origem. O parâmetro unidade não pode ampliar essa origem. Uma consulta que omita o WHERE continua limitada pelas permissões e visões do banco. A função utilitária arredondar reproduz round(valor, 2) do Python para os indicadores agregados, inclusive empates e valores de ponto flutuante.

## Parâmetros

- unidade: slug da origem, preenchido por padrão e validado no backend.
- start e end: datas inicial e final. Nas 93 fontes adaptadas, o padrão é início do mês até hoje, com intervalo máximo de 366 dias. Nos 48 relatórios padrão, datas vazias preservam a consulta sem limite inicial/final, conforme o comportamento anterior. O final informado inclui todo o dia no fuso da origem.
- tipo_envio: agendamentos, ausentes, pós-procedimento, busca ativa CDR, convocação ou movimentações. O padrão preserva a finalidade cadastrada no relatório; vazio consulta todas as finalidades, mantendo outros filtros específicos da definição.

Os valores padrão de unidade e tipo são usados no WhatsApp sem adicionar perguntas ao fluxo. O painel permite selecionar o tipo; as datas continuam sendo solicitadas conforme o cadastro. Os filtros de clínica, categoria, procedimento e código de origem existentes permanecem explícitos no SQL e podem ser revisados pelo administrador.

## Validação e reversão

A migração compara todas as colunas e linhas com a implementação anterior do SCV no mês atual e nos últimos 30 dias; para os relatórios padrão também verifica o cenário sem datas. Todos os cadastros são alterados numa única transação somente se não houver divergências nem alterações concorrentes de versão. Isso valida a substituição do adaptador SCV, não constitui validação dos números históricos do ROB8. Nenhum histórico legado é importado por esta rotina.

A definição anterior, incluindo consulta, conexão, parâmetros, metadados e Canvas, fica em legacy.operational_sql_migration.previous. Cada alteração gera auditoria e incrementa a versão. As composições preservam as páginas e apontam para os mesmos IDs. Permissões, ativação e programações não são habilitadas pela migração.

Comando: python manage.py migrate_operational_reports_sql (inventário); acrescentar --apply para migrar. A senha do administrador é solicitada interativamente para criptografar novas credenciais. Não informar senhas como argumento de linha de comando. A execução é idempotente: definições já convertidas deixam de ser candidatas.

## Interface

A categoria é editável no modal do relatório e apresentada abaixo do nome na lista. Revisão e pendências aparecem como ícones, com descrição acessível e tooltip. Não há alteração das permissões de edição.

Evidências de execução e testes: /opt/backups/orbita/operational-sql-20261027/. O backup anterior do PostgreSQL está em before.dump, com acesso restrito ao administrador.
