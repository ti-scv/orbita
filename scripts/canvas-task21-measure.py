import json,time,signal
from contextlib import contextmanager
from unittest.mock import patch
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory,force_authenticate
from operations.models import ReportDefinition
from operations.report_api import CatalogViewSet
from operations import report_engine as eng
from operations.report_canvas import sources
from django.db.models import Q
user=get_user_model().objects.filter(is_superuser=True,is_active=True).first()
factory=APIRequestFactory()
original=eng.connect
timings={}
class Cursor:
 def __init__(self,c): self.c=c
 def __getattr__(self,k): return getattr(self.c,k)
 def execute(self,*a,**kw):
  t=time.perf_counter()
  try:return self.c.execute(*a,**kw)
  finally:timings["query_ms"]=timings.get("query_ms",0)+(time.perf_counter()-t)*1000
 def fetchmany(self,*a,**kw):
  t=time.perf_counter()
  try:return self.c.fetchmany(*a,**kw)
  finally:timings["fetch_ms"]=timings.get("fetch_ms",0)+(time.perf_counter()-t)*1000
class Conn:
 def __init__(self,c):self.c=c
 def __getattr__(self,k):return getattr(self.c,k)
 def cursor(self,*a,**kw):return Cursor(self.c.cursor(*a,**kw))
@contextmanager
def measured(c):
 t=time.perf_counter()
 with original(c) as conn:
  timings["connection_ms"]=timings.get("connection_ms",0)+(time.perf_counter()-t)*1000
  yield Conn(conn)
def alarm(*args):raise TimeoutError("measurement deadline")
signal.signal(signal.SIGALRM,alarm)
results=[]
reports=ReportDefinition.objects.filter(Q(enabled=True,canvas_enabled=True)|Q(pk__in=[323,326,6])).select_related("unit").order_by("pk")
view=CatalogViewSet.as_view({"post":"canvas_source_preview"})
memo={}
for report in reports:
 for source in report.canvas_layout.get("sources",[]):
  child=ReportDefinition.objects.select_related("connection").filter(pk=source.get("report_id")).first() if source.get("type")=="report" else None
  params={}
  if child and child.handler=="stock_loans_v1":params={"WPA_DATA_INICIAL":"2026-10-01","WPA_DATA_FINAL":"2026-10-28"}
  key=json.dumps([report.unit_id,source,params],sort_keys=True)
  item={"report":report.pk,"source":source.get("id"),"child":child.pk if child else None,"engine":child.connection.engine if child and child.connection_id else "native","handler":child.handler if child else ""}
  if key in memo:item.update(memo[key]);item["reused"]=True
  else:
   timings.clear();t=time.perf_counter()
   try:
    signal.alarm(25)
    req=factory.post("/api/v1/reports/%s/canvas-source-preview/?unit=%s"%(report.pk,report.unit.slug),{"source":source,"parameters":params,"limit":50},format="json")
    force_authenticate(req,user=user)
    with patch.object(eng,"connect",measured):
     response=view(req,pk=report.pk)
     response.render()
    if not isinstance(response.data,dict): response.data = {"error_code":"validation_error"}
    item.update(status=response.status_code,api_ms=round((time.perf_counter()-t)*1000,2),elapsed_ms=response.data.get("elapsed_ms"),cache_hit=response.data.get("cache_hit",False),serialize_ms=response.data.get("timings",{}).get("serialize_ms"),rows=len(response.data.get("rows",[])),total_rows=response.data.get("total_rows"),**{k:round(v,2) for k,v in timings.items()})
    if response.status_code!=200:item["error"]="validation_or_source_error"
   except Exception as e:item.update(status="exception",error=type(e).__name__,api_ms=round((time.perf_counter()-t)*1000,2))
   finally:signal.alarm(0)
   memo[key]={k:v for k,v in item.items() if k not in ("report","source","child","engine","handler")}
  results.append(item)
  print(json.dumps(item),flush=True)
with open("/tmp/t21-measure.json","w") as f:json.dump(results,f)
