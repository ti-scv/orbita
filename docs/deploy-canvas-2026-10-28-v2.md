# Deploy Canvas v2 — 28/10/2026

Origem: worktree limpo /opt/orbita-deploy-27ef2cc; HEAD 27ef2cc9c2b34281f3bce1a54b24c870d4546071, branch feature/canvas-redesign. Produção anterior: 396f078, confirmada nas imagens em execução. Nenhum push ou commit feito.

Backup antes de alterações: tag before-canvas2-20261028-1804 nas imagens orbita-panel, orbita-api, orbita-worker e orbita-scheduler. Dump /opt/orbita/backups/before-canvas2-20261028-1804.dump (27.432.183 bytes), catálogo pg_restore validado. Backups before-canvas-20261028-1151 preservados.

Imagens novas: orbita-panel:canvas-27ef2cc e orbita-api:canvas-27ef2cc (compartilhada por api/worker/scheduler). Backend reutiliza a base 396f078: Dockerfile e requirements idênticos, sem arquivos backend excluídos; COPY do backend inteiro do novo HEAD. Login commitado idêntico ao 396f078; Login.tsx local não incluído. Configuração e segredos vêm do Compose/.env original. Comando de API omite bootstrap para não semear dados reais. Flag REPORT_REMOVAL_ENABLED preservada.

## Reverter imagens

```bash
bash /opt/orbita-deploy-27ef2cc/rollback-images-v2.sh
```

Esse script usa /opt/orbita-deploy-27ef2cc/compose.rollback.yaml com Compose/env originais e recria somente api, worker, scheduler e panel com --no-deps --no-build. Não reinicia db/redis ou staging. Reversão validada em seco por bash -n, compose config -q e resolução das tags. Não restaura banco automaticamente.

## Reverter migração 0031

A 0031 adiciona somente nove campos anuláveis: removed_at, removed_by e removed_was_enabled em ReportDefinition, ReportConnection e ReportApplicationConnection. Não apaga tabelas nem registros. A versão anterior pode funcionar mantendo essas colunas; para reverter apenas imagens, não é necessário desfazer a migração.

Para desfazer o esquema, use a imagem NOVA, que conhece a migração. Isso remove as nove colunas e os metadados de remoção nelas existentes. Antes, confira se houve remoções reais; se houve, avalie o dump antes de perder esses metadados. Comandos exatos:

```bash
docker compose --project-directory /opt/orbita --env-file /opt/orbita/.env -f /opt/orbita/compose.yaml stop api worker scheduler
docker compose --project-directory /opt/orbita --env-file /opt/orbita/.env -f /opt/orbita/compose.yaml -f /opt/orbita-deploy-27ef2cc/compose.deploy.yaml run --rm --no-deps --interactive=false api python manage.py migrate operations 0030 --plan
docker compose --project-directory /opt/orbita --env-file /opt/orbita/.env -f /opt/orbita/compose.yaml -f /opt/orbita-deploy-27ef2cc/compose.deploy.yaml run --rm --no-deps --interactive=false api python manage.py migrate operations 0030 --noinput
bash /opt/orbita-deploy-27ef2cc/rollback-images-v2.sh
```

## Restaurar dump somente se a migração causar problema que exija restauração

Restauração substitui dados e perde gravações posteriores ao backup. Não executar como parte de reversão comum das imagens.

```bash
docker compose --project-directory /opt/orbita --env-file /opt/orbita/.env -f /opt/orbita/compose.yaml stop api worker scheduler
docker exec -i orbita-db-1 sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --exit-on-error' < /opt/orbita/backups/before-canvas2-20261028-1804.dump
bash /opt/orbita-deploy-27ef2cc/rollback-images-v2.sh
```

Log: /opt/orbita/backups/deploy3.log; logs de testes/build com prefixo deploy3 na mesma pasta. Evidências e monitor HTTP no worktree. Resultado final será registrado abaixo.

## Resultado final — SUCESSO

HEAD 27ef2cc publicado. Migração aplicada: operations.0031_report_removal; nenhuma outra pendente. Flag de remoção permanece desativada. Nenhum relatório/conexão criado, removido ou alterado pelos testes.

Testes: frontend hooks, TypeScript, 611 testes e build passaram; backend PostgreSQL descartável --nomigrations: 1.013 passaram, um ignorado. A execução inicial de backend foi interrompida para corrigir a configuração isolada, antes da execução completa válida.

A primeira publicação foi revertida automaticamente porque a imagem antiga da ferramenta de navegador não estava disponível. A ferramenta foi substituída pela orbita-t31b-qa já instalada e validada, seguida de nova publicação bem-sucedida. Migração mantida, sem restore.

http-monitor.jsonl.attempt1: panel, janelas observadas sem HTTP 200: [10.04, 14.02] segundos; soma 24.06s.

http-monitor.jsonl.attempt1: api, janelas observadas sem HTTP 200: [4.03, 10.04, 14.02] segundos; soma 28.09s.

http-monitor.jsonl: panel, janelas observadas sem HTTP 200: [3.01] segundos; soma 3.01s.

http-monitor.jsonl: api, janelas observadas sem HTTP 200: [3.01, 3.01] segundos; soma 6.02s.

Total aproximado incluindo publicação inicial, rollback e repetição: painel 27.07s; API 34.11s. Monitor nominal 1s, timeouts/carga podem ampliar intervalos; não representa precisão subsegundo.

Validação final: API healthy; panel/worker/scheduler running sem healthcheck configurado, zero reinícios nos quatro; login customizado visível sem erros JavaScript; sete GETs com sessão admin existente retornaram 200, incluindo listas removidos e ambas dependências; logs dos quatro sem novos erros após pelo menos 120s de execução.

Protected containers unchanged: 27
Own disposable frontend check container brave_wozniak ended normally.
Actual ReportCanvas HTTP 200 /assets/ReportCanvas-DQKrcCZH.js SHA256 c450a0c8201e9f8d9bb2c000fe10b4fbe3bb2b39f00ceaa3a6b715b96ac9fce0


Dry-run da migração reversa: migrate operations 0030 --plan lista somente os nove Undo AddField da 0031; SQL reverso guardado em migration-reverse-sql.txt. Não executado.

Rollback exato: bash /opt/orbita-deploy-27ef2cc/rollback-images-v2.sh — o mesmo procedimento foi executado com sucesso na primeira tentativa. Não restaura o dump.

Final UTC: 2026-10-28T18:15:38.342246+00:00

FIM-DEPLOY3 (sucesso)
FIM-DO-PROCESSO
