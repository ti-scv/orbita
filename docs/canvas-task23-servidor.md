# Tarefa 23 — diagnóstico do servidor SCV-APP03

## Conclusão

**Sim, o armazenamento do servidor é um gargalo na janela observada.** A VM espera por disco mesmo com CPU e RAM disponíveis. Isso afeta potencialmente Postgres, Redis, Docker e aplicações. Não demonstra que toda lentidão do Canvas venha da infraestrutura nem identifica o componente físico responsável. Datastore, cache, limites de IOPS e concorrência do host precisam ser examinados pelo administrador.

Cinco conclusões:

1. A plataforma é **VMware**, não Hyper-V, com drivers paravirtualizados adequados.
2. Sem benchmark nem leitura de logs, sda ficou 76,3% ocupado, await 14,17 ms, com somente 434,4 KiB/s somados: sinal de limite no caminho de I/O.
3. CPU não saturou, havia 5.558 MiB de memória disponível e não houve paginação ativa nas amostras. Balão atual zero.
4. Escrita variou de 5,75 a 328 MiB/s; fsync pequeno ficou submilissegundo. A lentidão não é uniforme em todas as gravações.
5. Todos os destinos de banco aceitaram três conexões TCP. Priorizar armazenamento e espaço livre; aumentar CPU/RAM sem medir o host tem pouco suporte nestes dados.

## Escopo e método

SCV-APP03, 172.16.0.59. Coleta em **28/10/2026, aproximadamente 05:37–05:43 UTC (02:37–02:43 em São Paulo)**. Documento finalizado depois. Somente observação e testes pequenos, sem encerrar sessões ou serviços de terceiros, sem instalar pacotes, alterar kernel, Docker, Postgres ou configurações. Única alteração persistente da tarefa: este documento. Não foram impressas senhas, chaves, ciphertexts ou strings de conexão.

Não estavam disponíveis no PATH: iostat, pidstat, mpstat, fio, sar, ping, mtr e dmidecode. Sem sysstat instalado/utilitário ou diretórios de dados /var/log/sysstat e /var/log/sa. Usados vmstat, /proc/diskstats, /proc/PID/{io,stat}, docker stats e Python padrão. Nenhuma instalação efetuada.

## Plataforma e parâmetros

| Item | Resultado |
|---|---|
| Virtualização | systemd-detect-virt=vmware; lscpu=VMware; DMI=VMware, Inc. / VMware Virtual Platform |
| Kernel | 6.8.0-142-generic |
| CPU | 6 vCPUs, Xeon Silver 4208 @ 2,10 GHz, um socket e seis cores apresentados |
| RAM inicial | 9.944 MiB total, 4.386 usados, 5.558 disponíveis |
| Swap | /swap.img, 2.971 MiB total, 451,6 MiB usados |
| Disco | sda virtual 50 GiB; /boot sda2 2 GiB; sda3 LVM aproximadamente 48 GiB |
| LVM | ubuntu-vg/ubuntu-lv aproximadamente 48 GiB; nenhum extent livre no VG |
| Filesystem | ext4, rw,relatime; /tmp e / no mesmo volume |
| Espaço raiz | 48 GiB, 38 GiB usados, 7,9 GiB disponíveis; 83% ocupado |
| Drivers | vmw_pvscsi, vmxnet3, vmw_balloon, vmw_vmci; nenhum hv_vmbus/hv_storvsc/hv_netvsc observado |
| Scheduler sda | mq-deadline ativo; alternativa none |
| Fila e setores | nr_requests=256; read_ahead_kb=128; logical/physical_block_size=512/512 bytes |
| Rotação | ROTA=1; atributo virtual, não comprova HDD físico |
| swappiness | 60 |
| Dirty | ratio=20; background_ratio=10; dirty_bytes=0; background_bytes=0 |
| Writeback | dirty_expire_centisecs=3000; dirty_writeback_centisecs=500 |
| Balão | /sys/kernel/debug/vmmemctl: target=0, current=0, alloc(4k)=0, alloc(2M)=0 |
| Dados Órbita | Postgres e Redis usam volumes Docker; compartilham o armazenamento da VM, sem segundo disco de dados em lsblk |

