# Integração local 37q

Base: `adb27fb` (`428dd33` mais 37p), branch `feature/canvas-release-merge`. Commit de implementação: `173d8dd9c9a42013ad0eab0b484274ee625057d2`. O SHA final, incluindo este relatório, está no log `local-changes-2/task-37q.log`: um commit não pode conter seu próprio SHA.

## Retrato e alterações novas

O retrato somente de leitura de `/opt/orbita`, no HEAD `32c69c730773f42a49d71a503dbf8abb55366458`, está em `/opt/orbita-deploy-release-33-35/local-changes-2/`: status, HEAD, `local.patch` binário, lista e arquivo tar dos não rastreados, e `differences.txt` comparando árvores reconstruídas a partir dos dois retratos. O tar inclui `teste.bin` (2 GiB), que não foi commitado. O arquivo de auditoria e o login também não foram commitados. Os dois arquivos com sufixos `brand-wordmark.png1` e `logo-scv-messenger.pngq` são cópias das imagens anteriores, preservadas no retrato, sem uso no produto.

As mudanças novas são: `compose.yaml` ativa `REPORT_REMOVAL_ENABLED` na configuração compartilhada do backend, habilitando o recurso de remoção de relatórios; `ReportWorkspace.tsx` identifica com o ícone SCV conexões PostgreSQL locais no host `db`; `brand-wordmark.png` e `logo.png` atualizam imagens de marca; `PatientChat.tsx` e `chat.css` acrescentam saudação, animações e resumo estruturado da reserva com paciente, especialidade, profissional, data, hora e tipo, e retiram um aviso redundante da fila humana. O resumo mantém a apresentação genérica quando a mensagem não corresponde ao formato esperado.

A aplicação do delta preservou o código da release, inclusive as alterações 37p no CSS do console e as permissões. Não houve conflitos manuais; o trecho de relatório aplicou com deslocamento de linhas. Foi adicionado teste do resumo e estendida a regra de movimento reduzido às novas animações de entrada. Nenhuma migração foi criada.

## Produção observada

A inspeção foi somente de leitura. Horários abaixo em São Paulo. Os contêineres e IDs completos estão em `local-changes-2/production-images.txt`:

| Serviço | Contêiner | Imagem SHA-256 (prefixo) | Criado |
| --- | --- | --- | --- |
| panel | `1489b726a0fb` | `f28d71bc9176` | 12:27 |
| api | `744dd6a10b43` | `20bd7f3a5bc2` | 12:34 |
| worker | `fee1f80479c1` | `c68192a293b0` | 12:34 |
| scheduler | `9f2596edfcfe` | `c801b456064e` | 12:34 |
| autoagenda-api | `edd0b37b3b1a` | `2ae1d1a04d5f` | 12:34 |
| autoagenda-web | `686089c1c841` | `8f9387aab1c7` | 10:03 |

A API em execução não contém `core/permission_roles.py` de `428dd33`; `core/access.py` e `operations/report_canvas/pdf.py` também têm hashes diferentes. O bundle do painel contém o novo indicador PostgreSQL local, mas não a referência `reportWhatsApp` da release nem a regra `.aa-console{min-width:0;margin-bottom:24px}` do ajuste 37p. Assim, há partes anteriores do Canvas e do autoagendamento, mas não a release 33+35/37p completa. A comparação de amostras não identifica todas as diferenças possíveis.

A consulta somente de leitura a `django_migrations` não encontrou migrações aplicadas em 29/10 a partir de 12:00 -03. `showmigrations autoagenda` mostra `0001_initial` e `0002_booking_autoagenda_unique_active_slot` aplicadas em 28/10 às 23:22 e 23:35 -03, respectivamente. Não existe migração nova no delta de Danilo.

## Validação

O frontend foi construído com Node 24 e o login personalizado aplicado somente à cópia temporária de build. Suíte completa: 671 testes aprovados em 76 arquivos. Build separado do chat público e seus cinco testes específicos também passaram. Logs em `local-changes-2/frontend-tests.log` e `autoagenda-check.log`.

Staging descartável em `127.0.0.1:8115`, usando banco PostgreSQL e unidade Sansaúde fictícios já criados na 37n, envio simulado e API isolada. Foi reiniciado o serviço de staging com a árvore integrada e reconstruído o painel; o chat público está em `/autoagenda.html`. Smoke verificou HTTP, login, sessão, quatro grupos, workspace, relatório, Canvas, configuração e console fictícios e recusa de GET público inválido. Resultado em `staging-smoke.log`. Nenhum serviço do projeto de produção foi reiniciado ou reconstruído.

Backend completo em PostgreSQL isolado, chaves fictícias e arquivos de relatório montados somente para leitura: **1.297 aprovados, 5 ignorados**, sem falhas, em 384,52 s. As duas falhas da execução antiga `backend-postgres.log` (`test_cross_body_parameters_are_in_meta_request` e `test_all_sections_share_readonly_session_and_dates`) não reapareceram na execução corrigida anterior nem nesta. O log completo desta execução está em `local-changes-2/backend-tests.log`; os dois nomes e o ambiente da execução antiga estão em `local-changes/backend-postgres.log`. Esta comparação não usa a execução antiga com configuração incompleta como resultado da release.
