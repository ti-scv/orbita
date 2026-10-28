# Origem eSUS e produção de ACS — 27/10/2026

O cadastro TBBASES do WhatsReport identifica o PostgreSQL eSUS em 167.249.56.126:54330, banco esus. As credenciais foram recuperadas e cadastradas criptografadas no SCV; a conta originalmente identificada era superusuária. Com autorização, foi criada a conta scv_esus_relatorios, limitada às sete tabelas necessárias; a conexão foi testada e permanece desativada até a validação dos relatórios. Não registrar credenciais neste documento.

A consulta original foi recuperada do executável do WhatsReport e consulta tb_fat_visita_domiciliar com dimensões do eSUS, filtrando a data do registro. Na janela de 12 a 27/10/2026, 26.965 visitas coincidem com a quantidade de registros em PRODUCAO_AGENTE no Firebird. Isso não comprova igualdade por unidade, dia ou profissional. A comparação detalhada no Firebird não concluiu dentro do prazo.

O componente SCV esus-visitas-agregadas-acs (ID 536) é uma consulta candidata de agregação por dia, unidade, profissional, CBO, microárea, desfecho e presença de identificação, sem retornar identificadores ou nomes de pacientes. Filtra o CBO 515105 e aceita data inicial e final. Teste no mesmo período: 5.210 visitas agregadas em 578 grupos. O componente está desativado e não revisado: a equivalência com os relatórios legados ainda precisa ser demonstrada.

São necessárias permissões SELECT sobre public.tb_fat_visita_domiciliar, tb_dim_tempo, tb_dim_unidade_saude, tb_dim_cbo, tb_dim_profissional, tb_dim_desfecho_visita e tb_fat_cidadao_pec, além de USAGE no schema public. A conta dedicada foi criada com SELECT somente nessas tabelas, USAGE no schema e transações em leitura por padrão. Foi verificada a ausência de permissões de escrita e de SELECT em outras tabelas fora dos catálogos do sistema.

O código compilado de PROC_INDICADORES_ESUS indica escrita em PRODUCAO_AGENTE_MENSAL. Não executar essa procedure no legado. Ainda faltam reconstituir e comparar os cálculos mensais, regras por unidade e profissional, parâmetros, layout Canvas e resultados dos relatórios. O limite de linhas deverá ser verificado para cada período. Não foram ativadas programações ou envios.