SMART do disco físico não é acessível pelo disco virtual. Balão carregado não significa RAM retirada: a medição atual foi zero.

## Disco e escrita

A primeira série de dez diferenças de diskstats, aproximadamente um segundo entre leituras, coincidiu com leitura do journal do boot. O próprio journalctl PID 3980492 leu 13,69 MiB em cerca de dez segundos. **Essa série inclui carga da investigação e não representa somente aplicações.** A leitura terminou; foi feita nova janela sem journalctl ou benchmark.

| Janela | Leitura KiB/s | Escrita KiB/s | await ms | Fila média | util sda |
|---|---:|---:|---:|---:|---:|
| Primeira, dez intervalos, com leitura de journal | 1.013–2.167 | 12–228 | 47,22–114,68 | 2,87–6,41 | 81,49–96,94% |
| Repetição, dez segundos, sem journalctl/benchmark | 107,6 | 326,8 | **14,17** | **1,0229** | **76,3%** |

Na primeira, read await=39,53–78,93 ms e write await=48,67–599,75 ms. A segunda teve 722 operações concluídas (72,2/s). A fila, espera e baixa vazão sustentam o diagnóstico, mas %util de disco virtual isoladamente não mede saturação física. Outra sessão executava du, depois observado lendo 148,73 KiB/s; a repetição é carga compartilhada real, não máquina ociosa.

Fórmulas de diferenças de /proc/diskstats de sda: await=(ms leitura+ms escrita)/(leituras+escritas concluídas); fila=weighted_io_ms/tempo_ms; util=io_ms/tempo_ms. Não somar dm-0 e sda, pois duplicaria I/O. A VM não separa espera do guest, controlador virtual e datastore.

### Benchmark curto, três repetições

Arquivo exclusivo mkstemp em /tmp, **16 MiB**, reutilizado em três rodadas sequenciais, um segundo entre rodadas. Cada dd com timeout de 15 s; todos retornaram zero. Sem drop_caches, sync global ou escrita em dispositivo bruto. Arquivo removido em finally e ausência conferida.

```sh
dd if=/dev/zero of=ARQUIVO bs=1M count=16 oflag=direct status=none
dd if=ARQUIVO of=/dev/null bs=1M count=16 iflag=direct status=none
dd if=/dev/zero of=ARQUIVO bs=1M count=16 conv=fdatasync status=none
```

| Rodada | Escrita direta MiB/s (s) | Leitura direta MiB/s (s) | Escrita + fdatasync MiB/s (s) | 8 KiB + fdatasync mín./mediana/máx. ms |
|---|---:|---:|---:|---:|
| 1 | 18,58 (0,8609) | 469,76 (0,0341) | 17,76 (0,9011) | 0,23 / 0,32 / 0,57 |
| 2 | 328,00 (0,0488) | 556,32 (0,0288) | 9,33 (1,7141) | 0,32 / 0,39 / 0,67 |
| 3 | 5,75 (2,7835) | 621,35 (0,0258) | 118,68 (0,1348) | 0,23 / 0,25 / 0,35 |

Além do dd, dez pares pwrite de 8 KiB + fdatasync por rodada, medidos individualmente. O dd conv=fdatasync mede escrita de 16 MiB e uma confirmação final, não latência de uma transação. O teste pequeno aproxima confirmação durável, mas não reproduz WAL, concorrência e checkpoints do Postgres.

Direct evita cache de páginas Linux, mas não cache do hipervisor/controladora. Leitura logo após escrita, arquivo pequeno e zeros podem ser favorecidos por cache, compressão ou deduplicação. Não interpretar 621 MiB/s como leitura sustentada nem fsync rápido como prova independente da durabilidade física do host.

