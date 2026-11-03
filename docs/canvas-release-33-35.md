# Release Canvas 33 + 35 — preparação

Base: `32c69c7`. Integrações: `a6be4ff` (33) e `768b77e` (35); merges `adb2ff6` e `dd86c69`. A lista completa dos commits alcançáveis pelos dois merges e ausentes da base pode ser consultada com `git log --oneline 32c69c7..dd86c69`. Não há push nem mudança em main. A remoção de relatórios permanece desativada por padrão (`REPORT_REMOVAL_ENABLED=0`).

## Migrações desde 32c69c7

| Migração core | Mudança | Downgrade e perda de dados |
| --- | --- | --- |
| 0008_report_whatsapp_permission | Cria registro de apoio e adiciona permissão WhatsApp de relatórios aos vínculos existentes. | Reversível: remove valores migrados que ainda não mudaram e a tabela de apoio. Valores modificados depois são preservados; perde-se o registro de apoio. |
| 0009_permission_roles | Cria tipos de permissão por unidade. | Reversível, mas excluirá todos os tipos criados e suas permissões. |
| 0010_preserve_task35_access | Ajusta permissões de mensagens e relatórios para preservar acesso e guarda valores anteriores. | Reversível para valores que ainda coincidem com os migrados; edições posteriores são preservadas. A tabela de apoio é excluída. |
| 0011_preserve_settings_access | Ajusta acesso a configurações e guarda valores anteriores. | Reversível nas mesmas condições; exclui a tabela de apoio. |
| 0012_membership_permission_role | Adiciona referência opcional do vínculo ao tipo. | Reversível, mas perde todas as associações vínculo–tipo. |

O downgrade seguido de upgrade foi executado em uma cópia descartável do banco de teste: 0012 a 0008 foram revertidas até 0007 e novamente aplicadas com sucesso. Isso não recupera tipos ou associações excluídos pelo downgrade. `operations` apresenta aviso preexistente de divergência entre modelos e migrações com a flag de remoção desligada.

## Preparação de deploy futuro, sem criar backup novo

1. Revisar esta integração e os resultados dos testes; não executar o deploy enquanto houver falhas não resolvidas. Confirmar disponibilidade e adequação do backup já existente e das imagens de rollback; não criar backup novo nesta tarefa.
2. Preparar checkout imutável do commit de release e imagens versionadas de backend e painel. Preservar a versão personalizada do `frontend/src/components/Login.tsx` existente no servidor: incorporá-la apenas ao contexto de build temporário, sem commit, e verificar o resultado. Preservar `.env`, credenciais cifradas e configuração de produção; não copiar dados de staging.
3. Preparar override Compose apontando api, worker e scheduler para a nova imagem backend e panel para a nova imagem frontend; manter rede, volumes e configuração existentes. Inspecionar `docker compose ... config` e `python manage.py migrate --plan` no contexto apropriado antes de aplicar. As migrações 0008–0012 mudam dados e esquema; coordenar janela e acesso ao banco já existente.
4. Na janela autorizada, aplicar migrações uma vez com a imagem nova; substituir a API, aguardar saúde, depois worker, scheduler e painel. Confirmar saúde, sessão, permissões, relatórios e logs, mantendo `REPORT_REMOVAL_ENABLED` desligada. O script de deploy anterior exige plano vazio e imagens antigas fixas: não reutilizá-lo sem adaptação e revisão.
5. Em caso de falha de aplicação, restaurar as imagens anteriores com:

```bash
bash /opt/orbita-deploy-release-33-35/rollback-to-32c69c7.sh
```

Esse comando recria api, worker, scheduler e panel com as imagens orbita-api:canvas-32c69c7 e orbita-panel:canvas-32c69c7. **Não faça downgrade das migrações**: ele apagaria tipos de permissão e associações entre vínculos e tipos criados após a atualização. O script não reverte migrações, esquema ou dados.

## Staging descartável

`127.0.0.1:8105`, rede `orbita-release-37r`, banco `orbita-release-37r-db` copiado do banco de teste 8100; não usa 8091 nem banco real. Conta `teste37` é superusuário; senha exclusivamente em `/workspace/orbita-canvas/teste37.txt` na máquina da tarefa. Os tipos e usuários qa23/qa25 e a instância simulada vieram do banco 8100. As unidades qa33c/d/e e um relatório simples por unidade foram criados como equivalentes, não são cópias dos relatórios originais. Login e saúde retornaram HTTP 200. Os dados são descartáveis.

## Validação da integração

