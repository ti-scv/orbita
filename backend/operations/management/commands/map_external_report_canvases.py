import copy,json,re
from pathlib import Path
from django.core.management.base import BaseCommand,CommandError
from django.core import serializers
from django.db import transaction
from core.models import Audit
from operations.models import ReportDefinition,ReportAutomation
from operations.external_report_mapping import contract,draft,compose,VERSION

class Command(BaseCommand):
    help="Mapeia fontes externas e cria rascunhos Canvas a partir de evidências; não executa procedures nem ativa envios."
    def add_arguments(self,p):
        p.add_argument("--inventory",required=True)
        p.add_argument("--layouts",required=True)
        p.add_argument("--columns",required=True)
        p.add_argument("--output",required=True)
        p.add_argument("--apply",action="store_true")
    def handle(self,*args,**opts):
        inventory=json.loads(Path(opts['inventory']).read_text());archive=json.loads(Path(opts['layouts']).read_text());probes=json.loads(Path(opts['columns']).read_text())
        ids={r['id'] for r in inventory}
        extras=[16,17,30,57,60,69,70,72,74,164,174,256,259,268]
        ids.update(ReportDefinition.objects.filter(unit_id=2,code__in=['legacy123-'+str(i) for i in extras]).values_list('pk',flat=True))
        output=Path(opts['output']);output.mkdir(parents=True,exist_ok=True)
        reports=list(ReportDefinition.objects.filter(pk__in=ids).select_related('unit','connection').order_by('pk'))
        if not opts['apply']:
            self.stdout.write(json.dumps({'definitions':len(reports),'roots':sum(r['kind']=='report' for r in inventory),'mode':'dry_run'}));return
        (output/'before.serialized.json').write_text(serializers.serialize('json',reports))
        by_code={(r.unit_id,r.code):r for r in reports};updates=[]
        with transaction.atomic():
            list(ReportDefinition.objects.select_for_update().filter(pk__in=ids).values_list('pk',flat=True))
            for r in reports:
                legacy=copy.deepcopy(r.legacy)
                if legacy.get('external_mapping',{}).get('version')==VERSION:continue
                record=legacy.get('record',{});proc=str(record.get('PROCEDIMENTO') or '').upper();name=r.name.upper()
                is_file=r.source=='external_file';is_placeholder=r.code=='legacy-stock'
                family='hospitalar';target='Oracle prdvotu (conexão 1) + PostgreSQL para capacidade histórica';blocker='Reconciliar cálculo, filtros e resultado com a rotina legada antes de habilitar.'
                if 'FPO' in name or 'FPO' in proc:
                    family='FPO';target='Oracle prdvotu (conexão 1) + cotas e de/para legados';blocker='Migrar FPO_COTA_DRS_PROCEDIMENTOS e FPO_DEPARA_MUTIRAO; reconciliar projeções, cotas e decêndios.'
                if 'ACS' in name or 'AGENTE' in name or 'ESUS' in name or 'ESUS' in proc or str(legacy.get('source_base_id')) in {'13','14'}:
                    family='ACS/eSUS';target='PostgreSQL eSUS (conexão 4) → cache Firebird terminal → GLDADOS';blocker='Validar acesso ao PostgreSQL eSUS, consultas de produção e regras de proc_indicadores_esus. Origem Oracle não comprovada.'
                if 'VIDAS' in name or r.code=='legacy123-268':
                    family='Vidas Sansaúde';target='Oracle prdvotu + histórico PostgreSQL + metas SCV';blocker='Vincular conjuntos de vidas/metas ao provedor validado do Canvas 310; preservar fotografias e metas.'
                if r.source=='application_pending' or r.legacy.get('app_migration'):
                    family='Dados operacionais';target='SCV local/remoto';blocker='Mapeamento operacional ainda não concluído; não tratar como consulta clínica Oracle.'
                if r.code=='legacy123-71':
                    family='Agendas Oracle';target='Oracle prdvotu → dbasistemas.vdic_cons_agenda_envio_msg_san';blocker="Validar resultado e filtro ENVIAR = N da consulta original; esse critério não comprova confirmação/recusa WhatsApp."
                if is_file:
                    family='PDF publicado';target=str(record.get('PROCEDIMENTO') or 'Gerador externo');blocker='Recuperar gerador e arquivo-fonte; PDF pronto não permite reconstruir blocos editáveis sem a origem.'
                if is_placeholder:
                    family='Cadastro sem definição';target='A confirmar por unidade';blocker='Placeholder sem query/conexão; não presumir equivalência com o relatório legado 1.'
                number=str(record.get('ID_RELATORIO') or r.code.removeprefix('legacy123-'))
                spec=contract(number,archive)
                probe=probes.get(r.code,{})
                if probe.get('status')=='columns_verified':
                    spec['columns']=probe['columns'];spec['table_columns']=probe['columns'];spec['header_fields']={}
                    if r.code=='legacy123-71':
                        r.source='sql';r.connection_id=probe['connection_id'];r.query_sql=probe['sql'];r.parameter_schema=probe['schema']
                routine=any(w in name for w in ['SINCRONIZAR','ALTERAR MES','ATUALIZAR FPO','LIMPAR ']) or 'LIMPAR' in proc
                if routine:blocker='Rotina de coleta/manutenção; não executar como relatório. '+blocker
                if r.canvas_enabled and r.reviewed:
                    blocker='';state='integrated'
                else:state='routine' if routine else 'published_file' if is_file else 'mapped_draft'
                mapping={'version':VERSION,'family':family,'status':state,'target':target,'blocker':blocker,'columns':spec['columns'],'header_fields':spec['header_fields'],'legacy_procedure':proc,'legacy_source':legacy.get('source_path',''),'children':[c.get('code') for c in r.components],'column_validation':probe.get('status','legacy_layout_only'),'evidence':'docs/relatorios/FONTES_EXTERNAS_CANVAS.md','legacy_record_id':number}
                legacy['external_mapping']=mapping;r.legacy=legacy
                if not r.canvas_layout and not routine and not is_file and not is_placeholder and not r.components:
                    value=draft(r,spec)
                    if value:r.canvas_layout=value
                if not r.canvas_enabled:
                    if 'report_description' not in legacy:legacy['report_description']=f"Origem: {target}. Montagem: Canvas com campos e séries recuperados do layout legado. {blocker}"
                    if r.code=='legacy123-71':r.dependencies=[blocker]
                r.version+=1
                r.save(update_fields=['legacy','canvas_layout','version','source','connection','query_sql','parameter_schema','dependencies'])
                updates.append(r)
            # Preserve child order and every source. Never silently truncate a large composition.
            changed_ids={r.pk for r in updates}
            for r in reports:
                if r.pk not in changed_ids:continue
                mapping=r.legacy.get('external_mapping',{})
                if r.canvas_layout or not r.components or mapping.get('status') in {'routine','published_file'}:continue
                children=[by_code.get((r.unit_id,c.get('code'))) or ReportDefinition.objects.filter(unit_id=r.unit_id,code=c.get('code')).first() for c in r.components]
                if any(c is None for c in children):reason='Componente legado não encontrado; ordem original preservada.';value=None
                else:value,reason=compose(r,children)
                if value:r.canvas_layout=value
                elif reason:mapping['blocker']=reason+' '+mapping.get('blocker','')
                r.legacy['external_mapping']=mapping;r.save(update_fields=['legacy','canvas_layout'])
            for r in updates:
                Audit.objects.create(unit=r.unit,action='report.external_canvas_mapped',object_id=str(r.pk),details={'code':r.code,'version':r.version,'canvas_draft':bool(r.canvas_layout),'status':r.legacy['external_mapping']['status']})
        result=[]
        for r in reports:
            r.refresh_from_db();m=r.legacy.get('external_mapping',{})
            result.append({'id':r.pk,'unit':r.unit.slug,'code':r.code,'name':r.name,'kind':r.catalog_kind,'family':m.get('family'),'status':m.get('status'),'target':m.get('target'),'blocker':m.get('blocker'),'columns':len(m.get('columns',[])),'layout':bool(r.canvas_layout),'pages':len(r.canvas_layout.get('pages',[])),'source_count':len(r.canvas_layout.get('sources',[])),'enabled':r.enabled,'canvas_enabled':r.canvas_enabled,'column_validation':m.get('column_validation')})
        (output/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
        self.stdout.write(json.dumps({'mapped':len(result),'new_drafts':sum(bool(r['layout']) and not r['canvas_enabled'] for r in result),'already_integrated':sum(r['status']=='integrated' for r in result),'routines':sum(r['status']=='routine' for r in result),'published_files':sum(r['status']=='published_file' for r in result)}))