Tipo físico desconhecido: HDD naturalmente tem latência aleatória de milissegundos; SSD saudável tende a latência menor. Centenas de ms sob baixa vazão merecem investigação nos dois casos. Não há base para atribuir throughput esperado exato ao ROTA virtual, nem afirmar defeito físico. A grande variabilidade de escrita e a espera durante carga normal são os achados relevantes; fsync pequeno não foi lento nessa amostra.

## CPU e memória

| Medida | Resultado |
|---|---|
| Uptime/load inicial | 19 dias e 16h57; load 1/5/15 min=2,10 / 2,78 / 3,68 para seis vCPUs |
| vmstat inicial, excluída linha média do boot | r=0–2; b=1–3; us=4–38%; sy=2–12%; id=38–63%; wa=14–45%; st=0% |
| vmstat repetido sem benchmark/journalctl | r=0–2; b=1–4; us=3–36%; sy=2–6%; id=48–78%; wa=11–30%; st=0% |
| Swap nas duas séries | si=0, so=0 KiB/s; swap ocupada não implica paginação ativa |
| PSI CPU inicial avg10/60/300 | some=0,83 / 0,69 / 1,62%; full=0 |
| PSI I/O inicial avg10/60/300 | some=36,73 / 34,66 / 24,55%; full=33,35 / 31,18 / 21,70% |
| PSI memória inicial avg10/60/300 | some=0 / 0 / 0,06%; full=0 |
| PSI CPU repetição | some=2,22 / 2,31 / 1,89%; full=0 |
| PSI I/O repetição | some=34,06 / 46,90 / 36,46%; full=26,91 / 38,25 / 31,00% |
| PSI memória repetição | some=0,03 / 0,20 / 0,17%; full=0 / 0,12 / 0,09% |

PSI de 60/300 s na repetição ainda inclui atividade anterior de diagnóstico. Iowait e processos bloqueados persistiram sem benchmark. Sem saturação local de CPU, balão ativo ou OOM observado. No VMware, st=0 não exclui CPU Ready/co-stop no host; essas métricas dependem do administrador.

## Maiores consumidores — somente observação

Ranking por diferenças de /proc em cerca de dez segundos após os testes de disco. CPU percentual de um core (600% seriam seis cores). RSS inclui páginas compartilhadas e não deve ser somado como uso total. Nomes/cgroups usados para identificar serviço, sem imprimir argumentos ou ambiente com segredos. PIDs são os da coleta; processos que acabaram antes da segunda leitura não entram.

### Top 15 CPU

| PID | Processo / função | CPU % |
|---|---|---:|
| 3981349 | python / API stage legado Canvas | 33,84 |
| 4094183 | MainThread / vigilant_allen, npm test | 4,43 |
| 3981596 | postgres / banco Órbita | 4,33 |
| 4094175 | MainThread / vigilant_allen, npm test | 3,74 |
| 2989710 | celery / worker Órbita | 2,36 |
| 4089992 | dockerd / Docker | 2,07 |
| 2837009 | python / worker Tuya IoT | 1,57 |
| 2834896 | containerd / runtime | 1,28 |
| 2989481 | celery / scheduler Órbita | 1,28 |
| 3814468 | ruby / Chatwoot Rails | 1,28 |
| 4091422 | redis-server / Órbita | 1,08 |
| 4091490 | redis-server / Chatwoot | 0,98 |
| 33724 | tailscaled / rede Tailscale | 0,89 |
| 3983442 | du / inventário de outra sessão bash | 0,89 |
| 3987495 | python3 / medição desta tarefa | 0,89 |

### Top 15 memória

