# Timbrados — integração em main

Recuperado de `feature/timbrados` (`88bffee86e02dec4461f0cdb2815ab7a14e2fded`) pelo bundle anterior à consolidação de branches.

## Uso

Relatórios → Timbrados: cadastrar nome, fundo retrato/paisagem, margens e campos. O timbrado pode ser associado à conexão ou selecionado na geração do PDF. A execução preserva uma fotografia da configuração utilizada. A seleção “Sem timbrado” mantém o PDF sem aplicação de fundo.

PNG/JPEG são aceitos como imagens; SVG estático e PDF de uma página são validados e rasterizados. Conteúdo ativo/referências externas de SVG são rejeitados. O cadastro respeita a unidade e as permissões administrativas.

## Publicação

Aplicar `operations.0032_letterhead` antes de trocar os serviços. `compose.timbrados.yaml` deve ser o último override, preservando os demais arquivos de ambiente e recursos. O agendador continua usando `django_celery_beat.schedulers:DatabaseScheduler` e as filas `priority,celery` e `reports` permanecem separadas. Check-in, pesquisas e autoagendamento permanecem no código consolidado. Credenciais e configurações existentes não são substituídas.

Foi necessário reutilizar a imagem de dependências em produção e acrescentar PyMuPDF/defusedxml devido a falhas e lentidão no download do índice de pacotes. A lista de versões já utilizada não foi reduzida nem alterada.

## Validação

Migrações e detecção de alterações de modelos em PostgreSQL isolado; testes do cadastro, isolamento por unidade, associação/congelamento do timbrado, composição e paginação dos PDFs, Canvas, PDF externo e regressão de relatórios; build TypeScript/Vite e testes dos modais e permissões. Check-in validado com transporte simulado, respostas contextuais e conciliação de atendimento. Nenhum teste utiliza os canais de envio reais.
