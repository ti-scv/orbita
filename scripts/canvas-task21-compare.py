import json,time
from operations.models import ReportDefinition
from operations.report_engine import connect,parameters,bound_sql
from operations.operational_sql import prepare_values
from operations.report_canvas.preview_sql import optimize
baseline=json.load(open("/tmp/t21-baseline.json"))
ids=sorted({x["child"] for x in baseline if x["engine"]=="postgres"})
results=[]
for pk in ids:
 r=ReportDefinition.objects.select_related("connection").get(pk=pk)
 vals=parameters(r,prepare_values(r,{}))
 sql,binds=bound_sql(r.query_sql,vals,r.connection.engine)
 new,nb=bound_sql(optimize(r.query_sql),vals,r.connection.engine)
 with connect(r.connection) as c:
  with c.cursor() as q:
   q.execute(sql,binds);before=q.fetchmany(10001)
   q.execute(new,nb);after=q.fetchmany(10001)
   result={"id":pk,"equal":before==after,"rows":len(before),"rewritten":new!=sql}
   if max(x.get("query_ms",0) for x in baseline if x["child"]==pk)>100:
    plans={}
    for name,query,b in [("before",sql,binds),("after",new,nb)]:
     q.execute("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) "+query,b)
     p=q.fetchone()[0][0]
     plans[name]={"planning_ms":p["Planning Time"],"execution_ms":p["Execution Time"],"shared_hit":p["Plan"].get("Shared Hit Blocks"),"shared_read":p["Plan"].get("Shared Read Blocks"),"temp_written":p["Plan"].get("Temp Written Blocks")}
    result["explain"]=plans
   results.append(result)
with open("/tmp/t21-compare.json","w") as f:json.dump(results,f)
print("sources",len(results),"equal",sum(x["equal"] for x in results),"rewritten",sum(x["rewritten"] for x in results))
for x in results:
 if "explain" in x:print(json.dumps(x))
