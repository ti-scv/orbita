import os, time, json
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
user=get_user_model().objects.filter(is_superuser=True,is_active=True).first()
client=APIClient(); client.force_authenticate(user)
for n in range(3):
 with CaptureQueriesContext(connection) as queries:
  t=time.perf_counter()
  response=client.get("/api/v1/reports/?unit=ame&section=reports", HTTP_HOST="127.0.0.1")
  ms=round((time.perf_counter()-t)*1000,1)
 print(json.dumps({"run":n+1,"status":response.status_code,"total_ms":ms,"sql_count":len(queries),"sql_ms":round(sum(float(q["time"])*1000 for q in queries),1),"rows":len(response.data.get("results",[])),"selects_by_table":{table:sum(('FROM "'+table+'"') in q["sql"] for q in queries) for table in ["operations_reportdefinition","core_membership","operations_reportcanvasasset","operations_reportsnapshotconfiguration"]}}))
