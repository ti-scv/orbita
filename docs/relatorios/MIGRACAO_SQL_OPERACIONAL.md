# Migração SQL operacional — concluída em 27/10/2026

Foram convertidas 141 fontes operacionais: 93 adaptadas do ROB8 e 48 relatórios padrão do SCV. As 28 composições operacionais usam as mesmas fontes SQL, preservando IDs, páginas e blocos Canvas. Uma composição incompleta teve somente referências de fontes ajustadas; continua desativada e pendente de revisão.

Os cadastros possuem unidade padrão, período e tipo de envio. A edição SQL é feita no modal. São usadas onze conexões cadastradas, com seis usuários PostgreSQL restritos às visões das respectivas unidades. O acesso a tabelas da aplicação e outras unidades é negado no banco e validado na aplicação.

A migração comparou os resultados com os adaptadores anteriores antes da troca: dois períodos para as 93 fontes e três cenários para os 48 padrões. Foram testados isolamento real, múltiplos números, respostas tardias, revisões da agenda, cálculos, arredondamentos, API antiga, PDF, CSV e composições no Canvas. Quatro PDFs foram gerados em memória no ambiente publicado. A API de prévia retornou 200 com dados e 400 ao tentar selecionar outra unidade.

O histórico do ROB8 não foi importado. Unidades sem dados operacionais permanecem identificadas como pendentes de dados na planilha. Permissões e ativação foram preservadas, e nenhuma programação foi habilitada pela migração.

Documentação técnica e reversão: SQL_OPERACIONAL_POSTGRESQL.md. Evidências e backup anterior: /opt/backups/orbita/operational-sql-20261027/.