Backend em PostgreSQL isolado, com dados de apoio montados e chaves descartáveis: 1.282 testes aprovados e cinco pulados com a flag de remoção desligada. Em execução separada com a flag ligada somente no teste, os cinco testes de remoção e os testes direcionados de relatórios somaram 62 aprovados. Os testes de paginação foram ajustados para aceitar continuações e procurar os textos no documento inteiro. Frontend em Node 24: 665 testes aprovados em 75 arquivos, TypeScript, ESLint de hooks e build aprovados; build avisa sobre chunk maior que 500 kB. A primeira execução do backend sem as chaves e arquivos de apoio apropriados apresentou falhas de configuração; foi substituída pela execução completa acima.

## Compatibilidade de volta para 32c69c7

Em 29/10/2026, uma cópia descartável do banco do staging 8105, já com core até 0012, foi restaurada em PostgreSQL isolado. A API e o painel das imagens `canvas-32c69c7` foram iniciados nessa cópia, sem reverter migrações. Login, opções e lista de usuários e gravação de acesso existente retornaram HTTP 200; a lista de relatórios da unidade qa33c retornou HTTP 200 com um relatório. O painel antigo abriu após login e a tela de relatórios carregou. Não houve HTTP 500 ou traceback nos logs da API durante as verificações. A gravação testada preservou os valores enviados; o teste não cobre todas as combinações de dados ou ações posteriores ao rollback.

## Verificação final 37s

O staging descartável 8105 foi reconstruído com a API e o painel atualizados; painel HTTP 200 e migrações sem pendências. Em Node 24, 665 testes de frontend em 75 arquivos, TypeScript, ESLint de hooks e build passaram; o build mantém o aviso de chunk acima de 500 kB. A suíte direcionada de usuários e permissões de relatórios passou: 51 testes em PostgreSQL isolado. O aviso preexistente de divergência de modelos em `operations` permanece.

## Layouts existentes

Em 29/10/2026, o relatório ativo `id=1` da unidade de teste `qa33c` no 8105 tinha `enabled=true`, `canvas_enabled=true` e `canvas_layout={}`. O modal de edição exibe a pendência porque `readiness` chama `report_readiness` e `definition_snapshot`, que validam o layout armazenado e rejeitam `{}` por não ter `schema_version=1`. Trata-se do relatório simples criado para o staging descartável, não de um formato legado válido. No 8095, o relatório `id=1` de `qa33c` tem layout Canvas versão 1 com página e bloco; os dados dos dois ambientes não são equivalentes. O validador `schema.py` e o parser `model.ts` são idênticos em `a6be4ff`, na base de produção `32c69c7` e na release `7354299`; a pendência não foi introduzida pela release.

A produção foi consultada com `BEGIN READ ONLY`, `SELECT` de id, unidade, estados `enabled` e `canvas_enabled` e layout de todos os registros, e `COMMIT`. Os dados extraídos foram validados fora do banco pelos validadores reais das imagens da release e de `32c69c7`, em contêineres sem rede. Também passaram pelo `normalizeLayout` real do frontend e novamente pelo backend. Os arquivos temporários com dados foram removidos ao final.

| Resultado | Release 7354299 | Produção 32c69c7 |
| --- | ---: | ---: |
| Registros consultados | 396 | 396 |
| Layouts brutos que geram “Layout inválido ou versão não suportada.” | 59 | 59 |
| Desses, com Canvas ativado (`canvas_enabled=true`) | 0 | 0 |
| Desses, com relatório ativo (`enabled=true`), mas Canvas desativado | 10 | 10 |
| Layouts brutos válidos | 328 | 328 |
| Rejeitados por bloco fora dos limites | 9 | 9 |
| Aceitos após normalização do frontend | 396 | 396 |

Os 49 restantes entre os 59 também têm relatório e Canvas desativados. Os nove layouts com bloco fora dos limites têm relatório ativo e Canvas desativado, e produzem outra mensagem se validados diretamente; a normalização os ajusta. Para layouts vazios, a resposta de configuração Canvas fornece o layout padrão; o parser também usa padrão para versão ou páginas inválidas e pode ajustar conteúdo, portanto aceitação após normalização não prova preservação integral do desenho. A contagem operacional da mensagem no caminho de prontidão do modal é **zero em ambas as versões** para os dados consultados, pois esse caminho valida o layout armazenado apenas quando Canvas está ativado. Isso não cobre outras falhas de prontidão, fontes ou imagens.

Não há regressão de formato que justifique alteração de código, migração ou rebuild. Nenhum dado de produção foi alterado. Referências: release `7354299`, fila `a6be4ff`, produção `32c69c7`; este registro é alteração documental local, sem push.
