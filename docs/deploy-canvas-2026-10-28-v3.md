# Deploy Canvas v3 — 28/10/2026

Produção atualizada de 27ef2cc para 32c69c730773f42a49d71a503dbf8abb55366458, a partir do worktree destacado /opt/orbita-deploy-32c69c7. Imagens: orbita-panel:canvas-32c69c7 e orbita-api:canvas-32c69c7 (API, worker e scheduler). O login customizado permaneceu no commit; alterações locais não foram incluídas. Nenhum push foi feito.

Não há migrações novas entre os commits e o plano de migração estava vazio; nenhuma migração foi aplicada. A flag de remoção permanece desligada. Por ordem de Danilo, nenhum dump ou tag de backup novo foi criado. As imagens anteriores orbita-panel:canvas-27ef2cc e orbita-api:canvas-27ef2cc foram preservadas.

## Reversão

```bash
bash /opt/orbita-deploy-32c69c7/rollback-images-v3.sh
```

O script usa compose.rollback-v3.yaml com o Compose e o ambiente originais para recriar somente API, worker, scheduler e painel com as imagens canvas-27ef2cc. Não restaura dados. Validação em seco: bash -n, compose config -q e existência das imagens anteriores, sem executar a reversão. O rollback-images-v2.sh NÃO serve para voltar a 27ef2cc: retorna a before-canvas2 (396f078).

## Resultado

Frontend: hooks, TypeScript, 640 testes e build passaram. Backend em PostgreSQL descartável com --nomigrations: 1.017 passaram e cinco falharam nos testes de remoção com a flag desligada, falhas conhecidas. A primeira execução isolada também apresentou falhas de configuração por falta de chaves fictícias e arquivos de referência; a repetição corrigida eliminou essas falhas adicionais.

API healthy; painel, worker e scheduler em execução (sem healthcheck configurado); nenhum reinício nos quatro. API e painel responderam HTTP 200; login customizado visível sem erros JavaScript; sete GETs com sessão administrativa existente retornaram 200. Bundle ReportCanvas servido SHA-256 9826ae971a9d00e4a41fd68658f8abfc29ba268790e90e5438d4b13fa403f293. Logs sem erros novos detectados durante pelo menos dois minutos de execução de cada serviço.

Monitor HTTP: painel cerca de 7 segundos sem 200; API cerca de 11 segundos em duas janelas. Estimativas de sondagens, sujeitas a intervalos e timeouts. Log: /opt/orbita/backups/deploy4.log; logs dos testes e builds têm prefixo deploy4 no mesmo diretório.
