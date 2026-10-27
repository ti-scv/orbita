"""Read-only profiling: SQL totals/plan structure, never SQL values or report data."""
import os,time,json
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings')
import django;django.setup()
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
client=APIClient();client.force_authenticate(get_user_model().objects.filter(is_superuser=True,is_active=True).first())
for run in range(2):
 for path in ['/api/v1/auth/csrf/','/api/v1/auth/session/']+[f'/api/v1/reports/{id}/{suffix}?unit=scv' for id in [323,326,6,8] for suffix in ['', 'canvas/']]:
  with CaptureQueriesContext(connection) as queries:
   t=time.perf_counter();r=client.get(path,HTTP_HOST='127.0.0.1');body=r.render().content;elapsed=time.perf_counter()-t
  print(json.dumps(dict(run=run+1,path=path,status=r.status_code,ms=round(elapsed*1000),sql_count=len(queries),sql_ms=round(sum(float(q['time'])*1000 for q in queries)),bytes=len(body))),flush=True)
from operations.models import ReportDefinition
for qs in [ReportDefinition.objects.filter(id=323),ReportDefinition.objects.filter(unit__slug='scv',reviewed=True,review_queue=False).select_related('connection','unit').order_by('name')]:
 plan=json.loads(qs.explain(format='json',analyze=True))[0]
 def summarize(p):return {'node':p['Node Type'],'rows':p.get('Actual Rows'),'ms':p.get('Actual Total Time'),'children':[summarize(x) for x in p.get('Plans',[])]}
 print(json.dumps({'plan':summarize(plan['Plan']),'planning_ms':plan['Planning Time'],'execution_ms':plan['Execution Time']}),flush=True)