| PID | Processo / serviço | RSS MiB |
|---|---|---:|
| 3798548 | ruby / Chatwoot Rails | 387,51 |
| 3814468 | ruby / Chatwoot Rails | 386,63 |
| 3798565 | bundle / Chatwoot Sidekiq | 383,97 |
| 4089992 | dockerd | 358,95 |
| 3814349 | bundle / Chatwoot Sidekiq | 332,38 |
| 4094183 | MainThread / vigilant_allen, npm test | 196,50 |
| 4094175 | MainThread / vigilant_allen, npm test | 193,91 |
| 3981349 | python / API stage legado Canvas | 156,00 |
| 2989072 | gunicorn / API Órbita | 155,68 |
| 2989073 | gunicorn / API Órbita | 154,11 |
| 2989710 | celery / worker Órbita | 133,93 |
| 2989711 | celery / worker Órbita | 133,13 |
| 1514760 | MainThread / DNV preenchimento | 122,36 |
| 2837001 | uvicorn / API Tuya IoT | 116,57 |
| 2989488 | celery / worker Órbita | 101,58 |

### Top 15 I/O

| PID | Processo / serviço | Leitura KiB/s | Escrita KiB/s |
|---|---|---:|---:|
| 3983442 | du / outra sessão | 148,73 | 0 |
| 3981596 | postgres / Órbita | 0 | 26,76 |
| 2747194 | systemd-journal / logs | 0 | 21,64 |
| 2610917 | MainThread / Baileys Órbita, WhatsApp | 3,15 | 5,90 |
| 4091422 | Redis Órbita | 3,15 | 5,51 |
| 2837085 | Postgres Tuya IoT | 0 | 6,30 |
| 2837086 | Postgres Tuya IoT | 0 | 3,15 |
| 312 | jbd2/dm-0-8 / journal ext4 | 0 | 2,75 |
| 4091490 | Redis Chatwoot | 1,18 | 1,18 |
| 3981322 | cliente docker de outra sessão | 0 | 1,57 |
| 4089992 | dockerd | 0 | 1,57 |
| 33724 | tailscaled | 0 | 0,79 |
| 3797068 | containerd-shim / supervisor | 0 | 0,79 |
| 4091257 | containerd-shim / supervisor | 0 | 0,79 |
| 4091395 | containerd-shim / supervisor | 0 | 0,79 |

I/O atribuído por processo pode diferir do instante de conclusão no dispositivo; não permite atribuir toda a fila do datastore a um projeto.

### docker stats --no-stream

Foto anterior aos rankings. CPU/memória de cgroup diferem de CPU/RSS por processo. Block I/O abaixo é acumulado, **não taxa atual**. Unidades conforme saída Docker.

