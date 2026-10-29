# Autoagendamento Sansaúde — React e Django

Implementação em 28/10/2026. O módulo é habilitado apenas para `core_unit.slug=sansaude` (id 3). Não usa runtime PHP, Firebird ou MariaDB. O legado .124 permanece intacto.

## Serviços e rotas

- Painel administrativo: `/autoagendamento?unit=sansaude`, integrado ao menu com permissão `autoagenda` (nenhum/leitura/edição).
- Chat público: serviço `autoagenda-web`, porta `8081` no localhost por padrão (`AUTOAGENDA_BIND` pode ser configurado para um proxy remoto), React/Vite com os recursos visuais originais. Não tem login administrativo nem redirecionamento para 8080.
- API pública: serviço `autoagenda-api`, dois processos Gunicorn próprios, acessível externamente apenas pelo nginx do chat em `/api/v1/autoagenda/public/`. Configurações, relatórios e `/admin/` retornam 404 no serviço público.
- Configuração, console, links e registros humanos usam `/api/v1/autoagenda/` na API do painel, com autenticação, permissões de seção e unidade verificadas no servidor.
- Na configuração, URL pública é a origem externa completa (ex.: `https://agendamento.seudominio`), sem caminho. Não aceita porta 8080.

## Oracle e origem

Credenciais importadas em memória da configuração autorizada do chat .124, sem salvar arquivo de senha. Banco validado a partir do SCV: `172.16.2.254:1521`, SID/DB_NAME/INSTANCE_NAME `tstvotu`, usuário `MEGA_ROBO`. Ambiente homologação. Seis views com SELECT confirmado.

`queries.py` preserva SELECTs recuperados de RepositorioOracle: beneficiário/CPF/matrícula (001), retorno (002 + 006), disponibilidade (003), especialidades/profissionais/idade (004), confirmação (005), agendamentos futuros/duplicados (006). Não há dependência PHP. Datas de consulta/retorno preservam o corte original. Até três horários por escala e tipo de marcação, agrupados na apresentação por horário.

A gravação usa somente a procedure fixa `DBAMV.RF_PRC_AUTO_AGENDA_AGENDAR`, com parâmetros vinculados. Convênio 37 e usuário AGENDASAN são editáveis. Estado inicial: chat ativo, Oracle validado, **gravação de reservas desativada**. Não executamos a procedure na validação, nem enviamos mensagens WhatsApp reais.

## Separação das sessões

Link assinado expira em duas horas; é vinculado a uma sessão e usado uma vez. Ao entrar, troca por token aleatório cuja impressão SHA256 fica no banco. Token de sessão no sessionStorage é independente por aba/origem. As ações usam UUID idempotente e versão; conflitos retornam 409 e não sobrescrevem a conversa. Identificadores de matrícula/horário ficam criptografados no servidor; o navegador envia somente o índice da opção exibida.

Cada sessão possui estado, histórico, última atividade, CPF mascarado, celular e fila próprios. O padrão de inatividade é 30 minutos, editável entre 5 e 120. A aplicação mantém limite de 20 ações por minuto por sessão e limite adicional de requisições públicas. Nenhum estado de paciente é global ou compartilhado entre sessões. O cache de especialidades guarda apenas descrição/código e faixas etárias por configuração, por 30 minutos.

## Reserva e falhas

A confirmação registra a intenção no PostgreSQL antes de chamar o Oracle. Há unicidade de unidade/horário/data para tentativas pendentes, confirmadas ou incertas, além de uma tentativa por sessão. Dois pacientes não conseguem disparar duas reservas do mesmo horário pelo SCV. A procedure continua responsável pela concorrência com outros sistemas hospitalares, cuja equivalência precisa ser homologada no banco de teste.

Antes da escrita, o adapter consulta novamente a elegibilidade e o horário. Depois da procedure, confere a view 005 antes do commit. Não equipara erro técnico a horário ocupado. Falhas de conexão/commit ou resultado não comprovado viram pendência, sem repetição automática. “Conferir reserva no Oracle” faz somente SELECT e pode reconciliar sucesso; ausência na view não dispara nova procedure. Tentativa interrompida por mais de dois minutos vira pendência ao retomar a sessão.

Erros recuperáveis da navegação permitem nova tentativa; duas falhas encaminham à fila humana interna. CPF inválido é solicitado novamente; CPF não localizado ou inelegível gera encaminhamento. Agendamento já existente oferece outra especialidade, humano ou encerrar, como a versão PHP atual. Cancelamento é uma solicitação humana, sem alteração automática no hospitalar.

## Operação e indicadores