| Container / função | CPU % | Memória MiB | Block I/O leitura / escrita |
|---|---:|---:|---:|
| orbita-canvas-stage / painel stage | 0 | 6,109 | 0 / 16,4 kB |
| orbita-canvas-stage-legado / painel legado | 0 | 6,156 | 0 / 32,8 kB |
| chatwoot-sidekiq-1 / tarefas Chatwoot | 0,17 | 539,1 | 73 / 206 MB |
| chatwoot-rails-1 / atendimento | 0,22 | 656 | 303 / 218 MB |
| orbita-canvas-stage-api-legado / API stage | 0,01 | 88,12 | 8,11 MB / 590 kB |
| orbita-panel-1 / painel | 0 | 6,605 | 492 / 16,4 kB |
| orbita-scheduler-1 / agenda | 2,41 | 82,66 | 606 kB / 2,97 MB |
| orbita-worker-1 / tarefas | 4,96 | 202,7 | 1,52 / 9,71 MB |
| orbita-api-1 / API | 19,56 | 279,6 | 2,51 / 7,8 MB |
| tuya-iot-api-1 / API IoT | 0,19 | 91,86 | 10,1 MB / 0 |
| tuya-iot-worker-1 / tarefas IoT | 2,21 | 71,36 | 8,51 MB / 0 |
| orbita-db-1 / Postgres | 5,69 | 137,2 | 290 MB / 2,96 GB |
| orbita-vnc-preview-123 / prévias | 0,01 | 11,13 | 53,3 / 623 MB |
| orbita-baileys-1 / WhatsApp | 0,09 | 66,31 | 103 / 669 MB |
| vigilant_allen / npm test | 6,39 | 335,9 | 102 / 243 MB |
| dnv-preenchimento-dnv-preenchimento-1 / preenchimento | 6,58 | 87 | 236 / 179 MB |
| dnv-preenchimento-dnv-impressao-1 / impressão | 20,34 | 62,65 | 295 / 397 MB |
| tuya-iot-web-1 / painel IoT | 0 | 16,12 | 62,1 / 5,12 MB |
| tuya-iot-db-1 / Postgres IoT | 1,48 | 50,27 | 105 MB / 13,4 GB |
| orbita-redis-1 / fila/cache | 1,08 | 2,918 | 3,86 / 6,5 GB |
| portainer / administração | 0 | 35,8 | 90,9 / 528 MB |
| whats-monit-whatsapp-1 / monitor WhatsApp | 0 | 57,58 | 96,8 / 113 MB |
| chatwoot-triage-triage-1 / triagem | 0,17 | 44,88 | 76,3 / 92 MB |
| chatwoot-redis-1 / Redis Chatwoot | 0,82 | 3,883 | 976 MB / 2,18 GB |
| chatwoot-postgres-1 / banco Chatwoot | 0 | 44,07 | 114 / 122 MB |

Em outra foto apareceram infallible_mestorf (imagem node:24-bookworm-slim) e peaceful_almeida (orbita-api), transitórios. Havia dois processos node; nenhum comm pytest nesse instante, o que não exclui pytest sob comm python. Nenhum teste, node, du, npm ou projeto de terceiros foi encerrado.

## Rede e DNS

Destinos obtidos somente de host/port de ReportConnection e hostname/porta de URLs RemoteInstance, via ORM da API. Inventário inclui cadastros, não somente fontes ativas. Hosts vazios omitidos; podem ser fontes locais/legado. Nenhum hostname adicional de RemoteInstance retornado. Sem impressão de database, usuário, senha ou options.

Três conexões TCP por destino, timeout de dois segundos, abertas e fechadas sem login/consulta SQL, **dentro do container da API** para incluir DNS Docker. getaddrinfo medido separadamente. Não mede autenticação nem duração de consulta/relatório.

| Destino | Porta | DNS/getaddrinfo ms | TCP ms | Sucesso |
|---|---:|---|---|---|
| 167.249.56.126 | 54330 | 0,05 / 0,07 / 0,05 | 4,32 / 2,07 / 2,16 | 3/3 |
| 172.16.0.254 | 1521 | 0,04 / 0,04 / 0,02 | 0,52 / 0,34 / 0,25 | 3/3 |
| 172.16.2.254 | 1521 | 0,02 / 0,05 / 0,04 | 1,26 / 0,59 / 0,45 | 3/3 |
| 172.16.3.254 | 1521 | 0,04 / 0,03 / 0,02 | 0,73 / 0,46 / 0,58 | 3/3 |
| 172.17.0.254 | 1521 | 0,02 / 0,06 / 0,07 | 11,03 / 12,00 / 11,55 | 3/3 |
| 172.18.0.254 | 1521 | 0,05 / 0,05 / 0,05 | 4,84 / 4,83 / 5,58 | 3/3 |
| 172.19.0.250 | 1521 | 0,05 / 0,06 / 0,08 | 19,90 / 2,06 / 1,90 | 3/3 |
| db / Postgres Docker local | 5432 | 0,70 / 0,71 / 0,33 | 0,40 / 0,47 / 0,35 | 3/3 |

IP literal não consulta DNS externo: valores baixos não validam resolução de domínio externo. db mede o resolvedor interno Docker.

Sem ping/mtr instalados, três ICMP echo pequenos por IP externo via socket raw Python no host, timeout um segundo, até três destinos simultâneos. Tentativa inicial com socket datagram negada por permissão; coleta válida com raw, sem mudar permissões/sysctl.

| IP | RTT ICMP ms | Sem resposta |
|---|---|---:|
| 167.249.56.126 | nenhuma | 3/3 (100%) |
| 172.16.0.254 | 2,19 / 0,27 / 0,32 | 0/3 |
| 172.16.2.254 | 0,64 / 0,49 / 0,33 | 0/3 |
| 172.16.3.254 | 0,60 / 2,75 / 0,70 | 0/3 |
| 172.17.0.254 | 11,81 / 12,15 / 11,42 | 0/3 |
| 172.18.0.254 | 5,01 / 4,47 / 4,34 | 0/3 |
| 172.19.0.250 | 11,71 / 2,22 / 2,79 | 0/3 |

O IP público respondeu TCP 3/3: falta de ICMP pode ser filtro e não prova perda de tráfego do banco. Amostra pequena não exclui perdas intermitentes; sem mtr, não há análise por salto. Não apareceu gargalo de conexão/DNS nessa janela; consultas externas lentas continuam possíveis.

## Logs e histórico

dmesg -T e journal do kernel do boot filtrados por erro, reset, timeout, OOM, VMware/SCSI; journalctl -p warning -b resumido. Leitura completa do journal gerou I/O já discriminado acima; leituras posteriores limitadas por quantidade/tempo.

- Boot identifica VMware, PVSCSI e vmxnet3 normalmente. Nos registros retornados não apareceram erros de I/O, resets de disco/storvsc, timeout de armazenamento ou OOM. Isso não atesta saúde física do datastore.
- Avisos vmballoon_work excedendo 10.000 microssegundos em 13/10 09:19:29, 19/10 02:35:08 e 25/10 09:18:16 UTC. Históricos; balão atual zero.
- 27/10 16:47:59 UTC: segfault Python na libfbclient.so.3.0.11 (cliente Firebird). Falha de processo/aplicação, sem prova de relação com disco.
- 27/10 19:24:20 UTC: containerd encontrou vários containerd-shim remanescentes na inicialização; indica encerramento/reinício anterior incompleto. Nada foi reiniciado ou limpo nesta tarefa.
- 28/10 03:51:38 UTC: sshd registrou conexão reiniciada pelo cliente; sem relação demonstrada com armazenamento.
- dmesg recente mostra criação/remoção de veth/bridges Docker, compatível com containers transitórios; não confundir com defeito da NIC física.

**Sem sar/sysstat e sem arquivos diários, não é possível reconstruir picos numéricos das últimas 24 horas.** A primeira linha de vmstat (média desde o boot, aproximadamente 85% idle e 8% iowait) não foi usada como série histórica horária.

| Horário UTC | Evidência | Interpretação limitada |
|---|---|---|
| 27/10 16:47:59 | segfault cliente Firebird | Anterior à coleta |
| 27/10 19:24:20 | avisos de inicialização containerd | Evento de infraestrutura compartilhada |
| 27/10 20:45:57 | início atual orbita-api-1 | Start de container não prova horário de deploy |
| 27/10 20:46:21 | início worker/scheduler Órbita | Mesma ressalva |
| 28/10 04:13:28 | início API stage legado | Stage ativo na coleta |
| 28/10 04:21–05:33 | commits frequentes de Canvas, fontes, prévias, parâmetros e QA | Commit não comprova início/fim de teste ou implantação |
| 28/10 05:37–05:43 | medição desta tarefa; npm test, node e containers transitórios | Concorrência observada, sem histórico para atribuir causalidade a deploy |

## Recomendações — nenhuma aplicada