Abas: Em andamento, Fila humana, Agendados, Todas as sessões e Indicadores. Acompanhamento atualiza a cada cinco segundos enquanto aberto; a lista a cada dez, com opção de pausar e sem desmontar a tela. Mostra mensagens enviadas e escolhas feitas, não digitação privada nem captura de tela. Observações da equipe ficam no histórico e não aparecem para o paciente.

Indicadores: sessões, sessões ativas, fila humana, reservas confirmadas, pendências de confirmação, reservas por dia e por especialidade. Os filtros de período usam a criação da sessão. Não afirmar que representam todos os agendamentos do Oracle: são as reservas realizadas por este módulo. Não importa histórico legado automaticamente.

O WhatsApp de retorno veio do legado e é editável. A integração com SAW/MySQL foi substituída por fila humana interna. O botão abre `wa.me` sem envio automático. Comprovantes automáticos por Meta/Baileys ainda não são disparados por este módulo; a confirmação é exibida no chat e preservada no histórico. Essa diferença operacional precisa ser validada antes de substituir o legado.

## Credenciais e limites

Dados internos da sessão e senha Oracle criptografados no PostgreSQL com chave de serviço. Na troca de senha pelo administrador, a senha administrativa validada deriva a chave do envelope criptográfico; a chave de serviço mantém acesso operacional, no mesmo padrão do cofre existente. Senhas nunca retornam pela API. Corpo de requisições e dados pessoais não são registrados em logs de execução do módulo. O histórico de conversas é visível somente aos usuários autorizados na unidade.

O CPF continua sendo o identificador do fluxo legado, sem OTP; isso não comprova identidade por si só. Homologação não autoriza publicação irrestrita com dados reais sem definir essa política. Produção precisa de HTTPS no proxy e permissões Oracle revisadas. Um token de acesso não substitui validação da identidade do beneficiário.

## Proxy reverso

Exemplo de upstream, no proxy externo do hospital:

```nginx
location / {
    proxy_pass http://172.16.0.59:8081;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
}
```

TLS é terminado no proxy. O endereço público configurado no SCV deve corresponder ao domínio TLS. O módulo não muda DNS, certificados ou serviços de proxy existentes.

## Backup, implantação e reversão

Backup prévio: `/root/backup-autoagenda-20261028.sql` (0600). Inicialização via comando `configure_autoagenda`, primeiro dry-run, depois apply com backup concluído, sem senha em argumentos/arquivos. Configuração inicial idempotente, id 1. Migrações 0001/0002 aditivas, sem apagar dados dos módulos existentes.

Para iniciar somente os novos serviços: `docker compose --profile autoagenda up -d --build autoagenda-api autoagenda-web`. A API pública não executa bootstrap nem migrações automaticamente; aplicar migrações controladas antes de subir. O painel requer build com as novas rotas e a API administrativa com o app autoagenda instalado.

Para pausar, desative o chat no modal. Para reverter a interface, restaurar a imagem anterior do painel; manter tabelas e histórico. `docker compose stop autoagenda-api autoagenda-web` para parar somente o módulo público. Não remover volumes nem executar rollback das migrações com pacientes/filas existentes.

Evidências privadas e logs de validação: `/opt/backups/orbita/autoagenda-20261028/`. Login customizado e demais serviços preservados. Nenhum commit/push automático nesta tarefa.

## Validação desta entrega

- 644 testes frontend aprovados e build TypeScript validado; ícones centrais, acessibilidade e navegação incluídos.
- 44 testes backend aprovados, incluindo os 14 cenários novos de fluxo/isolamento/reserva e testes existentes de usuários/federação.
- Concorrência real em PostgreSQL: duas transações na mesma sessão não perdem alterações; duas sessões para o mesmo horário geram apenas uma chamada da procedure (adapter simulado).
- API do Oracle real: identidade tstvotu e SELECT das seis views confirmados. Nenhuma reserva/procedure ou mensagem real executada.
- Chat 8081 retorna HTTP 200, endpoints administrativos no serviço público retornam 404; acesso sem link/token à API é negado.
- Conferência visual no navegador: logotipo original, cartões de conversa, CPF com máscara, cabeçalho sem Assistente virtual; modal administrativo com ações fixas fora da rolagem, temas claro/escuro do painel.
- Staging administrativo desta tarefa: `orbita-canvas-stage-autoagenda`, porta local 18091 (8091/8094 já estavam em uso). A publicação do painel 8080 depende da confirmação solicitada em respeito à restrição anterior de reconstrução.
- Usuários não administrativos começam sem permissão de Autoagendamento; o administrador pode conceder leitura/edição explicitamente. O backend bloqueia outras unidades mesmo com a permissão selecionada.