| Prioridade / ação | Responsável | Motivo e validação | Risco |
|---|---|---|---|
| 1. Inspecionar latência de datastore, guest/kernel/device, filas, IOPS, limites da VM, snapshots e backups | Administrador VMware/armazenamento | Correlacionar 05:37–05:43 UTC e horário do problema; explicar baixa vazão com espera | Baixo para consulta; alterações/snapshots exigem planejamento |
| 1. Confirmar cache protegido e respeito a flush/FUA | Administrador do armazenamento | fsync rápido pode refletir cache; verificar garantia de persistência | Baixo para consulta; mudar cache sem proteção pode perder dados |
| 2. Avaliar SSD/datastore menos disputado e volume de dados dedicado para Postgres/Redis | VMware + dono Órbita | Separar concorrência; outro VMDK no mesmo datastore lento pode não resolver | Médio/alto: migração consistente, backup e possível parada |
| 2. Expandir VMDK e depois partição/PV/LV/ext4, com backup | VMware + Linux | 83% da raiz e VG sem extents; dimensionar pela taxa de crescimento | Médio: erro de expansão pode causar indisponibilidade; capacidade sozinha não reduz latência |
| 2. Revisar retenção de logs, artefatos e imagens/build cache com os donos | Linux + donos dos projetos | Recuperar margem; inventário fora do pico, pois du também lê disco | Baixo para inventário; médio/alto para exclusão; não usar prune amplo nem excluir volumes de terceiros |
| 3. Medir CPU Ready/co-stop, reservas, limites e sobrealocação | Administrador VMware | st=0 não descarta espera no host; CPU convidada tinha folga | Baixo para consulta; mais vCPUs podem piorar escalonamento |
| 3. Medir balloon, swap/compressão do host e reservas de RAM | Administrador VMware | Balão convidado zero e RAM disponível; não aumentar RAM automaticamente | Baixo para consulta; reservas podem pressionar outras VMs |
| 3. Planejar histórico de 24 h com monitoramento existente ou sysstat aprovado | Linux/infra | Falta série para relacionar picos a backup, testes e deploy | Baixo, mas instalação/retenção consomem recursos; tarefa futura |
| 4. Manter mq-deadline como referência; comparar none apenas em janela controlada | Linux + VMware | PVSCSI já adequado; scheduler não foi demonstrado como causa | Médio: pode piorar latência concorrente; prever retorno |
| 4. Avaliar limites dirty_* em bytes com histórico de writeback | Linux + banco | Percentuais 10/20 podem permitir rajadas; não corrigem fsync/datastore lento | Médio: configuração ruim aumenta espera ou reduz vazão; não fixar valor sem workload |
| 4. Reavaliar swappiness somente se paginação ativa aparecer | Linux | 60 atual, mas si/so zero | Médio: reduzir sem necessidade pode prejudicar memória; não executar swapoff com serviços ativos |
| 4. Coordenar horários/limites de testes e builds com os donos | Responsáveis pelas sessões | Reduzir sobreposição de I/O sem encerrar tarefas alheias | Baixo para coordenação; limites inadequados atrasam tarefas |
| 4. Investigar segfault Firebird e eventos containerd | Aplicação + Linux | Falhas reais distintas do diagnóstico de disco | Baixo para investigação; correção/restart pode exigir janela |

A equipe chamada de “Hyper-V” deve encaminhar os pontos de infraestrutura ao responsável efetivo pelo **VMware**. Somente esse administrador pode confirmar datastore físico, snapshots, cache protegido, CPU Ready, reservas e expansão do disco virtual. Não foi identificado Hyper-V nesta VM.

## Validação da entrega

Testes de disco de 16 MiB repetidos três vezes; arquivo temporário removido e ausência conferida. Duas séries de vmstat/diskstats, quinze processos por CPU/RSS/I/O, docker stats, metadados sem segredos, TCP/ICMP leves e logs consultados. Nenhum processo de outro projeto ou sessão foi encerrado. Configurações permaneceram intactas. Entrega em commit local somente deste arquivo, branch feature/canvas-redesign, preservando alterações de outras tarefas.
